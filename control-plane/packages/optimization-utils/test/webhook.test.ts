import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  WebhookSecurity,
  createWebhookSignature,
  webhookSecurityMiddleware,
  createWebhookHandler,
  type WebhookContext,
} from '../src/hardening/webhook.js';

describe('WebhookSecurity', () => {
  const TEST_SECRET = 'test-secret-key-for-webhook-signing';
  const TIMESTAMP_TOLERANCE = 300; // 5 minutes

  let webhookSecurity: WebhookSecurity;

  beforeEach(() => {
    webhookSecurity = new WebhookSecurity({
      secretKey: TEST_SECRET,
      replayToleranceSeconds: TIMESTAMP_TOLERANCE,
    });
  });

  afterEach(() => {
    webhookSecurity.destroy();
  });

  describe('Signature Verification', () => {
    it('should verify valid signature without timestamp', () => {
      const rawBody = '{"event":"test","data":{"id":"123"}}';
      const signature = createWebhookSignature(TEST_SECRET, rawBody);
      const result = webhookSecurity.verifySignature(rawBody, signature);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should verify valid signature with timestamp', () => {
      const rawBody = '{"event":"test","data":{"id":"123"}}';
      const timestamp = Date.now().toString();
      const signature = createWebhookSignature(TEST_SECRET, rawBody, timestamp);
      const result = webhookSecurity.verifySignature(rawBody, signature, timestamp);

      expect(result.valid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const rawBody = '{"event":"test","data":{"id":"123"}}';
      const signature = createWebhookSignature(TEST_SECRET, 'wrong-body');
      const result = webhookSecurity.verifySignature(rawBody, signature);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature mismatch');
    });

    it('should reject missing signature', () => {
      const rawBody = '{"event":"test"}';
      const result = webhookSecurity.verifySignature(rawBody, undefined);

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Missing signature header');
    });

    it('should reject tampered body even with valid signature format', () => {
      const rawBody = '{"event":"test","data":{"id":"123"}}';
      const signature = createWebhookSignature(TEST_SECRET, rawBody);

      // Tamper with the body
      const tamperedBody = '{"event":"test","data":{"id":"456"}}';
      const result = webhookSecurity.verifySignature(tamperedBody, signature);

      expect(result.valid).toBe(false);
    });

    it('should handle signature without v1= prefix', () => {
      const crypto = require('node:crypto');
      const rawBody = '{"event":"test"}';
      const hmac = crypto.createHmac('sha256', TEST_SECRET);
      hmac.update(rawBody, 'utf8');
      const signature = hmac.digest('hex');
      const result = webhookSecurity.verifySignature(rawBody, signature);

      expect(result.valid).toBe(true);
    });
  });

  describe('Timestamp Verification', () => {
    it('should accept current timestamp', () => {
      const now = Date.now().toString();
      const result = webhookSecurity.verifyTimestamp(now);

      expect(result.valid).toBe(true);
      expect(result.age).toBeGreaterThanOrEqual(0);
    });

    it('should reject timestamp outside tolerance window', () => {
      const oldTimestamp = (Date.now() - TIMESTAMP_TOLERANCE * 1000 - 60000).toString(); // 6 minutes ago
      const result = webhookSecurity.verifyTimestamp(oldTimestamp);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('tolerance');
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = (Date.now() + 120000).toString(); // 2 minutes in future
      const result = webhookSecurity.verifyTimestamp(futureTimestamp);

      expect(result.valid).toBe(false);
      expect(result.error).toContain('future');
    });

    it('should allow recent future timestamp (clock skew)', () => {
      const slightlyFuture = (Date.now() + 30000).toString(); // 30 seconds in future
      const result = webhookSecurity.verifyTimestamp(slightlyFuture);

      expect(result.valid).toBe(true);
    });

    it('should accept ISO string timestamp', () => {
      const isoTimestamp = new Date().toISOString();
      const result = webhookSecurity.verifyTimestamp(isoTimestamp);

      expect(result.valid).toBe(true);
    });

    it('should return valid for missing timestamp (optional)', () => {
      const result = webhookSecurity.verifyTimestamp(undefined);

      expect(result.valid).toBe(true);
    });
  });

  describe('Idempotency', () => {
    it('should allow first request', () => {
      const result = webhookSecurity.checkIdempotency('event-123');

      expect(result.shouldProcess).toBe(true);
      expect(result.duplicate).toBe(false);
    });

    it('should detect duplicate request while processing', () => {
      const eventId = 'event-456';

      // First request
      webhookSecurity.checkIdempotency(eventId);

      // Concurrent duplicate
      const duplicate = webhookSecurity.checkIdempotency(eventId);

      expect(duplicate.shouldProcess).toBe(false);
      expect(duplicate.duplicate).toBe(true);
    });

    it('should return cached result for completed duplicate', () => {
      const eventId = 'event-789';

      // First request
      webhookSecurity.checkIdempotency(eventId);
      webhookSecurity.markCompleted(eventId, { processed: true });

      // Duplicate request
      const duplicate = webhookSecurity.checkIdempotency(eventId);

      expect(duplicate.shouldProcess).toBe(false);
      expect(duplicate.duplicate).toBe(true);
      expect(duplicate.record?.status).toBe('completed');
      expect(duplicate.record?.result).toEqual({ processed: true });
    });

    it('should allow retry after failed attempt', () => {
      const eventId = 'event-failed';

      webhookSecurity.checkIdempotency(eventId);
      webhookSecurity.markFailed(eventId, 'Previous error');

      const retry = webhookSecurity.checkIdempotency(eventId);

      expect(retry.shouldProcess).toBe(true);
      expect(retry.duplicate).toBe(false);
    });

    it('should track attempt count', () => {
      const eventId = 'event-multi';

      webhookSecurity.checkIdempotency(eventId);
      webhookSecurity.checkIdempotency(eventId);
      webhookSecurity.checkIdempotency(eventId);

      const record = webhookSecurity.getRecord(eventId);
      expect(record?.attempts).toBe(3);
    });
  });

  describe('Request Context', () => {
    it('should extract event ID from header', async () => {
      const context = await webhookSecurity.createContext({
        body: { test: true },
        headers: {
          'x-webhook-event-id': 'custom-event-123',
        },
      });

      expect(context.eventId).toBe('custom-event-123');
    });

    it('should generate UUID if no event ID header', async () => {
      const context = await webhookSecurity.createContext({
        body: { test: true },
        headers: {},
      });

      expect(context.eventId).toBeDefined();
      expect(context.eventId.length).toBe(36); // UUID format
    });

    it('should extract timestamp from headers', async () => {
      const timestamp = Date.now().toString();
      const context = await webhookSecurity.createContext({
        body: { test: true },
        headers: {
          'x-webhook-timestamp': timestamp,
        },
      });

      expect(context.timestamp).toBeDefined();
    });

    it('should sanitize sensitive data from logs', () => {
      const sensitive = {
        password: 'secret123',
        apiKey: 'key-123',
        data: { nested: 'value' },
      };

      const sanitized = webhookSecurity.sanitizeForLogging(sensitive);

      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.apiKey).toBe('[REDACTED]');
      expect(sanitized.data).toEqual({ nested: 'value' });
    });
  });

  describe('Validate Request', () => {
    it('should validate complete valid request', async () => {
      const rawBody = '{"event":"test"}';
      const timestamp = Date.now().toString();
      const signature = createWebhookSignature(TEST_SECRET, rawBody, timestamp);

      const result = await webhookSecurity.validateRequest({
        body: JSON.parse(rawBody),
        headers: {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
          'x-webhook-event-id': 'test-event',
        },
        rawBody,
      });

      expect(result.valid).toBe(true);
      expect(result.shouldProcess).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject request with invalid signature', async () => {
      const result = await webhookSecurity.validateRequest({
        body: { event: 'test' },
        headers: {
          'x-webhook-signature': 'invalid-signature',
          'x-webhook-event-id': 'test-event',
        },
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Signature verification failed');
    });

    it('should reject stale timestamp', async () => {
      const oldTimestamp = (Date.now() - TIMESTAMP_TOLERANCE * 1000 - 60000).toString();
      const rawBody = '{"event":"test"}';
      const signature = createWebhookSignature(TEST_SECRET, rawBody, oldTimestamp);

      const result = await webhookSecurity.validateRequest({
        body: JSON.parse(rawBody),
        headers: {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': oldTimestamp,
          'x-webhook-event-id': 'test-event',
        },
        rawBody,
      });

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Timestamp verification failed');
    });

    it('should not process duplicate completed request', async () => {
      const rawBody = '{"event":"test"}';
      const timestamp = Date.now().toString();
      const signature = createWebhookSignature(TEST_SECRET, rawBody, timestamp);

      // First request
      await webhookSecurity.validateRequest({
        body: JSON.parse(rawBody),
        headers: {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
          'x-webhook-event-id': 'dup-event',
        },
        rawBody,
      });

      webhookSecurity.markCompleted('dup-event', { done: true });

      // Duplicate request
      const duplicate = await webhookSecurity.validateRequest({
        body: JSON.parse(rawBody),
        headers: {
          'x-webhook-signature': signature,
          'x-webhook-timestamp': timestamp,
          'x-webhook-event-id': 'dup-event',
        },
        rawBody,
      });

      expect(duplicate.valid).toBe(true);
      expect(duplicate.shouldProcess).toBe(false);
    });
  });

  describe('Statistics', () => {
    it('should track idempotency statistics', () => {
      webhookSecurity.checkIdempotency('event-1');
      webhookSecurity.checkIdempotency('event-2');
      webhookSecurity.checkIdempotency('event-3');

      webhookSecurity.markCompleted('event-1', {});
      webhookSecurity.markFailed('event-2', 'error');

      const stats = webhookSecurity.getStats();

      expect(stats.total).toBe(3);
      expect(stats.completed).toBe(1);
      expect(stats.failed).toBe(1);
      expect(stats.processing).toBe(1);
    });

    it('should clear all records', () => {
      webhookSecurity.checkIdempotency('event-1');
      webhookSecurity.checkIdempotency('event-2');

      webhookSecurity.clear();

      const stats = webhookSecurity.getStats();
      expect(stats.total).toBe(0);
    });
  });
});

describe('createWebhookSignature', () => {
  const SECRET = 'test-secret';

  it('should create valid signature format', () => {
    const signature = createWebhookSignature(SECRET, 'test-body');

    expect(signature).toMatch(/^v1=[a-f0-9]{64}$/);
  });

  it('should create consistent signatures', () => {
    const sig1 = createWebhookSignature(SECRET, 'test-body', '12345');
    const sig2 = createWebhookSignature(SECRET, 'test-body', '12345');

    expect(sig1).toBe(sig2);
  });

  it('should create different signatures for different payloads', () => {
    const sig1 = createWebhookSignature(SECRET, 'body-1');
    const sig2 = createWebhookSignature(SECRET, 'body-2');

    expect(sig1).not.toBe(sig2);
  });

  it('should include timestamp in signature', () => {
    const sig1 = createWebhookSignature(SECRET, 'body', '100');
    const sig2 = createWebhookSignature(SECRET, 'body', '200');

    expect(sig1).not.toBe(sig2);
  });
});

describe('createWebhookHandler', () => {
  const SECRET = 'test-secret';
  let webhookSecurity: WebhookSecurity;

  beforeEach(() => {
    webhookSecurity = new WebhookSecurity({
      secretKey: SECRET,
      replayToleranceSeconds: 300,
    });
  });

  afterEach(() => {
    webhookSecurity.destroy();
  });

  it('should execute handler on first request', async () => {
    const handler = createWebhookHandler(webhookSecurity, async (ctx) => {
      return { processed: true, eventId: ctx.eventId };
    });

    const context: WebhookContext = {
      eventId: 'test-event',
      rawBody: '{}',
      body: {},
      headers: {},
      metadata: {},
    };

    const result = await handler(context);

    expect(result.duplicate).toBe(false);
    expect(result.result).toEqual({ processed: true, eventId: 'test-event' });
  });

  it('should return cached result for duplicate', async () => {
    let callCount = 0;

    const handler = createWebhookHandler(webhookSecurity, async (ctx) => {
      callCount++;
      return { processed: true, eventId: ctx.eventId };
    });

    const context: WebhookContext = {
      eventId: 'dup-event',
      rawBody: '{}',
      body: {},
      headers: {},
      metadata: {},
    };

    // First call
    await handler(context);

    // Duplicate call
    const result = await handler(context);

    expect(callCount).toBe(1);
    expect(result.duplicate).toBe(true);
  });

  it('should mark failed on handler error', async () => {
    const handler = createWebhookHandler(webhookSecurity, async () => {
      throw new Error('Handler failed');
    });

    const context: WebhookContext = {
      eventId: 'fail-event',
      rawBody: '{}',
      body: {},
      headers: {},
      metadata: {},
    };

    await expect(handler(context)).rejects.toThrow('Handler failed');

    const record = webhookSecurity.getRecord('fail-event');
    expect(record?.status).toBe('failed');
  });
});
