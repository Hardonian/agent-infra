/**
 * {{name}} - Webhook Runner with Security Hardening
 *
 * This template demonstrates webhook security best practices:
 * - Signature verification (HMAC-SHA256)
 * - Idempotency (duplicate prevention)
 * - Replay protection (timestamp validation)
 * - Safe logging (sensitive data redaction)
 */

import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import crypto from 'node:crypto';
import {
  JobRequest,
  JobResponse,
  RunnerHeartbeat,
  HealthCheck,
  CONTRACT_VERSION_CURRENT,
  createErrorEnvelope,
} from '@controlplane/contracts';
import {
  WebhookSecurity,
  createWebhookHandler,
  CircuitBreaker,
  RetryPolicy,
} from '@controlplane/optimization-utils';

const app = express();

app.use(
  express.json({
    limit: '1mb',
    verify: (req: express.Request, _res, buf) => {
      (req as express.Request & { rawBody: string }).rawBody = buf.toString();
    },
  })
);

type RequestWithContext = express.Request & {
  requestId: string;
  rawBody: string;
  webhookContext?: {
    eventId: string;
    body: unknown;
  };
};

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || crypto.randomUUID().toString();
const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '120', 10);
const RATE_LIMIT_TOLERANCE_SECONDS = parseInt(
  process.env.RATE_LIMIT_TOLERANCE_SECONDS || '300',
  10
);

const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

const webhookSecurity = new WebhookSecurity({
  secretKey: WEBHOOK_SECRET,
  replayToleranceSeconds: RATE_LIMIT_TOLERANCE_SECONDS,
});

const circuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  resetTimeoutMs: 30000,
});

const retryPolicy = new RetryPolicy({
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
});

function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header('x-request-id') || crypto.randomUUID();
  (req as RequestWithContext).requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const durationMs = Date.now() - start;
    console.log(
      JSON.stringify({
        level: 'info',
        msg: 'request.completed',
        requestId,
        method: req.method,
        path: req.path,
        statusCode: res.statusCode,
        durationMs,
      })
    );
  });

  next();
}

function rateLimit(req: Request, res: Response, next: NextFunction) {
  const key = req.ip || 'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return next();
  }

  entry.count += 1;
  if (entry.count > RATE_LIMIT_MAX) {
    const errorEnvelope = createErrorEnvelope({
      category: 'RATE_LIMIT',
      message: 'Too many requests',
      code: 'RATE_LIMIT_EXCEEDED',
    });
    res.status(429).json(errorEnvelope);
    return;
  }

  return next();
}

app.use(requestContext);
app.use(rateLimit);

const RUNNER_ID = process.env.RUNNER_ID || crypto.randomUUID();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JOBFORGE_URL = process.env.JOBFORGE_URL || 'http://localhost:8080';

const activeJobs = new Map<string, { startedAt: number; job: JobRequest }>();

app.get('/health', async (req: Request, res: Response) => {
  try {
    const apiCheck = await checkExternalAPI();

    const health = HealthCheck.parse({
      service: 'webhook-runner',
      status: apiCheck.healthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      checks: [
        {
          name: 'external-api',
          status: apiCheck.healthy ? 'healthy' : 'degraded',
          responseTimeMs: apiCheck.responseTimeMs,
          message: apiCheck.message,
        },
        {
          name: 'jobforge-connection',
          status: 'healthy',
          responseTimeMs: 25,
        },
      ],
    });

    res.json(health);
  } catch (error) {
    res.json({
      service: 'webhook-runner',
      status: 'degraded',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      uptime: process.uptime(),
      checks: [
        {
          name: 'external-api',
          status: 'unhealthy',
          responseTimeMs: 0,
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      ],
    });
  }
});

async function checkExternalAPI(): Promise<{
  healthy: boolean;
  responseTimeMs: number;
  message: string;
}> {
  const start = Date.now();
  try {
    const response = await fetch(`${JOBFORGE_URL}/health`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    return {
      healthy: response.ok,
      responseTimeMs: Date.now() - start,
      message: response.ok ? 'API reachable' : `HTTP ${response.status}`,
    };
  } catch (error) {
    return {
      healthy: false,
      responseTimeMs: Date.now() - start,
      message: error instanceof Error ? error.message : 'Connection failed',
    };
  }
}

const handleWebhook = createWebhookHandler(webhookSecurity, async (context) => {
  const job = JobRequest.parse(context.body);

  console.log('[Job ' + job.jobId + '] Starting execution with webhook security', {
    eventId: context.eventId,
  });

  activeJobs.set(job.jobId, { startedAt: Date.now(), job });

  const result = await executeWithExternalAPI(job);

  const response = JobResponse.parse({
    jobId: job.jobId,
    status: 'completed',
    result,
    executedAt: new Date().toISOString(),
    runnerId: RUNNER_ID,
    contractVersion: CONTRACT_VERSION_CURRENT,
  });

  console.log('[Job ' + job.jobId + '] Completed successfully with idempotency', {
    eventId: context.eventId,
  });

  return response;
});

app.post('/webhook', async (req: Request, res: Response) => {
  const requestId = (req as RequestWithContext).requestId;

  try {
    const validation = await webhookSecurity.validateRequest({
      body: req.body,
      headers: req.headers as Record<string, string>,
      rawBody: (req as RequestWithContext).rawBody,
    });

    if (!validation.valid) {
      console.log(
        JSON.stringify(
          webhookSecurity.createErrorLogEntry(validation.context!, validation.error!, 'validation')
        )
      );

      return res.status(401).json({
        error: 'Webhook verification failed',
        message: validation.error,
        eventId: validation.context?.eventId,
      });
    }

    if (!validation.shouldProcess) {
      const record = webhookSecurity.getRecord(validation.context!.eventId);

      console.log(
        JSON.stringify(webhookSecurity.createDuplicateLogEntry(validation.context!, record!))
      );

      return res.status(200).json({
        ...record?.result,
        _duplicate: true,
        _originalProcessedAt: record?.processedAt.toISOString(),
      });
    }

    const result = await handleWebhook(validation.context!);

    res.status(200).json(result.result);
  } catch (error) {
    console.error('[Webhook] Processing failed:', error, { requestId });

    const errorEnvelope = createErrorEnvelope({
      category: 'RUNTIME_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'WEBHOOK_PROCESSING_FAILED',
    });

    res.status(500).json({
      error: errorEnvelope,
      requestId,
    });
  }
});

async function executeWithExternalAPI(job: JobRequest) {
  const start = Date.now();

  return circuitBreaker.execute(async () => {
    return retryPolicy.execute(async () => {
      const externalPayload = {
        requestId: job.jobId,
        action: job.type,
        data: job.payload,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch(`${JOBFORGE_URL}/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(externalPayload),
      });

      if (!response.ok) {
        throw new Error(
          'External API returned ' + response.status + ': ' + (await response.text())
        );
      }

      const externalResult = await response.json();

      return {
        success: true,
        externalResponse: externalResult,
        responseTimeMs: Date.now() - start,
        timestamp: new Date().toISOString(),
      };
    });
  });
}

async function sendHeartbeat() {
  try {
    const heartbeat = RunnerHeartbeat.parse({
      runnerId: RUNNER_ID,
      timestamp: new Date().toISOString(),
      status: 'healthy',
      activeJobs: activeJobs.size,
      queuedJobs: 0,
      metrics: {
        cpuUsage: 0,
        memoryUsage: 0,
        jobThroughput: 0,
      },
      contractVersion: CONTRACT_VERSION_CURRENT,
    });

    await fetch(`${JOBFORGE_URL}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(heartbeat),
    });
  } catch (error) {
    console.error('Heartbeat failed:', error instanceof Error ? error.message : 'Unknown error');
  }
}

app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  console.error('Unhandled error:', err);
  const errorEnvelope = createErrorEnvelope({
    category: 'RUNTIME_ERROR',
    message: err instanceof Error ? err.message : 'Unexpected error',
    code: 'UNHANDLED_EXCEPTION',
  });
  res.status(500).json({
    error: errorEnvelope,
    requestId: (req as RequestWithContext).requestId,
  });
});

app.listen(PORT, () => {
  console.log('Webhook runner running on port ' + PORT);
  console.log('Contract version: ' + CONTRACT_VERSION_CURRENT);
  console.log('Runner ID: ' + RUNNER_ID);
  console.log('Webhook security: ENABLED');
  console.log('Webhook secret: ' + WEBHOOK_SECRET.slice(0, 8) + '...');
});

setInterval(sendHeartbeat, 30000);

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  webhookSecurity.destroy();
  process.exit(0);
});
