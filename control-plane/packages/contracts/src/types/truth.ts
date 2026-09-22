import { z } from 'zod';
import { ErrorEnvelope } from '../errors/index.js';

export const TruthValue = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
]);
export type TruthValue = z.infer<typeof TruthValue>;

export const TruthAssertion = z.object({
  id: z.string().uuid(),
  subject: z.string(),
  predicate: z.string(),
  object: TruthValue,
  confidence: z.number().min(0).max(1).default(1.0),
  timestamp: z.string().datetime(),
  source: z.string(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type TruthAssertion = z.infer<typeof TruthAssertion>;

export const TruthQuery = z.object({
  id: z.string().uuid(),
  pattern: z.object({
    subject: z.string().optional(),
    predicate: z.string().optional(),
    object: TruthValue.optional(),
  }),
  filters: z
    .object({
      minConfidence: z.number().min(0).max(1).default(0.0),
      sources: z.array(z.string()).optional(),
      before: z.string().datetime().optional(),
      after: z.string().datetime().optional(),
    })
    .default({}),
  limit: z.number().int().positive().default(100),
  offset: z.number().int().nonnegative().default(0),
});
export type TruthQuery = z.infer<typeof TruthQuery>;

export const TruthQueryResult = z.object({
  queryId: z.string().uuid(),
  assertions: z.array(TruthAssertion),
  totalCount: z.number().int().nonnegative(),
  hasMore: z.boolean().default(false),
  queryTimeMs: z.number().nonnegative(),
});
export type TruthQueryResult = z.infer<typeof TruthQueryResult>;

export const TruthSubscription = z.object({
  id: z.string().uuid(),
  pattern: z.object({
    subject: z.string().optional(),
    predicate: z.string().optional(),
    object: TruthValue.optional(),
  }),
  filters: z
    .object({
      minConfidence: z.number().min(0).max(1).default(0.0),
    })
    .default({}),
  webhookUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
});
export type TruthSubscription = z.infer<typeof TruthSubscription>;

export const TruthCoreRequest = z.object({
  id: z.string().uuid(),
  type: z.enum(['assert', 'query', 'subscribe', 'unsubscribe']),
  payload: z.record(z.unknown()),
  metadata: z.object({
    correlationId: z.string().uuid().optional(),
    source: z.string(),
    timestamp: z.string().datetime(),
  }),
});
export type TruthCoreRequest = z.infer<typeof TruthCoreRequest>;

export const TruthCoreResponse = z.object({
  requestId: z.string().uuid(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: ErrorEnvelope.optional(),
  timestamp: z.string().datetime(),
});
export type TruthCoreResponse = z.infer<typeof TruthCoreResponse>;

export const ConsistencyLevel = z.enum(['strict', 'eventual', 'best_effort']);
export type ConsistencyLevel = z.infer<typeof ConsistencyLevel>;
