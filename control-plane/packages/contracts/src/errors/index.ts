import { z } from 'zod';
import { ContractVersion } from '../versioning/index.js';

export const ErrorSeverity = z.enum(['fatal', 'error', 'warning', 'info']);
export type ErrorSeverity = z.infer<typeof ErrorSeverity>;

export const ErrorCategory = z.enum([
  'VALIDATION_ERROR',
  'SCHEMA_MISMATCH',
  'RUNTIME_ERROR',
  'TIMEOUT',
  'NETWORK_ERROR',
  'AUTHENTICATION_ERROR',
  'AUTHORIZATION_ERROR',
  'RESOURCE_NOT_FOUND',
  'RESOURCE_CONFLICT',
  'RATE_LIMITED',
  'SERVICE_UNAVAILABLE',
  'RUNNER_ERROR',
  'TRUTHCORE_ERROR',
  'INTERNAL_ERROR',
]);
export type ErrorCategory = z.infer<typeof ErrorCategory>;

export const RetryPolicy = z.object({
  maxRetries: z.number().int().nonnegative().default(3),
  backoffMs: z.number().nonnegative().default(1000),
  maxBackoffMs: z.number().nonnegative().default(30000),
  backoffMultiplier: z.number().positive().default(2),
  retryableCategories: z
    .array(ErrorCategory)
    .default(['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'RUNTIME_ERROR']),
  nonRetryableCategories: z
    .array(ErrorCategory)
    .default([
      'VALIDATION_ERROR',
      'SCHEMA_MISMATCH',
      'AUTHENTICATION_ERROR',
      'AUTHORIZATION_ERROR',
      'RESOURCE_NOT_FOUND',
    ]),
});
export type RetryPolicy = z.infer<typeof RetryPolicy>;

export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 3,
  backoffMs: 1000,
  maxBackoffMs: 30000,
  backoffMultiplier: 2,
  retryableCategories: ['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'RUNTIME_ERROR'],
  nonRetryableCategories: [
    'VALIDATION_ERROR',
    'SCHEMA_MISMATCH',
    'AUTHENTICATION_ERROR',
    'AUTHORIZATION_ERROR',
    'RESOURCE_NOT_FOUND',
  ],
};

export const ErrorDetail = z.object({
  path: z.array(z.string()).optional(),
  message: z.string(),
  code: z.string().optional(),
  value: z.unknown().optional(),
});
export type ErrorDetail = z.infer<typeof ErrorDetail>;

export const ErrorEnvelope = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  category: ErrorCategory,
  severity: ErrorSeverity,
  code: z.string(),
  message: z.string(),
  details: z.array(ErrorDetail).default([]),
  service: z.string(),
  operation: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  causationId: z.string().uuid().optional(),
  retryable: z.boolean().default(false),
  retryAfter: z.number().nonnegative().optional(),
  contractVersion: ContractVersion,
});
export type ErrorEnvelope = z.infer<typeof ErrorEnvelope>;

export function createErrorEnvelope(
  params: Omit<ErrorEnvelope, 'id' | 'timestamp' | 'contractVersion'>
): ErrorEnvelope {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    contractVersion: { major: 1, minor: 0, patch: 0 },
    ...params,
  };
}

export function shouldRetry(
  error: ErrorEnvelope,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): boolean {
  if (!error.retryable) return false;
  if (policy.nonRetryableCategories.includes(error.category)) return false;
  if (policy.retryableCategories.includes(error.category)) return true;
  return error.severity !== 'fatal';
}

export function calculateRetryDelay(
  attempt: number,
  policy: RetryPolicy = DEFAULT_RETRY_POLICY
): number {
  const delay = policy.backoffMs * Math.pow(policy.backoffMultiplier, attempt);
  return Math.min(delay, policy.maxBackoffMs);
}
