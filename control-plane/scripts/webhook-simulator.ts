#!/usr/bin/env node
/**
 * Webhook Security Simulator
 *
 * A local simulator for testing webhook security features:
 * - Signature verification
 * - Idempotency handling
 * - Replay protection
 * - Duplicate request simulation
 *
 * Usage:
 *   node scripts/webhook-simulator.js --event <event-id> --secret <secret> [--duplicates <n>] [--delay <ms>]
 *
 * Examples:
 *   # Simulate a single valid webhook
 *   node scripts/webhook-simulator.js --event evt_123 --secret mysecret
 *
 *   # Simulate webhook with 5 duplicate deliveries
 *   node scripts/webhook-simulator.js --event evt_456 --secret mysecret --duplicates 5
 *
 *   # Simulate with 2 second delay between duplicates
 *   node scripts/webhook-simulator.js --event evt_789 --secret mysecret --duplicates 3 --delay 2000
 */

import crypto from 'node:crypto';
import http from 'node:http';
import { WebhookSecurity } from '../packages/optimization-utils/src/hardening/webhook.js';

const DEFAULT_PORT = 3001;
const DEFAULT_SECRET = 'test-webhook-secret';
const DEFAULT_DUPLICATES = 0;
const DEFAULT_DELAY = 100;
const DEFAULT_TIMESTAMP_AGE = 0;

interface SimulatorOptions {
  port: number;
  secret: string;
  duplicates: number;
  delay: number;
  timestampAge: number;
  staleTimestamp: boolean;
  invalidSignature: boolean;
  missingSignature: boolean;
  missingEventId: boolean;
  help: boolean;
}

function parseArgs(): SimulatorOptions {
  const args = process.argv.slice(2);
  const options: SimulatorOptions = {
    port: DEFAULT_PORT,
    secret: DEFAULT_SECRET,
    duplicates: DEFAULT_DUPLICATES,
    delay: DEFAULT_DELAY,
    timestampAge: DEFAULT_TIMESTAMP_AGE,
    staleTimestamp: false,
    invalidSignature: false,
    missingSignature: false,
    missingEventId: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--port':
      case '-p':
        options.port = parseInt(args[++i], 10);
        break;
      case '--secret':
      case '-s':
        options.secret = args[++i];
        break;
      case '--duplicates':
      case '-d':
        options.duplicates = parseInt(args[++i], 10);
        break;
      case '--delay':
      case '-D':
        options.delay = parseInt(args[++i], 10);
        break;
      case '--stale':
        options.staleTimestamp = true;
        break;
      case '--invalid-sig':
        options.invalidSignature = true;
        break;
      case '--no-sig':
        options.missingSignature = true;
        break;
      case '--no-event-id':
        options.missingEventId = true;
        break;
      case '--help':
      case '-h':
        options.help = true;
        break;
      default:
        if (!arg.startsWith('--')) {
          options.port = parseInt(arg, 10);
        }
    }
  }

  return options;
}

function printHelp() {
  console.log(`
Webhook Security Simulator
=========================

A local simulator for testing webhook security features.

Usage:
  node scripts/webhook-simulator.js [options]

Options:
  -p, --port <port>      Port to run simulator server (default: 3001)
  -s, --secret <secret>  Webhook signing secret (default: test-webhook-secret)
  -d, --duplicates <n>   Number of duplicate requests to simulate (default: 0)
  -D, --delay <ms>       Delay between duplicate requests in ms (default: 100)
  --stale                Use stale timestamp (outside tolerance window)
  --invalid-sig          Send invalid signature
  --no-sig               Omit signature header
  --no-event-id          Omit event ID header
  -h, --help             Show this help message

Examples:
  # Run simulator with signature verification
  node scripts/webhook-simulator.js --secret my-secret

  # Simulate 5 duplicate deliveries
  node scripts/webhook-simulator.js --secret my-secret --duplicates 5

  # Simulate with stale timestamp (should fail)
  node scripts/webhook-simulator.js --secret my-secret --stale

Features tested:
  ✓ Signature verification (valid/invalid/missing)
  ✓ Timestamp validation (fresh/stale)
  ✓ Idempotency (duplicate requests)
  ✓ Replay protection
  ✓ Safe logging (sensitive data redaction)
`);
}

interface TestResult {
  request: number;
  status: number;
  duplicate: boolean;
  processed: boolean;
  duration: number;
  error?: string;
}

async function runSimulator(options: SimulatorOptions): Promise<void> {
  console.log('\n=== Webhook Security Simulator ===\n');
  console.log(`Port:         ${options.port}`);
  console.log(`Secret:       ${options.secret.substring(0, 8)}...`);
  console.log(`Duplicates:   ${options.duplicates}`);
  console.log(`Delay:        ${options.delay}ms`);
  console.log(`Stale:        ${options.staleTimestamp}`);
  console.log(`Invalid Sig:  ${options.invalidSignature}`);
  console.log(`No Sig:       ${options.missingSignature}`);
  console.log(`No Event ID:  ${options.missingEventId}\n`);

  const webhookSecurity = new WebhookSecurity({
    secretKey: options.secret,
    replayToleranceSeconds: 300,
  });

  const eventId = options.missingEventId
    ? undefined
    : `evt_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`;
  const timestamp = options.staleTimestamp
    ? (Date.now() - 400 * 1000).toString() // 6+ minutes ago
    : Date.now().toString();

  const requestBody = {
    event: 'test.event',
    data: {
      id: 'test-123',
      amount: 100,
      currency: 'USD',
      sensitive_field: 'should-be-redacted-in-logs',
      password: 'secret123',
    },
    timestamp: new Date().toISOString(),
  };

  const rawBody = JSON.stringify(requestBody);

  const generateSignature = (sig: string | undefined): string | undefined => {
    if (options.missingSignature) return undefined;
    if (options.invalidSignature) return 'v1=invalid_signature_hex_value';

    const signedPayload = `${timestamp}.${rawBody}`;
    const hmac = crypto.createHmac('sha256', options.secret);
    hmac.update(signedPayload, 'utf8');
    return `v1=${hmac.digest('hex')}`;
  };

  const signature = generateSignature(undefined);

  const totalRequests = options.duplicates + 1;
  const results: TestResult[] = [];

  console.log(`\nSending ${totalRequests} webhook request(s)...\n`);

  for (let i = 0; i < totalRequests; i++) {
    const startTime = Date.now();

    const validation = await webhookSecurity.validateRequest({
      body: requestBody,
      headers: {
        'content-type': 'application/json',
        'x-webhook-signature': signature ?? '',
        'x-webhook-timestamp': timestamp,
        'x-webhook-event-id': eventId ?? '',
        'user-agent': 'WebhookSimulator/1.0',
      },
      rawBody,
    });

    const duration = Date.now() - startTime;

    let result: TestResult = {
      request: i + 1,
      status: validation.valid ? 200 : 401,
      duplicate: false,
      processed: validation.shouldProcess ?? false,
      duration,
    };

    if (validation.valid && validation.context) {
      const idempotency = webhookSecurity.checkIdempotency(validation.context.eventId);
      result.duplicate = idempotency.duplicate;

      if (idempotency.shouldProcess) {
        webhookSecurity.markCompleted(validation.context.eventId, {
          processed: true,
          requestNumber: i + 1,
        });
      }
    }

    if (!validation.valid) {
      result.error = validation.error;
    }

    results.push(result);

    console.log(`Request ${i + 1}/${totalRequests}:`);
    console.log(`  Status:    ${result.status}`);
    console.log(`  Duplicate: ${result.duplicate}`);
    console.log(`  Processed: ${result.processed}`);
    console.log(`  Duration:  ${result.duration}ms`);
    if (result.error) {
      console.log(`  Error:     ${result.error}`);
    }

    // Delay between duplicate requests
    if (i < totalRequests - 1 && options.delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, options.delay));
    }
  }

  console.log('\n=== Test Results Summary ===\n');

  const successful = results.filter((r) => r.status === 200).length;
  const duplicates = results.filter((r) => r.duplicate).length;
  const processed = results.filter((r) => r.processed).length;
  const failed = results.filter((r) => r.status !== 200).length;

  console.log(`Total Requests:  ${totalRequests}`);
  console.log(`Successful (2xx): ${successful}`);
  console.log(`Duplicates:      ${duplicates}`);
  console.log(`Processed:        ${processed}`);
  console.log(`Failed (4xx/5xx): ${failed}`);
  console.log(`\nIdempotency Stats:`);
  console.log(webhookSecurity.getStats());

  console.log('\n=== Expected Behavior ===\n');

  if (options.invalidSignature || options.missingSignature) {
    console.log('✗ Should reject: Invalid/missing signature');
  } else if (options.staleTimestamp) {
    console.log('✗ Should reject: Stale timestamp (replay protection)');
  } else if (options.duplicates > 0) {
    console.log(`✓ First request processes (request 1)`);
    console.log(`✓ ${options.duplicates} duplicate(s) detected and not re-processed`);
  } else {
    console.log('✓ Single valid request processed successfully');
  }

  console.log('\n=== Log Sample ===\n');

  if (results[0].status === 200) {
    const logEntry = webhookSecurity.createSafeLogEntry(
      results[0] as unknown as Parameters<typeof webhookSecurity.createSafeLogEntry>[0],
      {
        requestBody,
        password: 'secret123',
        apiKey: 'key-123',
      }
    );
    console.log(JSON.stringify(logEntry, null, 2));

    console.log('\nNotice: sensitive fields (password, apiKey) are redacted');
  }

  webhookSecurity.destroy();

  console.log('\n=== Simulator Complete ===\n');

  // Exit with appropriate code
  if (failed > 0 && !options.invalidSignature && !options.staleTimestamp) {
    process.exit(1);
  }
}

async function runServerMode(options: SimulatorOptions): Promise<void> {
  const webhookSecurity = new WebhookSecurity({
    secretKey: options.secret,
    replayToleranceSeconds: 300,
  });

  const server = http.createServer(async (req, res) => {
    const chunks: Buffer[] = [];

    req.on('data', (chunk) => chunks.push(chunk));

    req.on('end', async () => {
      const rawBody = Buffer.concat(chunks).toString();
      let body = {};

      try {
        body = JSON.parse(rawBody);
      } catch {
        // Ignore parse errors
      }

      const headers: Record<string, string> = {};
      for (let i = 0; i < req.rawHeaders.length; i += 2) {
        headers[req.rawHeaders[i].toLowerCase()] = req.rawHeaders[i + 1];
      }

      const validation = await webhookSecurity.validateRequest({
        body,
        headers,
        rawBody,
      });

      // Response headers
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('X-Webhook-Security', validation.valid ? 'verified' : 'failed');

      if (validation.context) {
        res.setHeader('X-Webhook-Event-ID', validation.context.eventId);
      }

      if (!validation.valid) {
        res.statusCode = 401;
        res.end(
          JSON.stringify({
            error: 'Webhook verification failed',
            message: validation.error,
          })
        );
        return;
      }

      if (!validation.shouldProcess) {
        const record = webhookSecurity.getRecord(validation.context!.eventId);
        if (record?.status === 'completed' && record.result) {
          res.setHeader('X-Webhook-Duplicate', 'true');
          res.statusCode = 200;
          res.end(
            JSON.stringify({
              ...record.result,
              _duplicate: true,
              _originalProcessedAt: record.processedAt.toISOString(),
            })
          );
          return;
        }
      }

      // Process the webhook (in real use, call business logic here)
      const result = {
        received: true,
        eventId: validation.context!.eventId,
        timestamp: new Date().toISOString(),
      };

      webhookSecurity.markCompleted(validation.context!.eventId, result);

      res.statusCode = 200;
      res.end(JSON.stringify(result));
    });
  });

  server.listen(options.port, () => {
    console.log(`\n=== Webhook Security Server ===`);
    console.log(`Listening on http://localhost:${options.port}`);
    console.log(`Webhook secret: ${options.secret.substring(0, 8)}...`);
    console.log(`\nEndpoints:`);
    console.log(`  POST /webhook  - Receive webhooks with security checks`);
    console.log(`  GET  /health   - Health check`);
    console.log(`  GET  /stats    - Idempotency statistics`);
    console.log(`\nPress Ctrl+C to stop\n`);
  });

  server.on('request', (req: http.IncomingMessage & { res?: http.ServerResponse }) => {
    if (req.url === '/health') {
      req.resume();
      req.on('end', () => {
        const res = req.res as http.ServerResponse;
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify({ status: 'healthy' }));
      });
    } else if (req.url === '/stats') {
      req.resume();
      req.on('end', () => {
        const res = req.res as http.ServerResponse;
        res.setHeader('Content-Type', 'application/json');
        res.statusCode = 200;
        res.end(JSON.stringify(webhookSecurity.getStats()));
      });
    }
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\nShutting down server...');
    webhookSecurity.destroy();
    server.close(() => {
      process.exit(0);
    });
  });
}

async function main(): Promise<void> {
  const options = parseArgs();

  if (options.help) {
    printHelp();
    return;
  }

  if (options.duplicates > 0 || options.invalidSignature || options.staleTimestamp) {
    await runSimulator(options);
  } else {
    await runServerMode(options);
  }
}

main().catch((err) => {
  console.error('Simulator error:', err);
  process.exit(1);
});
