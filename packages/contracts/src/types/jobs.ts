import { z } from 'zod';
import { ErrorEnvelope, RetryPolicy } from '../errors/index.js';

export const JobId = z.string().uuid();
export type JobId = z.infer<typeof JobId>;

export const JobStatus = z.enum([
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'retrying',
]);
export type JobStatus = z.infer<typeof JobStatus>;

export const JobPriority = z.number().int().min(0).max(100).default(50);
export type JobPriority = z.infer<typeof JobPriority>;

export const JobMetadata = z.object({
  source: z.string(),
  userId: z.string().optional(),
  sessionId: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  causationId: z.string().uuid().optional(),
  tags: z.array(z.string()).default([]),
  createdAt: z.string().datetime(),
  scheduledAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
});
export type JobMetadata = z.infer<typeof JobMetadata>;

export const JobPayload = z.object({
  type: z.string(),
  version: z.string().default('1.0.0'),
  data: z.record(z.unknown()),
  options: z.record(z.unknown()).default({}),
});
export type JobPayload = z.infer<typeof JobPayload>;

export const JobRequest = z.object({
  id: JobId,
  type: z.string(),
  priority: JobPriority,
  payload: JobPayload,
  metadata: JobMetadata,
  retryPolicy: RetryPolicy.default({
    maxRetries: 3,
    backoffMs: 1000,
    maxBackoffMs: 30000,
    backoffMultiplier: 2,
    retryableCategories: [],
    nonRetryableCategories: [],
  }),
  timeoutMs: z.number().positive().default(30000),
});
export type JobRequest = z.infer<typeof JobRequest>;

export const JobResult = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: ErrorEnvelope.optional(),
  metadata: z.object({
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime(),
    durationMs: z.number().nonnegative(),
    attempts: z.number().int().positive().default(1),
    runnerId: z.string().optional(),
    runnerVersion: z.string().optional(),
  }),
});
export type JobResult = z.infer<typeof JobResult>;

export const JobResponse = z.object({
  id: JobId,
  status: JobStatus,
  request: JobRequest,
  result: JobResult.optional(),
  error: ErrorEnvelope.optional(),
  updatedAt: z.string().datetime(),
});
export type JobResponse = z.infer<typeof JobResponse>;

export const JobEventType = z.enum([
  'job.created',
  'job.queued',
  'job.started',
  'job.progress',
  'job.completed',
  'job.failed',
  'job.cancelled',
  'job.retrying',
  'job.expired',
]);
export type JobEventType = z.infer<typeof JobEventType>;

export const JobEvent = z.object({
  id: z.string().uuid(),
  type: JobEventType,
  jobId: JobId,
  timestamp: z.string().datetime(),
  data: z.record(z.unknown()).optional(),
  metadata: z.object({
    service: z.string(),
    version: z.string(),
  }),
});
export type JobEvent = z.infer<typeof JobEvent>;

export const QueueMessage = z.object({
  id: z.string().uuid(),
  jobId: JobId,
  payload: JobPayload,
  priority: JobPriority,
  attempts: z.number().int().nonnegative().default(0),
  maxAttempts: z.number().int().positive().default(3),
  createdAt: z.string().datetime(),
  availableAt: z.string().datetime(),
  expiresAt: z.string().datetime().optional(),
});
export type QueueMessage = z.infer<typeof QueueMessage>;
