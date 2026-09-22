import crypto from 'node:crypto';

/**
 * Webhook Security Configuration
 */
export interface WebhookSecurityConfig {
  /** Secret key for signature verification */
  secretKey: string;
  /** Signature header name (default: x-webhook-signature) */
  signatureHeader?: string;
  /** Timestamp header name (default: x-webhook-timestamp) */
  timestampHeader?: string;
  /** Event ID header name (default: x-webhook-event-id) */
  eventIdHeader?: string;
  /** Tolerance window for replay protection in seconds (default: 300 = 5 minutes) */
  replayToleranceSeconds?: number;
  /** List of allowed timestamp header names (for different providers) */
  allowedTimestampHeaders?: string[];
  /** Signature algorithm (default: sha256) */
  algorithm?: string;
  /** Signature format: 'hex' | 'base64' (default: 'hex') */
  signatureFormat?: 'hex' | 'base64';
  /** Signature prefix (default: v1=) */
  signaturePrefix?: string;
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  error?: string;
  details?: {
    providedSignature?: string;
    expectedSignature?: string;
    timestampAge?: number;
  };
}

/**
 * Idempotency record for deduplication
 */
export interface IdempotencyRecord {
  eventId: string;
  processedAt: Date;
  status: 'processing' | 'completed' | 'failed';
  result?: unknown;
  error?: string;
  attempts: number;
  lastAttemptAt: Date;
}

/**
 * Webhook handler context with security utilities
 */
export interface WebhookContext {
  /** Unique event ID */
  eventId: string;
  /** Raw request body */
  rawBody: string;
  /** Parsed request body */
  body: unknown;
  /** Request timestamp (if provided) */
  timestamp?: Date;
  /** Signature from header */
  signature?: string;
  /** Request headers */
  headers: Record<string, string>;
  /** Request metadata */
  metadata: Record<string, unknown>;
}

/**
 * WebhookSecurity - Comprehensive webhook security handler
 * Implements signature verification, idempotency, replay protection, and safe logging
 */
export class WebhookSecurity {
  private config: Required<WebhookSecurityConfig>;
  private idempotencyStore: Map<string, IdempotencyRecord>;
  private cleanupInterval: ReturnType<typeof setInterval> | null;
  private readonly maxIdempotencyAgeMs: number;

  constructor(config: WebhookSecurityConfig) {
    this.config = {
      secretKey: config.secretKey,
      signatureHeader: config.signatureHeader ?? 'x-webhook-signature',
      timestampHeader: config.timestampHeader ?? 'x-webhook-timestamp',
      eventIdHeader: config.eventIdHeader ?? 'x-webhook-event-id',
      replayToleranceSeconds: config.replayToleranceSeconds ?? 300,
      allowedTimestampHeaders: config.allowedTimestampHeaders ?? [
        'x-webhook-timestamp',
        'stripe-signature',
        'x-hub-signature-256',
        'x-github-delivery',
        'x-gitlab-event',
        'x-slack-request-timestamp',
      ],
      algorithm: config.algorithm ?? 'sha256',
      signatureFormat: config.signatureFormat ?? 'hex',
      signaturePrefix: config.signaturePrefix ?? 'v1=',
    };

    this.idempotencyStore = new Map();
    this.maxIdempotencyAgeMs = this.config.replayToleranceSeconds * 1000 * 10; // 10x replay tolerance
    this.cleanupInterval = this.startCleanup();
  }

  /**
   * Verify webhook signature
   * Supports multiple signature formats and providers
   */
  verifySignature(
    rawBody: string,
    signature: string | undefined,
    timestamp?: string
  ): SignatureVerificationResult {
    // Check for missing signature
    if (!signature) {
      return {
        valid: false,
        error: 'Missing signature header',
        details: { providedSignature: undefined },
      };
    }

    // Remove signature prefix if present (e.g., "v1=", "sha256=", etc.)
    const normalizedSignature = signature.startsWith(this.config.signaturePrefix)
      ? signature.slice(this.config.signaturePrefix.length)
      : signature;

    // Calculate expected signature using HMAC
    const signedPayload = timestamp ? `${timestamp}.${rawBody}` : rawBody;
    const expectedSignature = this.calculateSignature(signedPayload);

    // Compare signatures using timing-safe comparison
    const signatureBuffer = Buffer.from(normalizedSignature, this.config.signatureFormat);
    const expectedBuffer = Buffer.from(expectedSignature, this.config.signatureFormat);

    if (signatureBuffer.length !== expectedBuffer.length) {
      return {
        valid: false,
        error: 'Invalid signature format',
        details: {
          providedSignature: normalizedSignature,
          expectedSignature,
        },
      };
    }

    const signatureValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);

    if (!signatureValid) {
      return {
        valid: false,
        error: 'Signature mismatch',
        details: {
          providedSignature: normalizedSignature,
          expectedSignature,
        },
      };
    }

    return { valid: true };
  }

  /**
   * Verify timestamp for replay protection
   * Returns error if timestamp is too old or in the future
   */
  verifyTimestamp(timestamp: string | undefined): { valid: boolean; error?: string; age?: number } {
    if (!timestamp) {
      // Timestamp is optional but recommended
      return { valid: true, age: undefined };
    }

    // Check if timestamp looks like an ISO string (contains T, -, :, etc.)
    const looksLikeIsoDate = /[T: -]/.test(timestamp);

    if (looksLikeIsoDate) {
      // Parse as ISO string
      const date = new Date(timestamp);
      if (isNaN(date.getTime())) {
        return { valid: false, error: 'Invalid timestamp format' };
      }
      const age = Date.now() - date.getTime();
      if (age > this.config.replayToleranceSeconds * 1000) {
        return { valid: false, error: 'Timestamp too old', age };
      }
      // Reject future timestamps (allow 60 seconds clock skew)
      if (age < -60000) {
        return { valid: false, error: 'Timestamp is in the future', age };
      }
      return { valid: true, age };
    }

    // Parse as numeric timestamp (milliseconds)
    const timestampMs = parseInt(timestamp, 10);
    if (isNaN(timestampMs)) {
      return { valid: false, error: 'Invalid timestamp format' };
    }

    const age = Date.now() - timestampMs;
    const toleranceMs = this.config.replayToleranceSeconds * 1000;

    if (age > toleranceMs) {
      return { valid: false, error: 'Timestamp outside tolerance window', age };
    }

    // Reject future timestamps (allow 60 seconds clock skew)
    if (age < -60000) {
      return { valid: false, error: 'Timestamp is in the future', age };
    }

    return { valid: true, age };
  }

  /**
   * Check and update idempotency record
   * Returns { shouldProcess: boolean, record: IdempotencyRecord | undefined }
   */
  checkIdempotency(eventId: string): {
    shouldProcess: boolean;
    record?: IdempotencyRecord;
    duplicate: boolean;
  } {
    const existing = this.idempotencyStore.get(eventId);

    if (!existing) {
      // First time seeing this event
      const record: IdempotencyRecord = {
        eventId,
        processedAt: new Date(),
        status: 'processing',
        attempts: 1,
        lastAttemptAt: new Date(),
      };
      this.idempotencyStore.set(eventId, record);
      return { shouldProcess: true, record, duplicate: false };
    }

    // Update attempt count
    existing.attempts += 1;
    existing.lastAttemptAt = new Date();

    if (existing.status === 'processing') {
      // Event is currently being processed (concurrent request)
      // Still return shouldProcess: false to prevent duplicate side effects
      return { shouldProcess: false, record: existing, duplicate: true };
    }

    if (existing.status === 'completed') {
      // Already processed successfully - return cached result
      return { shouldProcess: false, record: existing, duplicate: true };
    }

    // Status is 'failed' - allow retry based on configuration
    // Update status to processing for retry
    existing.status = 'processing';
    return { shouldProcess: true, record: existing, duplicate: false };
  }

  /**
   * Mark idempotency record as completed
   */
  markCompleted(eventId: string, result: unknown): void {
    const record = this.idempotencyStore.get(eventId);
    if (record) {
      record.status = 'completed';
      record.result = result;
      record.processedAt = new Date();
    }
  }

  /**
   * Mark idempotency record as failed
   */
  markFailed(eventId: string, error: string): void {
    const record = this.idempotencyStore.get(eventId);
    if (record) {
      record.status = 'failed';
      record.error = error;
      record.processedAt = new Date();
    }
  }

  /**
   * Get idempotency record for debugging/monitoring
   */
  getRecord(eventId: string): IdempotencyRecord | undefined {
    return this.idempotencyStore.get(eventId);
  }

  /**
   * Extract event ID from request headers
   * Supports multiple header names for compatibility
   */
  extractEventId(headers: Record<string, string>): string | undefined {
    // Try configured header first
    const configuredHeader = this.config.eventIdHeader.toLowerCase();
    if (headers[configuredHeader]) {
      return headers[configuredHeader];
    }

    // Try common webhook event ID headers
    const commonHeaders = [
      'x-webhook-event-id',
      'x-event-id',
      'x-github-delivery',
      'stripe-signature', // Contains event ID in some formats
      'x-gitlab-event-uuid',
      'x-slack-event-id',
      'x-amz-sns-message-id',
      'x-twilio-signature', // Different format but worth checking
    ];

    for (const header of commonHeaders) {
      if (headers[header]) {
        return headers[header];
      }
    }

    return undefined;
  }

  /**
   * Extract timestamp from request headers
   */
  extractTimestamp(headers: Record<string, string>): string | undefined {
    for (const headerName of this.config.allowedTimestampHeaders) {
      const value = headers[headerName.toLowerCase()];
      if (value) {
        return value;
      }
    }
    return undefined;
  }

  /**
   * Extract signature from request headers
   */
  extractSignature(headers: Record<string, string>): string | undefined {
    const headerName = this.config.signatureHeader.toLowerCase();
    return headers[headerName];
  }

  /**
   * Create a secure webhook context from an Express request
   */
  async createContext(req: {
    body: unknown;
    headers: Record<string, string>;
    rawBody?: string;
  }): Promise<WebhookContext> {
    const rawBody = req.rawBody ?? JSON.stringify(req.body);
    const eventId = this.extractEventId(req.headers);
    const signature = this.extractSignature(req.headers);
    const timestampStr = this.extractTimestamp(req.headers);
    const timestamp = timestampStr
      ? new Date(parseInt(timestampStr, 10) || timestampStr)
      : undefined;

    return {
      eventId: eventId ?? crypto.randomUUID(),
      rawBody,
      body: req.body,
      timestamp,
      signature,
      headers: req.headers,
      metadata: {
        receivedAt: new Date().toISOString(),
        userAgent: req.headers['user-agent'] ?? 'unknown',
        ip: req.headers['x-forwarded-for'] ?? req.headers['x-real-ip'] ?? 'unknown',
      },
    };
  }

  /**
   * Validate webhook request - combines all security checks
   */
  async validateRequest(req: {
    body: unknown;
    headers: Record<string, string>;
    rawBody?: string;
  }): Promise<{
    valid: boolean;
    error?: string;
    context?: WebhookContext;
    shouldProcess?: boolean;
  }> {
    const context = await this.createContext(req);

    // Check idempotency first (fastest check)
    const idempotency = this.checkIdempotency(context.eventId);
    if (idempotency.duplicate && idempotency.record?.status === 'completed') {
      return {
        valid: true,
        context,
        shouldProcess: false,
      };
    }

    // Verify timestamp if provided
    const timestamp = this.extractTimestamp(req.headers);
    const timestampResult = this.verifyTimestamp(timestamp);
    if (!timestampResult.valid) {
      return {
        valid: false,
        error: `Timestamp verification failed: ${timestampResult.error}`,
        context,
      };
    }

    // Verify signature
    const signatureResult = this.verifySignature(context.rawBody, context.signature, timestamp);
    if (!signatureResult.valid) {
      return {
        valid: false,
        error: `Signature verification failed: ${signatureResult.error}`,
        context,
      };
    }

    return {
      valid: true,
      context,
      shouldProcess: idempotency.shouldProcess,
    };
  }

  /**
   * Create safe log entry for webhook events
   * Sanitizes sensitive data from logs
   */
  createSafeLogEntry(
    context: WebhookContext,
    additionalData?: Record<string, unknown>
  ): Record<string, unknown> {
    return {
      level: 'info',
      msg: 'webhook.received',
      eventId: context.eventId,
      timestamp: context.timestamp,
      receivedAt: context.metadata.receivedAt,
      userAgent: context.metadata.userAgent,
      ip: context.metadata.ip,
      hasSignature: !!context.signature,
      idempotent: false,
      ...this.sanitizeForLogging(additionalData),
    };
  }

  /**
   * Create log entry for duplicate events
   */
  createDuplicateLogEntry(
    context: WebhookContext,
    record: IdempotencyRecord
  ): Record<string, unknown> {
    return {
      level: 'info',
      msg: 'webhook.duplicate',
      eventId: context.eventId,
      originalProcessedAt: record.processedAt,
      duplicateCount: record.attempts,
      cachedResult: !!record.result,
    };
  }

  /**
   * Create error log entry
   */
  createErrorLogEntry(
    context: WebhookContext,
    error: Error | string,
    phase: 'validation' | 'processing' | 'idempotency'
  ): Record<string, unknown> {
    const errorMsg = typeof error === 'string' ? error : error.message;
    return {
      level: 'error',
      msg: `webhook.error.${phase}`,
      eventId: context.eventId,
      error: errorMsg,
      timestamp: context.timestamp,
    };
  }

  /**
   * Sanitize data for safe logging
   * Removes sensitive fields from logged objects
   */
  sanitizeForLogging(data?: Record<string, unknown>): Record<string, unknown> {
    if (!data) return {};

    const sensitiveFields = [
      'password',
      'secret',
      'token',
      'api_key',
      'apikey',
      'authorization',
      'credit_card',
      'card_number',
      'cvv',
      'ssn',
      'social_security',
      'private_key',
      'encryption_key',
      'hmac',
      'signature',
      'WebhookSecret',
      'webhook_secret',
    ];

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase();
      if (sensitiveFields.some((field) => lowerKey.includes(field.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        sanitized[key] = this.sanitizeForLogging(value as Record<string, unknown>);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Get idempotency statistics
   */
  getStats(): {
    total: number;
    processing: number;
    completed: number;
    failed: number;
  } {
    let processing = 0;
    let completed = 0;
    let failed = 0;

    for (const record of this.idempotencyStore.values()) {
      switch (record.status) {
        case 'processing':
          processing++;
          break;
        case 'completed':
          completed++;
          break;
        case 'failed':
          failed++;
          break;
      }
    }

    return {
      total: this.idempotencyStore.size,
      processing,
      completed,
      failed,
    };
  }

  /**
   * Clear all idempotency records (use with caution)
   */
  clear(): void {
    this.idempotencyStore.clear();
  }

  /**
   * Destroy the webhook security instance
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.idempotencyStore.clear();
  }

  /**
   * Calculate HMAC signature
   */
  private calculateSignature(payload: string): string {
    const hmac = crypto.createHmac(this.config.algorithm, this.config.secretKey);
    hmac.update(payload, 'utf8');

    if (this.config.signatureFormat === 'base64') {
      return hmac.digest('base64');
    }

    return hmac.digest('hex');
  }

  /**
   * Start cleanup interval for old idempotency records
   */
  private startCleanup(): ReturnType<typeof setInterval> {
    const cleanupInterval = setInterval(() => {
      const cutoff = Date.now() - this.maxIdempotencyAgeMs;

      for (const [eventId, record] of this.idempotencyStore.entries()) {
        if (record.processedAt.getTime() < cutoff) {
          this.idempotencyStore.delete(eventId);
        }
      }
    }, this.config.replayToleranceSeconds * 1000); // Cleanup every replay tolerance window

    return cleanupInterval;
  }
}

/**
 * Create a webhook signature for outgoing webhooks (for testing/debugging)
 */
export function createWebhookSignature(
  secretKey: string,
  payload: string,
  timestamp?: string
): string {
  const signedPayload = timestamp ? `${timestamp}.${payload}` : payload;
  const hmac = crypto.createHmac('sha256', secretKey);
  hmac.update(signedPayload, 'utf8');
  return `v1=${hmac.digest('hex')}`;
}

/**
 * Express middleware for webhook security
 */
export function webhookSecurityMiddleware(security: WebhookSecurity) {
  return async (
    req: { body: unknown; headers: Record<string, string> },
    res: {
      setHeader: (name: string, value: string) => void;
      status: (code: number) => { json: (data: unknown) => void };
      json: (data: unknown) => void;
    },
    next: () => void
  ): Promise<void> => {
    const validation = await security.validateRequest(req);

    // Add security context to response headers
    res.setHeader('x-webhook-security', validation.valid ? 'verified' : 'failed');
    res.setHeader('x-webhook-event-id', validation.context?.eventId ?? 'unknown');

    if (!validation.valid) {
      res.status(401).json({
        error: 'Webhook verification failed',
        message: validation.error,
        eventId: validation.context?.eventId,
      });
      return;
    }

    if (!validation.shouldProcess) {
      // Duplicate request - return 200 with cached result if available
      const record = security.getRecord(validation.context!.eventId);
      if (record?.status === 'completed' && record.result) {
        res.setHeader('x-webhook-duplicate', 'true');
        res.status(200).json({
          ...(record.result as object),
          _duplicate: true,
          _originalProcessedAt: record.processedAt.toISOString(),
        });
        return;
      }
    }

    // Store validation context for use in route handler
    (req as unknown as { webhookContext: WebhookContext }).webhookContext = validation.context!;

    next();
  };
}

/**
 * Async wrapper for webhook handlers with automatic idempotency tracking
 */
export function createWebhookHandler<T>(
  security: WebhookSecurity,
  handler: (context: WebhookContext) => Promise<T>
): (context: WebhookContext) => Promise<{ result: T; duplicate: boolean }> {
  return async (context: WebhookContext): Promise<{ result: T; duplicate: boolean }> => {
    const idempotency = security.checkIdempotency(context.eventId);

    if (idempotency.duplicate && idempotency.record?.status === 'completed') {
      return {
        result: idempotency.record.result as T,
        duplicate: true,
      };
    }

    try {
      const result = await handler(context);
      security.markCompleted(context.eventId, result);
      return { result, duplicate: false };
    } catch (error) {
      security.markFailed(
        context.eventId,
        error instanceof Error ? error.message : 'Unknown error'
      );
      throw error;
    }
  };
}
