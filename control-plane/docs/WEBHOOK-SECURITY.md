# Webhook Security Threat Model

## Overview

This document describes the security measures implemented to protect webhook endpoints against common attack vectors and the threat model for webhook handling in ControlPlane.

## Threat Model

### Identified Threats

| Threat | Severity | Description | Mitigation |
|--------|----------|-------------|------------|
| **Signature Forgery** | Critical | Attacker sends fake webhook requests | HMAC-SHA256 signature verification with timing-safe comparison |
| **Replay Attacks** | High | Attacker re-sends valid webhook later | Timestamp validation with 5-minute tolerance window |
| **Duplicate Processing** | Medium | Provider retries cause double-processing | Idempotency key storage preventing duplicate side effects |
| **Man-in-the-Middle** | High | Intercept and modify webhook in transit | HTTPS/TLS enforcement + signature verification |
| **Replay with Modified Body** | Critical | Replay with tampered payload | Signature covers both body and timestamp |
| **Timing Attacks** | Medium | Signature comparison timing leak | `crypto.timingSafeEqual` for constant-time comparison |
| **Sensitive Data Leakage** | Medium | Secrets in webhook logs | Automatic redaction of sensitive fields |
| **Clock Skew** | Low | Rejection due to time sync issues | 60-second future tolerance window |

## Security Controls

### 1. Signature Verification

```
HMAC-SHA256(timestamp.body, secret)
Format: v1=<hex_signature>
```

- **Algorithm**: HMAC-SHA256 (FIPS 198-1 compliant)
- **Comparison**: Timing-safe (`crypto.timingSafeEqual`)
- **Payload**: `timestamp.body` (prevents replay with body modification)
- **Header**: `X-Webhook-Signature`

### 2. Replay Protection

- **Tolerance Window**: 300 seconds (5 minutes)
- **Future Tolerance**: 60 seconds (clock skew)
- **Verification**: Timestamp from `X-Webhook-Timestamp` header

### 3. Idempotency

- **Storage**: In-memory Map (replaceable with Redis/DB)
- **Key**: `event_id` from `X-Webhook-Event-Id`
- **TTL**: 50 minutes (10x replay tolerance)
- **States**: `processing` | `completed` | `failed`

### 4. Safe Logging

Automatic redaction of sensitive fields:
```typescript
const sensitiveFields = [
  'password', 'secret', 'token', 'api_key',
  'credit_card', 'cvv', 'ssn', 'private_key',
  'encryption_key', 'hmac', 'webhook_secret'
];
```

## Architecture

```
                    ┌─────────────────┐
                    │  Incoming       │
                    │  Webhook        │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  1. Extract     │
                    │  Headers        │
                    │  (sig, ts, id) │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │  2. Check       │
                    │  Idempotency    │────────── Duplicate?
                    └────────┬────────┘          │
                             │ Yes              │ No
                    ┌────────▼────────┐          │
                    │  Return Cached  │          │
                    │  Response       │          │
                    └────────┬────────┘          │
                             │                   │
                    ┌────────▼────────┐          │
                    │  3. Verify       │          │
                    │  Timestamp       │── Invalid?──► 401 Reject
                    └────────┬────────┘          │
                             │ Valid             │
                    ┌────────▼────────┐          │
                    │  4. Verify       │          │
                    │  Signature       │── Invalid?──► 401 Reject
                    └────────┬────────┘          │
                             │ Valid             │
                    ┌────────▼────────┐          │
                    │  5. Process      │          │
                    │  Webhook         │          │
                    └────────┬────────┘          │
                             │                   │
                    ┌────────▼────────┐          │
                    │  6. Store        │          │
                    │  Result          │          │
                    └─────────────────┘          │
```

## Implementation Guidelines

### For HTTP Connectors

```typescript
import express from 'express';
import { WebhookSecurity, createWebhookHandler } from '@controlplane/optimization-utils';

const app = express();
const webhookSecurity = new WebhookSecurity({
  secretKey: process.env.WEBHOOK_SECRET!,
  replayToleranceSeconds: 300,
});

const handleWebhook = createWebhookHandler(
  webhookSecurity,
  async (context) => {
    // Your business logic here
    return { processed: true };
  }
);

app.post('/webhook', async (req, res) => {
  const validation = await webhookSecurity.validateRequest(req);
  
  if (!validation.valid) {
    return res.status(401).json({ error: validation.error });
  }
  
  if (!validation.shouldProcess) {
    const record = webhookSecurity.getRecord(validation.context!.eventId);
    return res.status(200).json({
      ...record?.result,
      _duplicate: true,
    });
  }
  
  const result = await handleWebhook(validation.context!);
  res.status(200).json(result.result);
});
```

### For Queue Workers

Queue workers should implement idempotency at the message level:

```typescript
const processMessage = async (message: { id: string; payload: unknown }) => {
  const security = new WebhookSecurity({ secretKey: secret });
  
  // Check if already processed
  const idempotency = security.checkIdempotency(message.id);
  if (idempotency.duplicate) {
    return { duplicate: true };
  }
  
  try {
    // Process message
    const result = await doWork(message.payload);
    security.markCompleted(message.id, result);
    return { result };
  } catch (error) {
    security.markFailed(message.id, error.message);
    throw error;
  }
};
```

## Security Checklist

- [ ] Signature verification enabled on all webhook endpoints
- [ ] Replay protection configured (5-minute tolerance)
- [ ] Idempotency storage in place (Redis recommended for production)
- [ ] HTTPS enforced for webhook endpoints
- [ ] Sensitive data redaction configured
- [ ] Audit logging for all webhook failures
- [ ] Monitoring/alerting for signature failures
- [ ] Regular secret rotation policy

## Testing

Run the webhook simulator to verify security:

```bash
# Test valid webhook
node scripts/webhook-simulator.js --secret mysecret

# Test duplicate handling
node scripts/webhook-simulator.js --secret mysecret --duplicates 5

# Test rejection scenarios
node scripts/webhook-simulator.js --secret mysecret --invalid-sig
node scripts/webhook-simulator.js --secret mysecret --stale
```

## Incident Response

If a webhook security event occurs:

1. **Signature Failure Spike**: Investigate potential replay attacks
   - Check timestamp patterns in logs
   - Verify provider retries are within tolerance
   - Review access logs for IP patterns

2. **Duplicate Processing**: Check idempotency configuration
   - Verify event IDs are being extracted correctly
   - Check idempotency store TTL configuration
   - Review business logic for side effects

3. **Replay Detected**: Blocked by timestamp check
   - Common during provider outages
   - Consider increasing tolerance for specific providers
   - Document allowed retry windows

## Compliance Notes

- **PCI-DSS**: Webhooks processing card data must have signature verification
- **SOC 2**: Audit logging required for all security events
- **GDPR**: Personal data in webhook payloads must be redacted in logs
