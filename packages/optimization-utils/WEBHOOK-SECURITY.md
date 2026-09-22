# Webhook Security Module

## Overview

The `@controlplane/optimization-utils` package now includes comprehensive webhook security features for hardening webhook endpoints against common attack vectors.

## Features

### 1. Signature Verification
- **HMAC-SHA256** cryptographic signature verification
- **Timing-safe comparison** to prevent timing attacks
- **Multi-provider support** (Stripe, GitHub, Slack, etc.)
- Raw body preservation for accurate verification

### 2. Idempotency
- **Event deduplication** using event IDs
- **In-memory store** (replaceable with Redis/DB)
- **Processing state tracking** to handle concurrent requests
- **Automatic TTL** cleanup for old records

### 3. Replay Protection
- **Timestamp validation** with configurable tolerance (default: 5 minutes)
- **Clock skew handling** (60 second future tolerance)
- **Configurable providers** with known header names

### 4. Safe Logging
- **Automatic sensitive data redaction** (passwords, keys, tokens)
- **Structured log entries** for observability
- **Audit trail** for security events

## Quick Start

```typescript
import { WebhookSecurity, createWebhookHandler } from '@controlplane/optimization-utils';

const webhookSecurity = new WebhookSecurity({
  secretKey: process.env.WEBHOOK_SECRET!,
  replayToleranceSeconds: 300, // 5 minutes
});

const handleWebhook = createWebhookHandler(
  webhookSecurity,
  async (context) => {
    // Your business logic
    return { processed: true };
  }
);

// In your Express route:
app.post('/webhook', async (req, res) => {
  const validation = await webhookSecurity.validateRequest(req);
  
  if (!validation.valid) {
    return res.status(401).json({ error: validation.error });
  }
  
  const result = await handleWebhook(validation.context!);
  res.status(200).json(result.result);
});
```

## API Reference

### WebhookSecurity

#### Constructor Options
```typescript
interface WebhookSecurityConfig {
  secretKey: string;                    // Webhook signing secret
  signatureHeader?: string;            // Default: 'x-webhook-signature'
  timestampHeader?: string;            // Default: 'x-webhook-timestamp'
  eventIdHeader?: string;              // Default: 'x-webhook-event-id'
  replayToleranceSeconds?: number;    // Default: 300
  allowedTimestampHeaders?: string[];  // Provider-specific headers
  algorithm?: string;                  // Default: 'sha256'
  signatureFormat?: 'hex' | 'base64'; // Default: 'hex'
  signaturePrefix?: string;            // Default: 'v1='
}
```

#### Methods
- `verifySignature(rawBody, signature, timestamp?)` - Verify webhook signature
- `verifyTimestamp(timestamp)` - Validate timestamp for replay protection
- `checkIdempotency(eventId)` - Check if event should be processed
- `validateRequest(req)` - Combined validation (signature + timestamp + idempotency)
- `markCompleted(eventId, result)` - Mark event as successfully processed
- `markFailed(eventId, error)` - Mark event as failed
- `getRecord(eventId)` - Get idempotency record
- `getStats()` - Get statistics about processed events

### createWebhookHandler

Wraps a webhook handler function to automatically handle idempotency:

```typescript
const handleWebhook = createWebhookHandler(
  webhookSecurity,
  async (context) => {
    // Process the webhook
    return { success: true };
  }
);

const result = await handleWebhook(context);
// result = { result: { success: true }, duplicate: false }
```

### createWebhookSignature

Create signatures for testing or outgoing webhooks:

```typescript
import { createWebhookSignature } from '@controlplane/optimization-utils';

const signature = createWebhookSignature(
  'secret-key',
  JSON.stringify(payload),
  Date.now().toString()
);
// Returns: 'v1=abc123...'
```

## Provider Support

The module supports multiple webhook providers out of the box:

### Stripe
- Header: `stripe-signature` (contains timestamp and signature)
- Format: `t=<timestamp>,v1=<signature>`

### GitHub
- Header: `x-hub-signature-256`
- Header: `x-github-delivery` (event ID)

### Slack
- Header: `x-slack-signature`
- Header: `x-slack-request-timestamp`

### Custom Providers
Configure with `allowedTimestampHeaders` and `signatureHeader` options.

## Testing

Run the webhook simulator to test security features:

```bash
# Test valid webhook
node scripts/webhook-simulator.js --secret mysecret

# Test duplicate handling (5 duplicates)
node scripts/webhook-simulator.js --secret mysecret --duplicates 5

# Test rejection scenarios
node scripts/webhook-simulator.js --secret mysecret --invalid-sig
node scripts/webhook-simulator.js --secret mysecret --stale
```

### Unit Tests

```bash
cd packages/optimization-utils
npm test
```

Tests cover:
- Signature verification (valid, invalid, missing)
- Timestamp validation (fresh, stale, future, ISO format)
- Idempotency (first request, concurrent duplicates, cached results)
- Request context creation
- Safe logging and redaction

## Production Deployment

### Redis-backed Idempotency

For production, replace the in-memory store with Redis:

```typescript
import { WebhookSecurity } from '@controlplane/optimization-utils';

class RedisIdempotencyStore {
  // Implement Map-like interface using Redis
}

const webhookSecurity = new WebhookSecurity({
  secretKey: process.env.WEBHOOK_SECRET!,
});

// Extend to use Redis store
```

### Configuration Example

```yaml
# config/webhook.yaml
webhook:
  security:
    signature_header: "x-webhook-signature"
    timestamp_header: "x-webhook-timestamp"
    event_id_header: "x-webhook-event-id"
    replay_tolerance_seconds: 300
    algorithm: "sha256"
    signature_format: "hex"
    signature_prefix: "v1="
```

## Security Best Practices

1. **Always verify signatures** - Never process webhooks without signature verification
2. **Use HTTPS** - Webhooks should only be received over HTTPS
3. **Rotate secrets** - Implement secret rotation policies
4. **Monitor failures** - Alert on signature verification failures
5. **Limit retries** - Configure reasonable retry limits
6. **Log securely** - Redact sensitive data in logs

## See Also

- [Webhook Security Threat Model](../../docs/WEBHOOK-SECURITY.md)
- [Security Best Practices Guide](../../docs/SECURITY.md)
