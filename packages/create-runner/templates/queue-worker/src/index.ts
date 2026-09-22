import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import Redis from 'ioredis';
import {
  JobRequest,
  JobResponse,
  RunnerHeartbeat,
  HealthCheck,
  CONTRACT_VERSION_CURRENT,
  createErrorEnvelope,
} from '@controlplane/contracts';

const app = express();
app.use(express.json({ limit: '1mb' }));

type RequestWithId = Request & { requestId: string };

const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10);
const RATE_LIMIT_MAX = parseInt(process.env.RATE_LIMIT_MAX || '120', 10);
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function requestContext(req: Request, res: Response, next: NextFunction) {
  const requestId = req.header('x-request-id') ?? crypto.randomUUID();
  (req as RequestWithId).requestId = requestId;
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

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const RUNNER_ID = process.env.RUNNER_ID || crypto.randomUUID();
const PORT = parseInt(process.env.PORT || '3000', 10);
const JOBFORGE_URL = process.env.JOBFORGE_URL || 'http://localhost:8080';

// Job queue name
const QUEUE_NAME = process.env.QUEUE_NAME || 'jobs';

// Active jobs tracking
const activeJobs = new Map<string, { startedAt: number; job: JobRequest }>();

// Health check endpoint
app.get('/health', async (req, res) => {
  const health = HealthCheck.parse({
    service: '{{name}}',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '{{version}}',
    uptime: process.uptime(),
    checks: [
      {
        name: 'redis-connection',
        status: redis.status === 'ready' ? 'healthy' : 'degraded',
        responseTimeMs: 50,
      },
      {
        name: 'queue-availability',
        status: 'healthy',
        responseTimeMs: 25,
      },
    ],
  });

  res.json(health);
});

// Job execution endpoint
app.post('/execute', async (req, res) => {
  try {
    const job = JobRequest.parse(req.body);

    console.log(`[Job ${job.jobId}] Starting execution`, {
      requestId: (req as RequestWithId).requestId,
    });

    // Execute job
    const result = await executeJob(job);

    const response = JobResponse.parse({
      jobId: job.jobId,
      status: 'completed',
      result,
      executedAt: new Date().toISOString(),
      runnerId: RUNNER_ID,
      contractVersion: CONTRACT_VERSION_CURRENT,
    });

    console.log(`[Job ${job.jobId}] Completed successfully`, {
      requestId: (req as RequestWithId).requestId,
    });
    res.json(response);
  } catch (error) {
    console.error(`[Job ${req.body.jobId}] Execution failed:`, error, {
      requestId: (req as RequestWithId).requestId,
    });

    const errorEnvelope = createErrorEnvelope({
      category: 'RUNTIME_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      code: 'JOB_EXECUTION_FAILED',
    });

    res.status(500).json({
      jobId: req.body.jobId,
      status: 'failed',
      error: errorEnvelope,
      executedAt: new Date().toISOString(),
      runnerId: RUNNER_ID,
      contractVersion: CONTRACT_VERSION_CURRENT,
    });
  }
});

async function executeJob(job) {
  // Add to active jobs
  activeJobs.set(job.jobId, { startedAt: Date.now(), job });

  try {
    // Simulate job execution (replace with actual logic)
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return {
      processed: true,
      jobType: job.type,
      timestamp: new Date().toISOString(),
    };
  } finally {
    activeJobs.delete(job.jobId);
  }
}

// Heartbeat
async function sendHeartbeat() {
  try {
    const heartbeat = RunnerHeartbeat.parse({
      runnerId: RUNNER_ID,
      timestamp: new Date().toISOString(),
      status: 'healthy',
      activeJobs: activeJobs.size,
      queuedJobs: 0, // Could be fetched from Redis
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
    console.error('Heartbeat failed:', error.message);
  }
}

// Queue worker
async function processQueue() {
  while (true) {
    try {
      // Pop job from queue
      const result = await redis.brpop(QUEUE_NAME, 5);

      if (result) {
        const [, jobData] = result;
        const job = JSON.parse(jobData);

        console.log(`[Queue] Processing job: ${job.jobId}`);

        // Execute job
        await executeJob(job);

        // Acknowledge completion
        console.log(`[Queue] Job ${job.jobId} completed`);
      }
    } catch (error) {
      console.error('Queue processing error:', error);
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
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
    requestId: (req as RequestWithId).requestId,
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 {{name}} running on port ${PORT}`);
  console.log(`📋 Contract version: ${CONTRACT_VERSION_CURRENT}`);
  console.log(`🔗 Runner ID: ${RUNNER_ID}`);
  console.log(`📦 Queue: ${QUEUE_NAME}`);
});

// Send heartbeat every 30 seconds
setInterval(sendHeartbeat, 30000);

// Start queue worker
processQueue().catch(console.error);

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await redis.quit();
  process.exit(0);
});
