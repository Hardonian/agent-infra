import { z } from 'zod';
import { ErrorEnvelope } from '../errors/index.js';

export const HealthStatus = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);
export type HealthStatus = z.infer<typeof HealthStatus>;

export const HealthCheck = z.object({
  service: z.string(),
  status: HealthStatus,
  timestamp: z.string().datetime(),
  version: z.string(),
  uptime: z.number().nonnegative(),
  checks: z
    .array(
      z.object({
        name: z.string(),
        status: HealthStatus,
        responseTimeMs: z.number().nonnegative(),
        message: z.string().optional(),
      })
    )
    .default([]),
});
export type HealthCheck = z.infer<typeof HealthCheck>;

export const ServiceMetadata = z.object({
  name: z.string(),
  version: z.string(),
  contractVersion: z.string(),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  startTime: z.string().datetime(),
  features: z.array(z.string()).default([]),
});
export type ServiceMetadata = z.infer<typeof ServiceMetadata>;

export const PaginatedRequest = z.object({
  limit: z.number().int().positive().max(1000).default(100),
  offset: z.number().int().nonnegative().default(0),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});
export type PaginatedRequest = z.infer<typeof PaginatedRequest>;

export const PaginatedResponse = z.object({
  items: z.array(z.unknown()),
  total: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  offset: z.number().int().nonnegative(),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});
export type PaginatedResponse = z.infer<typeof PaginatedResponse>;

export const ApiRequest = z.object({
  id: z.string().uuid(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  path: z.string(),
  headers: z.record(z.string()).default({}),
  query: z.record(z.unknown()).default({}),
  body: z.unknown(),
  metadata: z.object({
    correlationId: z.string().uuid().optional(),
    userId: z.string().optional(),
    timestamp: z.string().datetime(),
  }),
});
export type ApiRequest = z.infer<typeof ApiRequest>;

export const ApiResponse = z.object({
  requestId: z.string().uuid(),
  statusCode: z.number().int().min(100).max(599),
  headers: z.record(z.string()).default({}),
  body: z.unknown(),
  error: ErrorEnvelope.optional(),
  metadata: z.object({
    durationMs: z.number().nonnegative(),
    timestamp: z.string().datetime(),
  }),
});
export type ApiResponse = z.infer<typeof ApiResponse>;
