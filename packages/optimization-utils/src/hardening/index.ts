/**
 * Hardening Module - Resilience patterns and fault tolerance
 */

export interface CircuitBreakerConfig {
  failureThreshold: number;
  resetTimeoutMs: number;
  halfOpenMaxCalls: number;
  successThreshold: number;
}

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerMetrics {
  failures: number;
  successes: number;
  lastFailureTime: number;
  state: CircuitState;
  halfOpenCalls: number;
}

/**
 * Circuit Breaker pattern implementation
 * Prevents cascading failures in distributed systems
 */
export class CircuitBreaker {
  private config: Required<CircuitBreakerConfig>;
  private metrics: CircuitBreakerMetrics;
  private listeners: Set<(state: CircuitState) => void>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      failureThreshold: config.failureThreshold ?? 5,
      resetTimeoutMs: config.resetTimeoutMs ?? 30_000,
      halfOpenMaxCalls: config.halfOpenMaxCalls ?? 3,
      successThreshold: config.successThreshold ?? 2,
    };
    this.metrics = {
      failures: 0,
      successes: 0,
      lastFailureTime: 0,
      state: 'closed',
      halfOpenCalls: 0,
    };
    this.listeners = new Set();
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.metrics.state === 'open') {
      if (Date.now() - this.metrics.lastFailureTime >= this.config.resetTimeoutMs) {
        this.transitionTo('half-open');
      } else {
        throw new CircuitBreakerOpenError('Circuit breaker is OPEN');
      }
    }

    if (this.metrics.state === 'half-open') {
      if (this.metrics.halfOpenCalls >= this.config.halfOpenMaxCalls) {
        throw new CircuitBreakerOpenError('Circuit breaker half-open limit reached');
      }
      this.metrics.halfOpenCalls++;
    }

    try {
      const result = await operation();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  getState(): CircuitState {
    if (this.metrics.state === 'open') {
      if (Date.now() - this.metrics.lastFailureTime >= this.config.resetTimeoutMs) {
        return 'half-open';
      }
    }
    return this.metrics.state;
  }

  onStateChange(listener: (state: CircuitState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private onSuccess(): void {
    this.metrics.successes++;

    if (this.metrics.state === 'half-open') {
      if (this.metrics.successes >= this.config.successThreshold) {
        this.transitionTo('closed');
      }
    }
  }

  private onFailure(): void {
    this.metrics.failures++;
    this.metrics.lastFailureTime = Date.now();

    if (this.metrics.state === 'half-open') {
      this.transitionTo('open');
    } else if (this.metrics.failures >= this.config.failureThreshold) {
      this.transitionTo('open');
    }
  }

  private transitionTo(newState: CircuitState): void {
    const oldState = this.metrics.state;
    this.metrics.state = newState;

    if (newState === 'closed') {
      this.metrics.failures = 0;
      this.metrics.successes = 0;
      this.metrics.halfOpenCalls = 0;
    } else if (newState === 'half-open') {
      this.metrics.halfOpenCalls = 0;
      this.metrics.successes = 0;
    }

    if (oldState !== newState) {
      this.listeners.forEach((listener) => listener(newState));
    }
  }
}

export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  burstSize?: number;
  keyGenerator?: (context: unknown) => string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

/**
 * Token bucket rate limiter
 * Provides smooth rate limiting with burst capability
 */
export class RateLimiter {
  private config: Required<RateLimitConfig>;
  private buckets: Map<string, RateLimitEntry>;
  private cleanupInterval: ReturnType<typeof setInterval> | null;

  constructor(config: RateLimitConfig) {
    this.config = {
      maxRequests: config.maxRequests,
      windowMs: config.windowMs,
      burstSize: config.burstSize ?? config.maxRequests,
      keyGenerator: config.keyGenerator ?? (() => 'default'),
    };
    this.buckets = new Map();
    this.cleanupInterval = null;
    this.startCleanup();
  }

  tryAcquire(context?: unknown): { allowed: boolean; remaining: number; resetTime: number } {
    const key = this.config.keyGenerator(context);
    const now = Date.now();

    let entry = this.buckets.get(key);

    if (!entry || now > entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + this.config.windowMs,
      };
      this.buckets.set(key, entry);
    }

    const allowed = entry.count < this.config.maxRequests;

    if (allowed) {
      entry.count++;
    }

    return {
      allowed,
      remaining: Math.max(0, this.config.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  async acquire(context?: unknown, timeoutMs = 5000): Promise<void> {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      const result = this.tryAcquire(context);
      if (result.allowed) {
        return;
      }

      const waitTime = Math.min(100, result.resetTime - Date.now());
      if (waitTime > 0) {
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw new RateLimitExceededError('Rate limit exceeded, timeout waiting for token');
  }

  getRemaining(context?: unknown): number {
    const key = this.config.keyGenerator(context);
    const entry = this.buckets.get(key);

    if (!entry || Date.now() > entry.resetTime) {
      return this.config.maxRequests;
    }

    return Math.max(0, this.config.maxRequests - entry.count);
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.buckets.clear();
  }

  private startCleanup(): void {
    // Cleanup expired entries every window period
    this.cleanupInterval = setInterval(() => {
      const now = Date.now();
      for (const [key, entry] of this.buckets.entries()) {
        if (now > entry.resetTime) {
          this.buckets.delete(key);
        }
      }
    }, this.config.windowMs);
  }
}

export class RateLimitExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RateLimitExceededError';
  }
}

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableErrors?: string[];
  onRetry?: (attempt: number, error: Error, delayMs: number) => void;
}

/**
 * Retry policy with exponential backoff
 * Handles transient failures gracefully
 */
export class RetryPolicy {
  private config: Required<RetryConfig>;

  constructor(config: Partial<RetryConfig> = {}) {
    this.config = {
      maxRetries: config.maxRetries ?? 3,
      baseDelayMs: config.baseDelayMs ?? 1000,
      maxDelayMs: config.maxDelayMs ?? 30_000,
      backoffMultiplier: config.backoffMultiplier ?? 2,
      retryableErrors: config.retryableErrors ?? [],
      onRetry: config.onRetry ?? (() => {}),
    };
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= this.config.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt === this.config.maxRetries) {
          break;
        }

        if (!this.isRetryable(lastError)) {
          throw lastError;
        }

        const delayMs = this.calculateDelay(attempt);
        this.config.onRetry(attempt + 1, lastError, delayMs);

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    throw lastError;
  }

  private calculateDelay(attempt: number): number {
    const exponentialDelay =
      this.config.baseDelayMs * Math.pow(this.config.backoffMultiplier, attempt);
    const jitter = Math.random() * 0.1 * exponentialDelay; // 10% jitter
    return Math.min(exponentialDelay + jitter, this.config.maxDelayMs);
  }

  private isRetryable(error: Error): boolean {
    if (this.config.retryableErrors.length === 0) {
      return true;
    }
    return this.config.retryableErrors.some(
      (pattern) => error.name.includes(pattern) || error.message.includes(pattern)
    );
  }
}

export interface BulkheadConfig {
  maxConcurrent: number;
  maxQueue: number;
  queueTimeoutMs: number;
}

interface BulkheadTask<T> {
  execute: () => Promise<T>;
  resolve: (value: T) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

/**
 * Bulkhead pattern - isolates failures
 * Limits concurrent operations to prevent resource exhaustion
 */
export class Bulkhead {
  private config: Required<BulkheadConfig>;
  private running: number;
  private queue: BulkheadTask<unknown>[];

  constructor(config: Partial<BulkheadConfig> = {}) {
    this.config = {
      maxConcurrent: config.maxConcurrent ?? 10,
      maxQueue: config.maxQueue ?? 100,
      queueTimeoutMs: config.queueTimeoutMs ?? 5000,
    };
    this.running = 0;
    this.queue = [];
  }

  async execute<T>(operation: () => Promise<T>): Promise<T> {
    if (this.running < this.config.maxConcurrent) {
      return this.runTask(operation);
    }

    if (this.queue.length >= this.config.maxQueue) {
      throw new BulkheadFullError('Bulkhead queue is full');
    }

    return new Promise<T>((resolve, reject) => {
      const task: BulkheadTask<T> = {
        execute: operation,
        resolve,
        reject,
        timeout: null as unknown as ReturnType<typeof setTimeout>,
      };

      task.timeout = setTimeout(() => {
        const index = this.queue.indexOf(task as unknown as BulkheadTask<unknown>);
        if (index > -1) {
          this.queue.splice(index, 1);
        }
        reject(new BulkheadTimeoutError('Bulkhead queue timeout'));
      }, this.config.queueTimeoutMs);

      this.queue.push(task as unknown as BulkheadTask<unknown>);
    });
  }

  getMetrics(): { running: number; queued: number; available: number } {
    return {
      running: this.running,
      queued: this.queue.length,
      available: this.config.maxConcurrent - this.running,
    };
  }

  private async runTask<T>(operation: () => Promise<T>): Promise<T> {
    this.running++;

    try {
      const result = await operation();
      return result;
    } finally {
      this.running--;
      this.processQueue();
    }
  }

  private processQueue(): void {
    if (this.queue.length === 0 || this.running >= this.config.maxConcurrent) {
      return;
    }

    const task = this.queue.shift();
    if (task) {
      clearTimeout(task.timeout);
      this.runTask(task.execute as () => Promise<unknown>)
        .then(task.resolve)
        .catch(task.reject);
    }
  }
}

export class BulkheadFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadFullError';
  }
}

export class BulkheadTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BulkheadTimeoutError';
  }
}

// Webhook security exports
export {
  WebhookSecurity,
  webhookSecurityMiddleware,
  createWebhookHandler,
  createWebhookSignature,
  type WebhookSecurityConfig,
  type SignatureVerificationResult,
  type IdempotencyRecord,
  type WebhookContext,
} from './webhook.js';
