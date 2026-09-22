// Auto-generated Zod schemas from ControlPlane contracts
// DO NOT EDIT MANUALLY - regenerate from source

import { z } from 'zod';

// ERRORS schemas

/**
 * Zod schema for ErrorSeverity
 * @category errors
 */
export const ErrorSeveritySchema = z.enum(['fatal', 'error', 'warning', 'info']);

/**
 * TypeScript type inferred from ErrorSeveritySchema
 */
export type ErrorSeverity = z.infer<typeof ErrorSeveritySchema>;

/**
 * Zod schema for ErrorCategory
 * @category errors
 */
export const ErrorCategorySchema = z.enum([
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

/**
 * TypeScript type inferred from ErrorCategorySchema
 */
export type ErrorCategory = z.infer<typeof ErrorCategorySchema>;

/**
 * Zod schema for RetryPolicy
 * @category errors
 */
export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).default(3),
  backoffMs: z.number().min(0).default(1000),
  maxBackoffMs: z.number().min(0).default(30000),
  backoffMultiplier: z.number().default(2),
  retryableCategories: z
    .array(
      z.enum([
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
      ])
    )
    .default(['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'RUNTIME_ERROR']),
  nonRetryableCategories: z
    .array(
      z.enum([
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
      ])
    )
    .default([
      'VALIDATION_ERROR',
      'SCHEMA_MISMATCH',
      'AUTHENTICATION_ERROR',
      'AUTHORIZATION_ERROR',
      'RESOURCE_NOT_FOUND',
    ]),
});

/**
 * TypeScript type inferred from RetryPolicySchema
 */
export type RetryPolicy = z.infer<typeof RetryPolicySchema>;

/**
 * Zod schema for ErrorDetail
 * @category errors
 */
export const ErrorDetailSchema = z.object({
  path: z.array(z.string()).optional(),
  message: z.string(),
  code: z.string().optional(),
  value: z.unknown().optional(),
});

/**
 * TypeScript type inferred from ErrorDetailSchema
 */
export type ErrorDetail = z.infer<typeof ErrorDetailSchema>;

/**
 * Zod schema for ErrorEnvelope
 * @category errors
 */
export const ErrorEnvelopeSchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  category: z.enum([
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
  ]),
  severity: z.enum(['fatal', 'error', 'warning', 'info']),
  code: z.string(),
  message: z.string(),
  details: z
    .array(
      z.object({
        path: z.array(z.string()).optional(),
        message: z.string(),
        code: z.string().optional(),
        value: z.unknown().optional(),
      })
    )
    .default([]),
  service: z.string(),
  operation: z.string().optional(),
  correlationId: z.string().uuid().optional(),
  causationId: z.string().uuid().optional(),
  retryable: z.boolean().default(false),
  retryAfter: z.number().min(0).optional(),
  contractVersion: z.object({
    major: z.number().int().min(0),
    minor: z.number().int().min(0),
    patch: z.number().int().min(0),
    preRelease: z.string().optional(),
  }),
});

/**
 * TypeScript type inferred from ErrorEnvelopeSchema
 */
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

// VERSIONING schemas

/**
 * Zod schema for ContractVersion
 * @category versioning
 */
export const ContractVersionSchema = z.object({
  major: z.number().int().min(0),
  minor: z.number().int().min(0),
  patch: z.number().int().min(0),
  preRelease: z.string().optional(),
});

/**
 * TypeScript type inferred from ContractVersionSchema
 */
export type ContractVersion = z.infer<typeof ContractVersionSchema>;

/**
 * Zod schema for ContractRange
 * @category versioning
 */
export const ContractRangeSchema = z.object({
  min: z.object({
    major: z.number().int().min(0),
    minor: z.number().int().min(0),
    patch: z.number().int().min(0),
    preRelease: z.string().optional(),
  }),
  max: z
    .object({
      major: z.number().int().min(0),
      minor: z.number().int().min(0),
      patch: z.number().int().min(0),
      preRelease: z.string().optional(),
    })
    .optional(),
  exact: z
    .object({
      major: z.number().int().min(0),
      minor: z.number().int().min(0),
      patch: z.number().int().min(0),
      preRelease: z.string().optional(),
    })
    .optional(),
});

/**
 * TypeScript type inferred from ContractRangeSchema
 */
export type ContractRange = z.infer<typeof ContractRangeSchema>;

// TYPES schemas

/**
 * Zod schema for JobId
 * @category types
 */
export const JobIdSchema = z.string().uuid();

/**
 * TypeScript type inferred from JobIdSchema
 */
export type JobId = z.infer<typeof JobIdSchema>;

/**
 * Zod schema for JobStatus
 * @category types
 */
export const JobStatusSchema = z.enum([
  'pending',
  'queued',
  'running',
  'completed',
  'failed',
  'cancelled',
  'retrying',
]);

/**
 * TypeScript type inferred from JobStatusSchema
 */
export type JobStatus = z.infer<typeof JobStatusSchema>;

/**
 * Zod schema for JobPriority
 * @category types
 */
export const JobPrioritySchema = z.number().int().min(0).max(100).default(50);

/**
 * TypeScript type inferred from JobPrioritySchema
 */
export type JobPriority = z.infer<typeof JobPrioritySchema>;

/**
 * Zod schema for JobMetadata
 * @category types
 */
export const JobMetadataSchema = z.object({
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

/**
 * TypeScript type inferred from JobMetadataSchema
 */
export type JobMetadata = z.infer<typeof JobMetadataSchema>;

/**
 * Zod schema for JobPayload
 * @category types
 */
export const JobPayloadSchema = z.object({
  type: z.string(),
  version: z.string().default('1.0.0'),
  data: z.record(z.unknown()),
  options: z.record(z.unknown()).default({}),
});

/**
 * TypeScript type inferred from JobPayloadSchema
 */
export type JobPayload = z.infer<typeof JobPayloadSchema>;

/**
 * Zod schema for JobRequest
 * @category types
 */
export const JobRequestSchema = z.object({
  id: z.string().uuid(),
  type: z.string(),
  priority: z.number().int().min(0).max(100).default(50),
  payload: z.object({
    type: z.string(),
    version: z.string().default('1.0.0'),
    data: z.record(z.unknown()),
    options: z.record(z.unknown()).default({}),
  }),
  metadata: z.object({
    source: z.string(),
    userId: z.string().optional(),
    sessionId: z.string().optional(),
    correlationId: z.string().uuid().optional(),
    causationId: z.string().uuid().optional(),
    tags: z.array(z.string()).default([]),
    createdAt: z.string().datetime(),
    scheduledAt: z.string().datetime().optional(),
    expiresAt: z.string().datetime().optional(),
  }),
  retryPolicy: z
    .object({
      maxRetries: z.number().int().min(0).default(3),
      backoffMs: z.number().min(0).default(1000),
      maxBackoffMs: z.number().min(0).default(30000),
      backoffMultiplier: z.number().default(2),
      retryableCategories: z
        .array(
          z.enum([
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
          ])
        )
        .default(['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'RUNTIME_ERROR']),
      nonRetryableCategories: z
        .array(
          z.enum([
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
          ])
        )
        .default([
          'VALIDATION_ERROR',
          'SCHEMA_MISMATCH',
          'AUTHENTICATION_ERROR',
          'AUTHORIZATION_ERROR',
          'RESOURCE_NOT_FOUND',
        ]),
    })
    .default({
      maxRetries: 3,
      backoffMs: 1000,
      maxBackoffMs: 30000,
      backoffMultiplier: 2,
      retryableCategories: [],
      nonRetryableCategories: [],
    }),
  timeoutMs: z.number().default(30000),
});

/**
 * TypeScript type inferred from JobRequestSchema
 */
export type JobRequest = z.infer<typeof JobRequestSchema>;

/**
 * Zod schema for JobResult
 * @category types
 */
export const JobResultSchema = z.object({
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      id: z.string().uuid(),
      timestamp: z.string().datetime(),
      category: z.enum([
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
      ]),
      severity: z.enum(['fatal', 'error', 'warning', 'info']),
      code: z.string(),
      message: z.string(),
      details: z
        .array(
          z.object({
            path: z.array(z.string()).optional(),
            message: z.string(),
            code: z.string().optional(),
            value: z.unknown().optional(),
          })
        )
        .default([]),
      service: z.string(),
      operation: z.string().optional(),
      correlationId: z.string().uuid().optional(),
      causationId: z.string().uuid().optional(),
      retryable: z.boolean().default(false),
      retryAfter: z.number().min(0).optional(),
      contractVersion: z.object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      }),
    })
    .optional(),
  metadata: z.object({
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime(),
    durationMs: z.number().min(0),
    attempts: z.number().int().default(1),
    runnerId: z.string().optional(),
    runnerVersion: z.string().optional(),
  }),
});

/**
 * TypeScript type inferred from JobResultSchema
 */
export type JobResult = z.infer<typeof JobResultSchema>;

/**
 * Zod schema for JobResponse
 * @category types
 */
export const JobResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['pending', 'queued', 'running', 'completed', 'failed', 'cancelled', 'retrying']),
  request: z.object({
    id: z.string().uuid(),
    type: z.string(),
    priority: z.number().int().min(0).max(100).default(50),
    payload: z.object({
      type: z.string(),
      version: z.string().default('1.0.0'),
      data: z.record(z.unknown()),
      options: z.record(z.unknown()).default({}),
    }),
    metadata: z.object({
      source: z.string(),
      userId: z.string().optional(),
      sessionId: z.string().optional(),
      correlationId: z.string().uuid().optional(),
      causationId: z.string().uuid().optional(),
      tags: z.array(z.string()).default([]),
      createdAt: z.string().datetime(),
      scheduledAt: z.string().datetime().optional(),
      expiresAt: z.string().datetime().optional(),
    }),
    retryPolicy: z
      .object({
        maxRetries: z.number().int().min(0).default(3),
        backoffMs: z.number().min(0).default(1000),
        maxBackoffMs: z.number().min(0).default(30000),
        backoffMultiplier: z.number().default(2),
        retryableCategories: z
          .array(
            z.enum([
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
            ])
          )
          .default(['TIMEOUT', 'NETWORK_ERROR', 'SERVICE_UNAVAILABLE', 'RUNTIME_ERROR']),
        nonRetryableCategories: z
          .array(
            z.enum([
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
            ])
          )
          .default([
            'VALIDATION_ERROR',
            'SCHEMA_MISMATCH',
            'AUTHENTICATION_ERROR',
            'AUTHORIZATION_ERROR',
            'RESOURCE_NOT_FOUND',
          ]),
      })
      .default({
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
        backoffMultiplier: 2,
        retryableCategories: [],
        nonRetryableCategories: [],
      }),
    timeoutMs: z.number().default(30000),
  }),
  result: z
    .object({
      success: z.boolean(),
      data: z.unknown().optional(),
      error: z
        .object({
          id: z.string().uuid(),
          timestamp: z.string().datetime(),
          category: z.enum([
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
          ]),
          severity: z.enum(['fatal', 'error', 'warning', 'info']),
          code: z.string(),
          message: z.string(),
          details: z
            .array(
              z.object({
                path: z.array(z.string()).optional(),
                message: z.string(),
                code: z.string().optional(),
                value: z.unknown().optional(),
              })
            )
            .default([]),
          service: z.string(),
          operation: z.string().optional(),
          correlationId: z.string().uuid().optional(),
          causationId: z.string().uuid().optional(),
          retryable: z.boolean().default(false),
          retryAfter: z.number().min(0).optional(),
          contractVersion: z.object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          }),
        })
        .optional(),
      metadata: z.object({
        startedAt: z.string().datetime().optional(),
        completedAt: z.string().datetime(),
        durationMs: z.number().min(0),
        attempts: z.number().int().default(1),
        runnerId: z.string().optional(),
        runnerVersion: z.string().optional(),
      }),
    })
    .optional(),
  error: z
    .object({
      id: z.string().uuid(),
      timestamp: z.string().datetime(),
      category: z.enum([
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
      ]),
      severity: z.enum(['fatal', 'error', 'warning', 'info']),
      code: z.string(),
      message: z.string(),
      details: z
        .array(
          z.object({
            path: z.array(z.string()).optional(),
            message: z.string(),
            code: z.string().optional(),
            value: z.unknown().optional(),
          })
        )
        .default([]),
      service: z.string(),
      operation: z.string().optional(),
      correlationId: z.string().uuid().optional(),
      causationId: z.string().uuid().optional(),
      retryable: z.boolean().default(false),
      retryAfter: z.number().min(0).optional(),
      contractVersion: z.object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      }),
    })
    .optional(),
  updatedAt: z.string().datetime(),
});

/**
 * TypeScript type inferred from JobResponseSchema
 */
export type JobResponse = z.infer<typeof JobResponseSchema>;

/**
 * Zod schema for RunnerCapability
 * @category types
 */
export const RunnerCapabilitySchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  supportedJobTypes: z.array(z.string()),
  maxConcurrency: z.number().int().default(1),
  timeoutMs: z.number().default(30000),
  resourceRequirements: z
    .object({
      cpu: z.string().optional(),
      memory: z.string().optional(),
      gpu: z.boolean().default(false),
    })
    .default({}),
});

/**
 * TypeScript type inferred from RunnerCapabilitySchema
 */
export type RunnerCapability = z.infer<typeof RunnerCapabilitySchema>;

/**
 * Zod schema for RunnerMetadata
 * @category types
 */
export const RunnerMetadataSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  version: z.string(),
  contractVersion: z.object({
    major: z.number().int().min(0),
    minor: z.number().int().min(0),
    patch: z.number().int().min(0),
    preRelease: z.string().optional(),
  }),
  capabilities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      description: z.string(),
      inputSchema: z.record(z.unknown()),
      outputSchema: z.record(z.unknown()),
      supportedJobTypes: z.array(z.string()),
      maxConcurrency: z.number().int().default(1),
      timeoutMs: z.number().default(30000),
      resourceRequirements: z
        .object({
          cpu: z.string().optional(),
          memory: z.string().optional(),
          gpu: z.boolean().default(false),
        })
        .default({}),
    })
  ),
  supportedContracts: z.array(z.string()),
  healthCheckEndpoint: z.string().url(),
  registeredAt: z.string().datetime(),
  lastHeartbeatAt: z.string().datetime(),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']).default('healthy'),
  tags: z.array(z.string()).default([]),
});

/**
 * TypeScript type inferred from RunnerMetadataSchema
 */
export type RunnerMetadata = z.infer<typeof RunnerMetadataSchema>;

/**
 * Zod schema for RunnerRegistrationRequest
 * @category types
 */
export const RunnerRegistrationRequestSchema = z.object({
  name: z.string(),
  version: z.string(),
  contractVersion: z.object({
    major: z.number().int().min(0),
    minor: z.number().int().min(0),
    patch: z.number().int().min(0),
    preRelease: z.string().optional(),
  }),
  capabilities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      description: z.string(),
      inputSchema: z.record(z.unknown()),
      outputSchema: z.record(z.unknown()),
      supportedJobTypes: z.array(z.string()),
      maxConcurrency: z.number().int().default(1),
      timeoutMs: z.number().default(30000),
      resourceRequirements: z
        .object({
          cpu: z.string().optional(),
          memory: z.string().optional(),
          gpu: z.boolean().default(false),
        })
        .default({}),
    })
  ),
  healthCheckEndpoint: z.string().url(),
  tags: z.array(z.string()).default([]),
});

/**
 * TypeScript type inferred from RunnerRegistrationRequestSchema
 */
export type RunnerRegistrationRequest = z.infer<typeof RunnerRegistrationRequestSchema>;

/**
 * Zod schema for RunnerRegistrationResponse
 * @category types
 */
export const RunnerRegistrationResponseSchema = z.object({
  runnerId: z.string().uuid(),
  registeredAt: z.string().datetime(),
  heartbeatIntervalMs: z.number().default(30000),
});

/**
 * TypeScript type inferred from RunnerRegistrationResponseSchema
 */
export type RunnerRegistrationResponse = z.infer<typeof RunnerRegistrationResponseSchema>;

/**
 * Zod schema for RunnerHeartbeat
 * @category types
 */
export const RunnerHeartbeatSchema = z.object({
  runnerId: z.string().uuid(),
  timestamp: z.string().datetime(),
  status: z.enum(['healthy', 'degraded', 'unhealthy']),
  activeJobs: z.number().int().min(0).default(0),
  queuedJobs: z.number().int().min(0).default(0),
  metrics: z
    .object({
      cpuUsage: z.number().min(0).max(100).optional(),
      memoryUsage: z.number().min(0).max(100).optional(),
      jobThroughput: z.number().min(0).optional(),
    })
    .default({}),
});

/**
 * TypeScript type inferred from RunnerHeartbeatSchema
 */
export type RunnerHeartbeat = z.infer<typeof RunnerHeartbeatSchema>;

/**
 * Zod schema for ModuleManifest
 * @category types
 */
export const ModuleManifestSchema = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  entryPoint: z.string(),
  contractVersion: z.object({
    major: z.number().int().min(0),
    minor: z.number().int().min(0),
    patch: z.number().int().min(0),
    preRelease: z.string().optional(),
  }),
  capabilities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      description: z.string(),
      inputSchema: z.record(z.unknown()),
      outputSchema: z.record(z.unknown()),
      supportedJobTypes: z.array(z.string()),
      maxConcurrency: z.number().int().default(1),
      timeoutMs: z.number().default(30000),
      resourceRequirements: z
        .object({
          cpu: z.string().optional(),
          memory: z.string().optional(),
          gpu: z.boolean().default(false),
        })
        .default({}),
    })
  ),
  dependencies: z.array(z.string()).default([]),
  configSchema: z.record(z.unknown()).optional(),
  defaultConfig: z.record(z.unknown()).default({}),
});

/**
 * TypeScript type inferred from ModuleManifestSchema
 */
export type ModuleManifest = z.infer<typeof ModuleManifestSchema>;

/**
 * Zod schema for RunnerExecutionRequest
 * @category types
 */
export const RunnerExecutionRequestSchema = z.object({
  jobId: z.string().uuid(),
  moduleId: z.string(),
  capabilityId: z.string(),
  payload: z.record(z.unknown()),
  timeoutMs: z.number().default(30000),
  metadata: z
    .object({
      correlationId: z.string().uuid().optional(),
      userId: z.string().optional(),
    })
    .default({}),
});

/**
 * TypeScript type inferred from RunnerExecutionRequestSchema
 */
export type RunnerExecutionRequest = z.infer<typeof RunnerExecutionRequestSchema>;

/**
 * Zod schema for RunnerExecutionResponse
 * @category types
 */
export const RunnerExecutionResponseSchema = z.object({
  jobId: z.string().uuid(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      id: z.string().uuid(),
      timestamp: z.string().datetime(),
      category: z.enum([
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
      ]),
      severity: z.enum(['fatal', 'error', 'warning', 'info']),
      code: z.string(),
      message: z.string(),
      details: z
        .array(
          z.object({
            path: z.array(z.string()).optional(),
            message: z.string(),
            code: z.string().optional(),
            value: z.unknown().optional(),
          })
        )
        .default([]),
      service: z.string(),
      operation: z.string().optional(),
      correlationId: z.string().uuid().optional(),
      causationId: z.string().uuid().optional(),
      retryable: z.boolean().default(false),
      retryAfter: z.number().min(0).optional(),
      contractVersion: z.object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      }),
    })
    .optional(),
  executionTimeMs: z.number().min(0),
  runnerId: z.string().uuid(),
});

/**
 * TypeScript type inferred from RunnerExecutionResponseSchema
 */
export type RunnerExecutionResponse = z.infer<typeof RunnerExecutionResponseSchema>;

/**
 * Zod schema for TruthAssertion
 * @category types
 */
export const TruthAssertionSchema = z.object({
  id: z.string().uuid(),
  subject: z.string(),
  predicate: z.string(),
  object: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(z.unknown()),
    z.record(z.unknown()),
  ]),
  confidence: z.number().min(0).max(1).default(1),
  timestamp: z.string().datetime(),
  source: z.string(),
  expiresAt: z.string().datetime().optional(),
  metadata: z.record(z.unknown()).default({}),
});

/**
 * TypeScript type inferred from TruthAssertionSchema
 */
export type TruthAssertion = z.infer<typeof TruthAssertionSchema>;

/**
 * Zod schema for TruthQuery
 * @category types
 */
export const TruthQuerySchema = z.object({
  id: z.string().uuid(),
  pattern: z.object({
    subject: z.string().optional(),
    predicate: z.string().optional(),
    object: z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.unknown()),
        z.record(z.unknown()),
      ])
      .optional(),
  }),
  filters: z
    .object({
      minConfidence: z.number().min(0).max(1).default(0),
      sources: z.array(z.string()).optional(),
      before: z.string().datetime().optional(),
      after: z.string().datetime().optional(),
    })
    .default({}),
  limit: z.number().int().default(100),
  offset: z.number().int().min(0).default(0),
});

/**
 * TypeScript type inferred from TruthQuerySchema
 */
export type TruthQuery = z.infer<typeof TruthQuerySchema>;

/**
 * Zod schema for TruthQueryResult
 * @category types
 */
export const TruthQueryResultSchema = z.object({
  queryId: z.string().uuid(),
  assertions: z.array(
    z.object({
      id: z.string().uuid(),
      subject: z.string(),
      predicate: z.string(),
      object: z.union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.unknown()),
        z.record(z.unknown()),
      ]),
      confidence: z.number().min(0).max(1).default(1),
      timestamp: z.string().datetime(),
      source: z.string(),
      expiresAt: z.string().datetime().optional(),
      metadata: z.record(z.unknown()).default({}),
    })
  ),
  totalCount: z.number().int().min(0),
  hasMore: z.boolean().default(false),
  queryTimeMs: z.number().min(0),
});

/**
 * TypeScript type inferred from TruthQueryResultSchema
 */
export type TruthQueryResult = z.infer<typeof TruthQueryResultSchema>;

/**
 * Zod schema for TruthSubscription
 * @category types
 */
export const TruthSubscriptionSchema = z.object({
  id: z.string().uuid(),
  pattern: z.object({
    subject: z.string().optional(),
    predicate: z.string().optional(),
    object: z
      .union([
        z.string(),
        z.number(),
        z.boolean(),
        z.null(),
        z.array(z.unknown()),
        z.record(z.unknown()),
      ])
      .optional(),
  }),
  filters: z
    .object({
      minConfidence: z.number().min(0).max(1).default(0),
    })
    .default({}),
  webhookUrl: z.string().url().optional(),
  createdAt: z.string().datetime(),
});

/**
 * TypeScript type inferred from TruthSubscriptionSchema
 */
export type TruthSubscription = z.infer<typeof TruthSubscriptionSchema>;

/**
 * Zod schema for TruthCoreRequest
 * @category types
 */
export const TruthCoreRequestSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['assert', 'query', 'subscribe', 'unsubscribe']),
  payload: z.record(z.unknown()),
  metadata: z.object({
    correlationId: z.string().uuid().optional(),
    source: z.string(),
    timestamp: z.string().datetime(),
  }),
});

/**
 * TypeScript type inferred from TruthCoreRequestSchema
 */
export type TruthCoreRequest = z.infer<typeof TruthCoreRequestSchema>;

/**
 * Zod schema for TruthCoreResponse
 * @category types
 */
export const TruthCoreResponseSchema = z.object({
  requestId: z.string().uuid(),
  success: z.boolean(),
  data: z.unknown().optional(),
  error: z
    .object({
      id: z.string().uuid(),
      timestamp: z.string().datetime(),
      category: z.enum([
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
      ]),
      severity: z.enum(['fatal', 'error', 'warning', 'info']),
      code: z.string(),
      message: z.string(),
      details: z
        .array(
          z.object({
            path: z.array(z.string()).optional(),
            message: z.string(),
            code: z.string().optional(),
            value: z.unknown().optional(),
          })
        )
        .default([]),
      service: z.string(),
      operation: z.string().optional(),
      correlationId: z.string().uuid().optional(),
      causationId: z.string().uuid().optional(),
      retryable: z.boolean().default(false),
      retryAfter: z.number().min(0).optional(),
      contractVersion: z.object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      }),
    })
    .optional(),
  timestamp: z.string().datetime(),
});

/**
 * TypeScript type inferred from TruthCoreResponseSchema
 */
export type TruthCoreResponse = z.infer<typeof TruthCoreResponseSchema>;

/**
 * Zod schema for ConsistencyLevel
 * @category types
 */
export const ConsistencyLevelSchema = z.enum(['strict', 'eventual', 'best_effort']);

/**
 * TypeScript type inferred from ConsistencyLevelSchema
 */
export type ConsistencyLevel = z.infer<typeof ConsistencyLevelSchema>;

/**
 * Zod schema for TruthValue
 * @category types
 */
export const TruthValueSchema = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
  z.array(z.unknown()),
  z.record(z.unknown()),
]);

/**
 * TypeScript type inferred from TruthValueSchema
 */
export type TruthValue = z.infer<typeof TruthValueSchema>;

/**
 * Zod schema for HealthStatus
 * @category types
 */
export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']);

/**
 * TypeScript type inferred from HealthStatusSchema
 */
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

/**
 * Zod schema for HealthCheck
 * @category types
 */
export const HealthCheckSchema = z.object({
  service: z.string(),
  status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
  timestamp: z.string().datetime(),
  version: z.string(),
  uptime: z.number().min(0),
  checks: z
    .array(
      z.object({
        name: z.string(),
        status: z.enum(['healthy', 'degraded', 'unhealthy', 'unknown']),
        responseTimeMs: z.number().min(0),
        message: z.string().optional(),
      })
    )
    .default([]),
});

/**
 * TypeScript type inferred from HealthCheckSchema
 */
export type HealthCheck = z.infer<typeof HealthCheckSchema>;

/**
 * Zod schema for ServiceMetadata
 * @category types
 */
export const ServiceMetadataSchema = z.object({
  name: z.string(),
  version: z.string(),
  contractVersion: z.string(),
  environment: z.enum(['development', 'staging', 'production']).default('development'),
  startTime: z.string().datetime(),
  features: z.array(z.string()).default([]),
});

/**
 * TypeScript type inferred from ServiceMetadataSchema
 */
export type ServiceMetadata = z.infer<typeof ServiceMetadataSchema>;

/**
 * Zod schema for PaginatedRequest
 * @category types
 */
export const PaginatedRequestSchema = z.object({
  limit: z.number().int().max(1000).default(100),
  offset: z.number().int().min(0).default(0),
  cursor: z.string().optional(),
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

/**
 * TypeScript type inferred from PaginatedRequestSchema
 */
export type PaginatedRequest = z.infer<typeof PaginatedRequestSchema>;

/**
 * Zod schema for PaginatedResponse
 * @category types
 */
export const PaginatedResponseSchema = z.object({
  items: z.array(z.unknown()),
  total: z.number().int().min(0),
  limit: z.number().int(),
  offset: z.number().int().min(0),
  hasMore: z.boolean(),
  nextCursor: z.string().optional(),
});

/**
 * TypeScript type inferred from PaginatedResponseSchema
 */
export type PaginatedResponse = z.infer<typeof PaginatedResponseSchema>;

/**
 * Zod schema for ApiRequest
 * @category types
 */
export const ApiRequestSchema = z.object({
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

/**
 * TypeScript type inferred from ApiRequestSchema
 */
export type ApiRequest = z.infer<typeof ApiRequestSchema>;

/**
 * Zod schema for ApiResponse
 * @category types
 */
export const ApiResponseSchema = z.object({
  requestId: z.string().uuid(),
  statusCode: z.number().int().min(100).max(599),
  headers: z.record(z.string()).default({}),
  body: z.unknown(),
  error: z
    .object({
      id: z.string().uuid(),
      timestamp: z.string().datetime(),
      category: z.enum([
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
      ]),
      severity: z.enum(['fatal', 'error', 'warning', 'info']),
      code: z.string(),
      message: z.string(),
      details: z
        .array(
          z.object({
            path: z.array(z.string()).optional(),
            message: z.string(),
            code: z.string().optional(),
            value: z.unknown().optional(),
          })
        )
        .default([]),
      service: z.string(),
      operation: z.string().optional(),
      correlationId: z.string().uuid().optional(),
      causationId: z.string().uuid().optional(),
      retryable: z.boolean().default(false),
      retryAfter: z.number().min(0).optional(),
      contractVersion: z.object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      }),
    })
    .optional(),
  metadata: z.object({
    durationMs: z.number().min(0),
    timestamp: z.string().datetime(),
  }),
});

/**
 * TypeScript type inferred from ApiResponseSchema
 */
export type ApiResponse = z.infer<typeof ApiResponseSchema>;

/**
 * Zod schema for CapabilityRegistry
 * @category types
 */
export const CapabilityRegistrySchema = z.object({
  version: z.string(),
  generatedAt: z.string().datetime(),
  system: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
  }),
  truthcore: z.object({
    contractVersion: z.object({
      major: z.number().int().min(0),
      minor: z.number().int().min(0),
      patch: z.number().int().min(0),
      preRelease: z.string().optional(),
    }),
    supportedVersions: z.object({
      min: z.object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      }),
      max: z
        .object({
          major: z.number().int().min(0),
          minor: z.number().int().min(0),
          patch: z.number().int().min(0),
          preRelease: z.string().optional(),
        })
        .optional(),
      exact: z
        .object({
          major: z.number().int().min(0),
          minor: z.number().int().min(0),
          patch: z.number().int().min(0),
          preRelease: z.string().optional(),
        })
        .optional(),
    }),
    features: z.array(z.string()).default([]),
    breakingChanges: z.array(z.string()).default([]),
    deprecatedFeatures: z.array(z.string()).default([]),
  }),
  runners: z.array(
    z.object({
      metadata: z.object({
        id: z.string().uuid(),
        name: z.string(),
        version: z.string(),
        contractVersion: z.object({
          major: z.number().int().min(0),
          minor: z.number().int().min(0),
          patch: z.number().int().min(0),
          preRelease: z.string().optional(),
        }),
        capabilities: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            version: z.string(),
            description: z.string(),
            inputSchema: z.record(z.unknown()),
            outputSchema: z.record(z.unknown()),
            supportedJobTypes: z.array(z.string()),
            maxConcurrency: z.number().int().default(1),
            timeoutMs: z.number().default(30000),
            resourceRequirements: z
              .object({
                cpu: z.string().optional(),
                memory: z.string().optional(),
                gpu: z.boolean().default(false),
              })
              .default({}),
          })
        ),
        supportedContracts: z.array(z.string()),
        healthCheckEndpoint: z.string().url(),
        registeredAt: z.string().datetime(),
        lastHeartbeatAt: z.string().datetime(),
        status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']).default('healthy'),
        tags: z.array(z.string()).default([]),
      }),
      category: z.enum([
        'ops',
        'finops',
        'support',
        'growth',
        'analytics',
        'security',
        'infrastructure',
        'custom',
      ]),
      connectors: z.array(z.string()),
      health: z.object({
        status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']),
        lastHeartbeat: z.string().datetime().optional(),
        activeJobs: z.number().int().min(0).default(0),
        queuedJobs: z.number().int().min(0).default(0),
      }),
      capabilities: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          version: z.string(),
          description: z.string(),
          inputSchema: z.record(z.unknown()),
          outputSchema: z.record(z.unknown()),
          supportedJobTypes: z.array(z.string()),
          maxConcurrency: z.number().int().default(1),
          timeoutMs: z.number().default(30000),
          resourceRequirements: z
            .object({
              cpu: z.string().optional(),
              memory: z.string().optional(),
              gpu: z.boolean().default(false),
            })
            .default({}),
        })
      ),
    })
  ),
  connectors: z.array(
    z.object({
      config: z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum([
          'database',
          'queue',
          'storage',
          'api',
          'webhook',
          'stream',
          'cache',
          'messaging',
        ]),
        version: z.string(),
        description: z.string(),
        configSchema: z.record(z.unknown()),
        required: z.boolean().default(false),
        healthCheckable: z.boolean().default(true),
      }),
      status: z.enum(['connected', 'disconnected', 'error', 'unknown']),
      lastConnectedAt: z.string().datetime().optional(),
      lastErrorAt: z.string().datetime().optional(),
      errorMessage: z.string().optional(),
      metadata: z.record(z.unknown()).default({}),
    })
  ),
  summary: z.object({
    totalRunners: z.number().int().min(0),
    totalCapabilities: z.number().int().min(0),
    totalConnectors: z.number().int().min(0),
    healthyRunners: z.number().int().min(0),
    healthyConnectors: z.number().int().min(0),
    categories: z.record(z.number().int().min(0)),
  }),
});

/**
 * TypeScript type inferred from CapabilityRegistrySchema
 */
export type CapabilityRegistry = z.infer<typeof CapabilityRegistrySchema>;

/**
 * Zod schema for RegisteredRunner
 * @category types
 */
export const RegisteredRunnerSchema = z.object({
  metadata: z.object({
    id: z.string().uuid(),
    name: z.string(),
    version: z.string(),
    contractVersion: z.object({
      major: z.number().int().min(0),
      minor: z.number().int().min(0),
      patch: z.number().int().min(0),
      preRelease: z.string().optional(),
    }),
    capabilities: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        version: z.string(),
        description: z.string(),
        inputSchema: z.record(z.unknown()),
        outputSchema: z.record(z.unknown()),
        supportedJobTypes: z.array(z.string()),
        maxConcurrency: z.number().int().default(1),
        timeoutMs: z.number().default(30000),
        resourceRequirements: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
            gpu: z.boolean().default(false),
          })
          .default({}),
      })
    ),
    supportedContracts: z.array(z.string()),
    healthCheckEndpoint: z.string().url(),
    registeredAt: z.string().datetime(),
    lastHeartbeatAt: z.string().datetime(),
    status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']).default('healthy'),
    tags: z.array(z.string()).default([]),
  }),
  category: z.enum([
    'ops',
    'finops',
    'support',
    'growth',
    'analytics',
    'security',
    'infrastructure',
    'custom',
  ]),
  connectors: z.array(z.string()),
  health: z.object({
    status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']),
    lastHeartbeat: z.string().datetime().optional(),
    activeJobs: z.number().int().min(0).default(0),
    queuedJobs: z.number().int().min(0).default(0),
  }),
  capabilities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      description: z.string(),
      inputSchema: z.record(z.unknown()),
      outputSchema: z.record(z.unknown()),
      supportedJobTypes: z.array(z.string()),
      maxConcurrency: z.number().int().default(1),
      timeoutMs: z.number().default(30000),
      resourceRequirements: z
        .object({
          cpu: z.string().optional(),
          memory: z.string().optional(),
          gpu: z.boolean().default(false),
        })
        .default({}),
    })
  ),
});

/**
 * TypeScript type inferred from RegisteredRunnerSchema
 */
export type RegisteredRunner = z.infer<typeof RegisteredRunnerSchema>;

/**
 * Zod schema for ConnectorConfig
 * @category types
 */
export const ConnectorConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.enum(['database', 'queue', 'storage', 'api', 'webhook', 'stream', 'cache', 'messaging']),
  version: z.string(),
  description: z.string(),
  configSchema: z.record(z.unknown()),
  required: z.boolean().default(false),
  healthCheckable: z.boolean().default(true),
});

/**
 * TypeScript type inferred from ConnectorConfigSchema
 */
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;

/**
 * Zod schema for ConnectorType
 * @category types
 */
export const ConnectorTypeSchema = z.enum([
  'database',
  'queue',
  'storage',
  'api',
  'webhook',
  'stream',
  'cache',
  'messaging',
]);

/**
 * TypeScript type inferred from ConnectorTypeSchema
 */
export type ConnectorType = z.infer<typeof ConnectorTypeSchema>;

/**
 * Zod schema for ConnectorInstance
 * @category types
 */
export const ConnectorInstanceSchema = z.object({
  config: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum([
      'database',
      'queue',
      'storage',
      'api',
      'webhook',
      'stream',
      'cache',
      'messaging',
    ]),
    version: z.string(),
    description: z.string(),
    configSchema: z.record(z.unknown()),
    required: z.boolean().default(false),
    healthCheckable: z.boolean().default(true),
  }),
  status: z.enum(['connected', 'disconnected', 'error', 'unknown']),
  lastConnectedAt: z.string().datetime().optional(),
  lastErrorAt: z.string().datetime().optional(),
  errorMessage: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});

/**
 * TypeScript type inferred from ConnectorInstanceSchema
 */
export type ConnectorInstance = z.infer<typeof ConnectorInstanceSchema>;

/**
 * Zod schema for RunnerCategory
 * @category types
 */
export const RunnerCategorySchema = z.enum([
  'ops',
  'finops',
  'support',
  'growth',
  'analytics',
  'security',
  'infrastructure',
  'custom',
]);

/**
 * TypeScript type inferred from RunnerCategorySchema
 */
export type RunnerCategory = z.infer<typeof RunnerCategorySchema>;

/**
 * Zod schema for RegistryQuery
 * @category types
 */
export const RegistryQuerySchema = z.object({
  category: z
    .enum([
      'ops',
      'finops',
      'support',
      'growth',
      'analytics',
      'security',
      'infrastructure',
      'custom',
    ])
    .optional(),
  connectorType: z
    .enum(['database', 'queue', 'storage', 'api', 'webhook', 'stream', 'cache', 'messaging'])
    .optional(),
  healthStatus: z.enum(['healthy', 'degraded', 'unhealthy', 'offline', 'any']).default('any'),
  includeCapabilities: z.boolean().default(true),
  includeConnectors: z.boolean().default(true),
});

/**
 * TypeScript type inferred from RegistryQuerySchema
 */
export type RegistryQuery = z.infer<typeof RegistryQuerySchema>;

/**
 * Zod schema for RegistryDiff
 * @category types
 */
export const RegistryDiffSchema = z.object({
  added: z.array(
    z.object({
      type: z.enum(['runner', 'connector', 'capability']),
      id: z.string(),
      data: z.unknown(),
    })
  ),
  removed: z.array(
    z.object({
      type: z.enum(['runner', 'connector', 'capability']),
      id: z.string(),
    })
  ),
  modified: z.array(
    z.object({
      type: z.enum(['runner', 'connector', 'capability']),
      id: z.string(),
      changes: z.record(
        z.object({
          old: z.unknown(),
          new: z.unknown(),
        })
      ),
    })
  ),
  timestamp: z.string().datetime(),
  previousChecksum: z.string(),
  currentChecksum: z.string(),
});

/**
 * TypeScript type inferred from RegistryDiffSchema
 */
export type RegistryDiff = z.infer<typeof RegistryDiffSchema>;

/**
 * Zod schema for MarketplaceIndex
 * @category types
 */
export const MarketplaceIndexSchema = z.object({
  version: z.string(),
  generatedAt: z.string().datetime(),
  schema: z.object({
    version: z.string(),
    url: z.string().url(),
  }),
  system: z.object({
    name: z.string(),
    version: z.string(),
    environment: z.enum(['development', 'staging', 'production']),
  }),
  stats: z.object({
    totalRunners: z.number().min(0),
    totalConnectors: z.number().min(0),
    totalCapabilities: z.number().min(0),
    verifiedCount: z.number().min(0),
    pendingReviewCount: z.number().min(0),
    deprecatedCount: z.number().min(0),
    categories: z.record(z.number().min(0)),
    connectorTypes: z.record(z.number().min(0)),
  }),
  runners: z.array(
    z.object({
      id: z.string(),
      metadata: z.object({
        id: z.string().uuid(),
        name: z.string(),
        version: z.string(),
        contractVersion: z.object({
          major: z.number().int().min(0),
          minor: z.number().int().min(0),
          patch: z.number().int().min(0),
          preRelease: z.string().optional(),
        }),
        capabilities: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            version: z.string(),
            description: z.string(),
            inputSchema: z.record(z.unknown()),
            outputSchema: z.record(z.unknown()),
            supportedJobTypes: z.array(z.string()),
            maxConcurrency: z.number().int().default(1),
            timeoutMs: z.number().default(30000),
            resourceRequirements: z
              .object({
                cpu: z.string().optional(),
                memory: z.string().optional(),
                gpu: z.boolean().default(false),
              })
              .default({}),
          })
        ),
        supportedContracts: z.array(z.string()),
        healthCheckEndpoint: z.string().url(),
        registeredAt: z.string().datetime(),
        lastHeartbeatAt: z.string().datetime(),
        status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']).default('healthy'),
        tags: z.array(z.string()).default([]),
      }),
      category: z.enum([
        'ops',
        'finops',
        'support',
        'growth',
        'analytics',
        'security',
        'infrastructure',
        'custom',
      ]),
      description: z.string(),
      longDescription: z.string().optional(),
      author: z.object({
        name: z.string(),
        email: z.string().email().optional(),
        url: z.string().url().optional(),
        organization: z.string().optional(),
      }),
      repository: z
        .object({
          url: z.string().url(),
          type: z.enum(['git', 'svn', 'mercurial']).default('git'),
          branch: z.string().default('main'),
        })
        .optional(),
      documentation: z
        .object({
          readme: z.string().url().optional(),
          changelog: z.string().url().optional(),
          examples: z.array(z.string().url()).default([]),
        })
        .default({}),
      license: z.string(),
      keywords: z.array(z.string()).default([]),
      capabilities: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          version: z.string(),
          description: z.string(),
          inputSchema: z.record(z.unknown()),
          outputSchema: z.record(z.unknown()),
          supportedJobTypes: z.array(z.string()),
          maxConcurrency: z.number().int().default(1),
          timeoutMs: z.number().default(30000),
          resourceRequirements: z
            .object({
              cpu: z.string().optional(),
              memory: z.string().optional(),
              gpu: z.boolean().default(false),
            })
            .default({}),
        })
      ),
      compatibility: z.object({
        minContractVersion: z.object({
          major: z.number().int().min(0),
          minor: z.number().int().min(0),
          patch: z.number().int().min(0),
          preRelease: z.string().optional(),
        }),
        maxContractVersion: z
          .object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          })
          .optional(),
        supportedRanges: z
          .array(
            z.object({
              min: z.object({
                major: z.number().int().min(0),
                minor: z.number().int().min(0),
                patch: z.number().int().min(0),
                preRelease: z.string().optional(),
              }),
              max: z
                .object({
                  major: z.number().int().min(0),
                  minor: z.number().int().min(0),
                  patch: z.number().int().min(0),
                  preRelease: z.string().optional(),
                })
                .optional(),
              exact: z
                .object({
                  major: z.number().int().min(0),
                  minor: z.number().int().min(0),
                  patch: z.number().int().min(0),
                  preRelease: z.string().optional(),
                })
                .optional(),
            })
          )
          .default([]),
        incompatibleWith: z.array(z.string()).default([]),
        testedWith: z
          .array(
            z.object({
              contractVersion: z.object({
                major: z.number().int().min(0),
                minor: z.number().int().min(0),
                patch: z.number().int().min(0),
                preRelease: z.string().optional(),
              }),
              testedAt: z.string().datetime(),
              result: z.enum(['compatible', 'incompatible', 'unknown']),
            })
          )
          .default([]),
      }),
      trustSignals: z.object({
        overallTrust: z.enum(['verified', 'pending', 'failed', 'unverified']),
        contractTestStatus: z.enum(['passing', 'failing', 'not_tested', 'stale']),
        lastContractTestAt: z.string().datetime().optional(),
        lastVerifiedVersion: z.string().optional(),
        verificationMethod: z.enum([
          'automated_ci',
          'manual_review',
          'community_verified',
          'official_publisher',
        ]),
        securityScanStatus: z.enum(['passed', 'failed', 'pending', 'not_scanned']),
        lastSecurityScanAt: z.string().datetime().optional(),
        securityScanDetails: z
          .object({
            vulnerabilities: z
              .array(
                z.object({
                  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
                  description: z.string(),
                  cve: z.string().optional(),
                })
              )
              .default([]),
            scanDurationMs: z.number().min(0).optional(),
          })
          .default({}),
        codeQualityScore: z.number().min(0).max(100).optional(),
        maintainerReputation: z
          .enum(['official', 'verified', 'community', 'unknown'])
          .default('unknown'),
        downloadCount: z.number().min(0).default(0),
        rating: z
          .object({
            average: z.number().min(0).max(5).optional(),
            count: z.number().min(0).default(0),
          })
          .default({}),
      }),
      deprecation: z
        .object({
          isDeprecated: z.boolean().default(false),
          deprecationDate: z.string().datetime().optional(),
          replacementId: z.string().optional(),
          migrationGuide: z.string().url().optional(),
          reason: z.string().optional(),
        })
        .default({ isDeprecated: false }),
      status: z
        .enum(['active', 'deprecated', 'pending_review', 'rejected', 'delisted'])
        .default('active'),
      publishedAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      versionHistory: z
        .array(
          z.object({
            version: z.string(),
            publishedAt: z.string().datetime(),
            changelog: z.string().optional(),
            breakingChanges: z.boolean().default(false),
          })
        )
        .default([]),
      installation: z
        .object({
          npm: z.string().optional(),
          docker: z.string().optional(),
          binary: z.string().optional(),
          source: z.string().optional(),
        })
        .default({}),
    })
  ),
  connectors: z.array(
    z.object({
      id: z.string(),
      config: z.object({
        id: z.string(),
        name: z.string(),
        type: z.enum([
          'database',
          'queue',
          'storage',
          'api',
          'webhook',
          'stream',
          'cache',
          'messaging',
        ]),
        version: z.string(),
        description: z.string(),
        configSchema: z.record(z.unknown()),
        required: z.boolean().default(false),
        healthCheckable: z.boolean().default(true),
      }),
      description: z.string(),
      longDescription: z.string().optional(),
      author: z.object({
        name: z.string(),
        email: z.string().email().optional(),
        url: z.string().url().optional(),
        organization: z.string().optional(),
      }),
      repository: z
        .object({
          url: z.string().url(),
          type: z.enum(['git', 'svn', 'mercurial']).default('git'),
          branch: z.string().default('main'),
        })
        .optional(),
      documentation: z
        .object({
          readme: z.string().url().optional(),
          configuration: z.string().url().optional(),
          examples: z.array(z.string().url()).default([]),
        })
        .default({}),
      license: z.string(),
      keywords: z.array(z.string()).default([]),
      inputSchema: z.record(z.unknown()),
      outputSchema: z.record(z.unknown()),
      compatibility: z.object({
        minContractVersion: z.object({
          major: z.number().int().min(0),
          minor: z.number().int().min(0),
          patch: z.number().int().min(0),
          preRelease: z.string().optional(),
        }),
        maxContractVersion: z
          .object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          })
          .optional(),
        supportedRanges: z
          .array(
            z.object({
              min: z.object({
                major: z.number().int().min(0),
                minor: z.number().int().min(0),
                patch: z.number().int().min(0),
                preRelease: z.string().optional(),
              }),
              max: z
                .object({
                  major: z.number().int().min(0),
                  minor: z.number().int().min(0),
                  patch: z.number().int().min(0),
                  preRelease: z.string().optional(),
                })
                .optional(),
              exact: z
                .object({
                  major: z.number().int().min(0),
                  minor: z.number().int().min(0),
                  patch: z.number().int().min(0),
                  preRelease: z.string().optional(),
                })
                .optional(),
            })
          )
          .default([]),
        incompatibleWith: z.array(z.string()).default([]),
        testedWith: z
          .array(
            z.object({
              contractVersion: z.object({
                major: z.number().int().min(0),
                minor: z.number().int().min(0),
                patch: z.number().int().min(0),
                preRelease: z.string().optional(),
              }),
              testedAt: z.string().datetime(),
              result: z.enum(['compatible', 'incompatible', 'unknown']),
            })
          )
          .default([]),
      }),
      trustSignals: z.object({
        overallTrust: z.enum(['verified', 'pending', 'failed', 'unverified']),
        contractTestStatus: z.enum(['passing', 'failing', 'not_tested', 'stale']),
        lastContractTestAt: z.string().datetime().optional(),
        lastVerifiedVersion: z.string().optional(),
        verificationMethod: z.enum([
          'automated_ci',
          'manual_review',
          'community_verified',
          'official_publisher',
        ]),
        securityScanStatus: z.enum(['passed', 'failed', 'pending', 'not_scanned']),
        lastSecurityScanAt: z.string().datetime().optional(),
        securityScanDetails: z
          .object({
            vulnerabilities: z
              .array(
                z.object({
                  severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
                  description: z.string(),
                  cve: z.string().optional(),
                })
              )
              .default([]),
            scanDurationMs: z.number().min(0).optional(),
          })
          .default({}),
        codeQualityScore: z.number().min(0).max(100).optional(),
        maintainerReputation: z
          .enum(['official', 'verified', 'community', 'unknown'])
          .default('unknown'),
        downloadCount: z.number().min(0).default(0),
        rating: z
          .object({
            average: z.number().min(0).max(5).optional(),
            count: z.number().min(0).default(0),
          })
          .default({}),
      }),
      deprecation: z
        .object({
          isDeprecated: z.boolean().default(false),
          deprecationDate: z.string().datetime().optional(),
          replacementId: z.string().optional(),
          migrationGuide: z.string().url().optional(),
          reason: z.string().optional(),
        })
        .default({ isDeprecated: false }),
      status: z
        .enum(['active', 'deprecated', 'pending_review', 'rejected', 'delisted'])
        .default('active'),
      publishedAt: z.string().datetime(),
      updatedAt: z.string().datetime(),
      versionHistory: z
        .array(
          z.object({
            version: z.string(),
            publishedAt: z.string().datetime(),
            changelog: z.string().optional(),
            breakingChanges: z.boolean().default(false),
          })
        )
        .default([]),
      installation: z
        .object({
          npm: z.string().optional(),
          docker: z.string().optional(),
        })
        .default({}),
    })
  ),
  filters: z.object({
    categories: z.array(z.string()),
    connectorTypes: z.array(z.string()),
    trustLevels: z.array(z.string()),
    licenseTypes: z.array(z.string()),
  }),
});

/**
 * TypeScript type inferred from MarketplaceIndexSchema
 */
export type MarketplaceIndex = z.infer<typeof MarketplaceIndexSchema>;

/**
 * Zod schema for MarketplaceRunner
 * @category types
 */
export const MarketplaceRunnerSchema = z.object({
  id: z.string(),
  metadata: z.object({
    id: z.string().uuid(),
    name: z.string(),
    version: z.string(),
    contractVersion: z.object({
      major: z.number().int().min(0),
      minor: z.number().int().min(0),
      patch: z.number().int().min(0),
      preRelease: z.string().optional(),
    }),
    capabilities: z.array(
      z.object({
        id: z.string(),
        name: z.string(),
        version: z.string(),
        description: z.string(),
        inputSchema: z.record(z.unknown()),
        outputSchema: z.record(z.unknown()),
        supportedJobTypes: z.array(z.string()),
        maxConcurrency: z.number().int().default(1),
        timeoutMs: z.number().default(30000),
        resourceRequirements: z
          .object({
            cpu: z.string().optional(),
            memory: z.string().optional(),
            gpu: z.boolean().default(false),
          })
          .default({}),
      })
    ),
    supportedContracts: z.array(z.string()),
    healthCheckEndpoint: z.string().url(),
    registeredAt: z.string().datetime(),
    lastHeartbeatAt: z.string().datetime(),
    status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']).default('healthy'),
    tags: z.array(z.string()).default([]),
  }),
  category: z.enum([
    'ops',
    'finops',
    'support',
    'growth',
    'analytics',
    'security',
    'infrastructure',
    'custom',
  ]),
  description: z.string(),
  longDescription: z.string().optional(),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
    organization: z.string().optional(),
  }),
  repository: z
    .object({
      url: z.string().url(),
      type: z.enum(['git', 'svn', 'mercurial']).default('git'),
      branch: z.string().default('main'),
    })
    .optional(),
  documentation: z
    .object({
      readme: z.string().url().optional(),
      changelog: z.string().url().optional(),
      examples: z.array(z.string().url()).default([]),
    })
    .default({}),
  license: z.string(),
  keywords: z.array(z.string()).default([]),
  capabilities: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      version: z.string(),
      description: z.string(),
      inputSchema: z.record(z.unknown()),
      outputSchema: z.record(z.unknown()),
      supportedJobTypes: z.array(z.string()),
      maxConcurrency: z.number().int().default(1),
      timeoutMs: z.number().default(30000),
      resourceRequirements: z
        .object({
          cpu: z.string().optional(),
          memory: z.string().optional(),
          gpu: z.boolean().default(false),
        })
        .default({}),
    })
  ),
  compatibility: z.object({
    minContractVersion: z.object({
      major: z.number().int().min(0),
      minor: z.number().int().min(0),
      patch: z.number().int().min(0),
      preRelease: z.string().optional(),
    }),
    maxContractVersion: z
      .object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      })
      .optional(),
    supportedRanges: z
      .array(
        z.object({
          min: z.object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          }),
          max: z
            .object({
              major: z.number().int().min(0),
              minor: z.number().int().min(0),
              patch: z.number().int().min(0),
              preRelease: z.string().optional(),
            })
            .optional(),
          exact: z
            .object({
              major: z.number().int().min(0),
              minor: z.number().int().min(0),
              patch: z.number().int().min(0),
              preRelease: z.string().optional(),
            })
            .optional(),
        })
      )
      .default([]),
    incompatibleWith: z.array(z.string()).default([]),
    testedWith: z
      .array(
        z.object({
          contractVersion: z.object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          }),
          testedAt: z.string().datetime(),
          result: z.enum(['compatible', 'incompatible', 'unknown']),
        })
      )
      .default([]),
  }),
  trustSignals: z.object({
    overallTrust: z.enum(['verified', 'pending', 'failed', 'unverified']),
    contractTestStatus: z.enum(['passing', 'failing', 'not_tested', 'stale']),
    lastContractTestAt: z.string().datetime().optional(),
    lastVerifiedVersion: z.string().optional(),
    verificationMethod: z.enum([
      'automated_ci',
      'manual_review',
      'community_verified',
      'official_publisher',
    ]),
    securityScanStatus: z.enum(['passed', 'failed', 'pending', 'not_scanned']),
    lastSecurityScanAt: z.string().datetime().optional(),
    securityScanDetails: z
      .object({
        vulnerabilities: z
          .array(
            z.object({
              severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
              description: z.string(),
              cve: z.string().optional(),
            })
          )
          .default([]),
        scanDurationMs: z.number().min(0).optional(),
      })
      .default({}),
    codeQualityScore: z.number().min(0).max(100).optional(),
    maintainerReputation: z
      .enum(['official', 'verified', 'community', 'unknown'])
      .default('unknown'),
    downloadCount: z.number().min(0).default(0),
    rating: z
      .object({
        average: z.number().min(0).max(5).optional(),
        count: z.number().min(0).default(0),
      })
      .default({}),
  }),
  deprecation: z
    .object({
      isDeprecated: z.boolean().default(false),
      deprecationDate: z.string().datetime().optional(),
      replacementId: z.string().optional(),
      migrationGuide: z.string().url().optional(),
      reason: z.string().optional(),
    })
    .default({ isDeprecated: false }),
  status: z
    .enum(['active', 'deprecated', 'pending_review', 'rejected', 'delisted'])
    .default('active'),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versionHistory: z
    .array(
      z.object({
        version: z.string(),
        publishedAt: z.string().datetime(),
        changelog: z.string().optional(),
        breakingChanges: z.boolean().default(false),
      })
    )
    .default([]),
  installation: z
    .object({
      npm: z.string().optional(),
      docker: z.string().optional(),
      binary: z.string().optional(),
      source: z.string().optional(),
    })
    .default({}),
});

/**
 * TypeScript type inferred from MarketplaceRunnerSchema
 */
export type MarketplaceRunner = z.infer<typeof MarketplaceRunnerSchema>;

/**
 * Zod schema for MarketplaceConnector
 * @category types
 */
export const MarketplaceConnectorSchema = z.object({
  id: z.string(),
  config: z.object({
    id: z.string(),
    name: z.string(),
    type: z.enum([
      'database',
      'queue',
      'storage',
      'api',
      'webhook',
      'stream',
      'cache',
      'messaging',
    ]),
    version: z.string(),
    description: z.string(),
    configSchema: z.record(z.unknown()),
    required: z.boolean().default(false),
    healthCheckable: z.boolean().default(true),
  }),
  description: z.string(),
  longDescription: z.string().optional(),
  author: z.object({
    name: z.string(),
    email: z.string().email().optional(),
    url: z.string().url().optional(),
    organization: z.string().optional(),
  }),
  repository: z
    .object({
      url: z.string().url(),
      type: z.enum(['git', 'svn', 'mercurial']).default('git'),
      branch: z.string().default('main'),
    })
    .optional(),
  documentation: z
    .object({
      readme: z.string().url().optional(),
      configuration: z.string().url().optional(),
      examples: z.array(z.string().url()).default([]),
    })
    .default({}),
  license: z.string(),
  keywords: z.array(z.string()).default([]),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()),
  compatibility: z.object({
    minContractVersion: z.object({
      major: z.number().int().min(0),
      minor: z.number().int().min(0),
      patch: z.number().int().min(0),
      preRelease: z.string().optional(),
    }),
    maxContractVersion: z
      .object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      })
      .optional(),
    supportedRanges: z
      .array(
        z.object({
          min: z.object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          }),
          max: z
            .object({
              major: z.number().int().min(0),
              minor: z.number().int().min(0),
              patch: z.number().int().min(0),
              preRelease: z.string().optional(),
            })
            .optional(),
          exact: z
            .object({
              major: z.number().int().min(0),
              minor: z.number().int().min(0),
              patch: z.number().int().min(0),
              preRelease: z.string().optional(),
            })
            .optional(),
        })
      )
      .default([]),
    incompatibleWith: z.array(z.string()).default([]),
    testedWith: z
      .array(
        z.object({
          contractVersion: z.object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          }),
          testedAt: z.string().datetime(),
          result: z.enum(['compatible', 'incompatible', 'unknown']),
        })
      )
      .default([]),
  }),
  trustSignals: z.object({
    overallTrust: z.enum(['verified', 'pending', 'failed', 'unverified']),
    contractTestStatus: z.enum(['passing', 'failing', 'not_tested', 'stale']),
    lastContractTestAt: z.string().datetime().optional(),
    lastVerifiedVersion: z.string().optional(),
    verificationMethod: z.enum([
      'automated_ci',
      'manual_review',
      'community_verified',
      'official_publisher',
    ]),
    securityScanStatus: z.enum(['passed', 'failed', 'pending', 'not_scanned']),
    lastSecurityScanAt: z.string().datetime().optional(),
    securityScanDetails: z
      .object({
        vulnerabilities: z
          .array(
            z.object({
              severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
              description: z.string(),
              cve: z.string().optional(),
            })
          )
          .default([]),
        scanDurationMs: z.number().min(0).optional(),
      })
      .default({}),
    codeQualityScore: z.number().min(0).max(100).optional(),
    maintainerReputation: z
      .enum(['official', 'verified', 'community', 'unknown'])
      .default('unknown'),
    downloadCount: z.number().min(0).default(0),
    rating: z
      .object({
        average: z.number().min(0).max(5).optional(),
        count: z.number().min(0).default(0),
      })
      .default({}),
  }),
  deprecation: z
    .object({
      isDeprecated: z.boolean().default(false),
      deprecationDate: z.string().datetime().optional(),
      replacementId: z.string().optional(),
      migrationGuide: z.string().url().optional(),
      reason: z.string().optional(),
    })
    .default({ isDeprecated: false }),
  status: z
    .enum(['active', 'deprecated', 'pending_review', 'rejected', 'delisted'])
    .default('active'),
  publishedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  versionHistory: z
    .array(
      z.object({
        version: z.string(),
        publishedAt: z.string().datetime(),
        changelog: z.string().optional(),
        breakingChanges: z.boolean().default(false),
      })
    )
    .default([]),
  installation: z
    .object({
      npm: z.string().optional(),
      docker: z.string().optional(),
    })
    .default({}),
});

/**
 * TypeScript type inferred from MarketplaceConnectorSchema
 */
export type MarketplaceConnector = z.infer<typeof MarketplaceConnectorSchema>;

/**
 * Zod schema for MarketplaceQuery
 * @category types
 */
export const MarketplaceQuerySchema = z.object({
  type: z.enum(['runner', 'connector', 'all']).default('all'),
  category: z.string().optional(),
  connectorType: z.string().optional(),
  status: z.enum(['active', 'deprecated', 'pending_review', 'all']).default('active'),
  trustLevel: z.enum(['verified', 'community', 'all']).default('all'),
  search: z.string().optional(),
  compatibilityVersion: z
    .object({
      major: z.number().int().min(0),
      minor: z.number().int().min(0),
      patch: z.number().int().min(0),
      preRelease: z.string().optional(),
    })
    .optional(),
  author: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  sortBy: z
    .enum(['relevance', 'name', 'published', 'updated', 'rating', 'downloads'])
    .default('relevance'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  limit: z.number().min(0).max(100).default(20),
  offset: z.number().min(0).default(0),
});

/**
 * TypeScript type inferred from MarketplaceQuerySchema
 */
export type MarketplaceQuery = z.infer<typeof MarketplaceQuerySchema>;

/**
 * Zod schema for MarketplaceQueryResult
 * @category types
 */
export const MarketplaceQueryResultSchema = z.object({
  query: z.object({
    type: z.enum(['runner', 'connector', 'all']).default('all'),
    category: z.string().optional(),
    connectorType: z.string().optional(),
    status: z.enum(['active', 'deprecated', 'pending_review', 'all']).default('active'),
    trustLevel: z.enum(['verified', 'community', 'all']).default('all'),
    search: z.string().optional(),
    compatibilityVersion: z
      .object({
        major: z.number().int().min(0),
        minor: z.number().int().min(0),
        patch: z.number().int().min(0),
        preRelease: z.string().optional(),
      })
      .optional(),
    author: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    sortBy: z
      .enum(['relevance', 'name', 'published', 'updated', 'rating', 'downloads'])
      .default('relevance'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
    limit: z.number().min(0).max(100).default(20),
    offset: z.number().min(0).default(0),
  }),
  total: z.number().min(0),
  hasMore: z.boolean(),
  items: z.array(
    z.union([
      z.object({
        id: z.string(),
        metadata: z.object({
          id: z.string().uuid(),
          name: z.string(),
          version: z.string(),
          contractVersion: z.object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          }),
          capabilities: z.array(
            z.object({
              id: z.string(),
              name: z.string(),
              version: z.string(),
              description: z.string(),
              inputSchema: z.record(z.unknown()),
              outputSchema: z.record(z.unknown()),
              supportedJobTypes: z.array(z.string()),
              maxConcurrency: z.number().int().default(1),
              timeoutMs: z.number().default(30000),
              resourceRequirements: z
                .object({
                  cpu: z.string().optional(),
                  memory: z.string().optional(),
                  gpu: z.boolean().default(false),
                })
                .default({}),
            })
          ),
          supportedContracts: z.array(z.string()),
          healthCheckEndpoint: z.string().url(),
          registeredAt: z.string().datetime(),
          lastHeartbeatAt: z.string().datetime(),
          status: z.enum(['healthy', 'degraded', 'unhealthy', 'offline']).default('healthy'),
          tags: z.array(z.string()).default([]),
        }),
        category: z.enum([
          'ops',
          'finops',
          'support',
          'growth',
          'analytics',
          'security',
          'infrastructure',
          'custom',
        ]),
        description: z.string(),
        longDescription: z.string().optional(),
        author: z.object({
          name: z.string(),
          email: z.string().email().optional(),
          url: z.string().url().optional(),
          organization: z.string().optional(),
        }),
        repository: z
          .object({
            url: z.string().url(),
            type: z.enum(['git', 'svn', 'mercurial']).default('git'),
            branch: z.string().default('main'),
          })
          .optional(),
        documentation: z
          .object({
            readme: z.string().url().optional(),
            changelog: z.string().url().optional(),
            examples: z.array(z.string().url()).default([]),
          })
          .default({}),
        license: z.string(),
        keywords: z.array(z.string()).default([]),
        capabilities: z.array(
          z.object({
            id: z.string(),
            name: z.string(),
            version: z.string(),
            description: z.string(),
            inputSchema: z.record(z.unknown()),
            outputSchema: z.record(z.unknown()),
            supportedJobTypes: z.array(z.string()),
            maxConcurrency: z.number().int().default(1),
            timeoutMs: z.number().default(30000),
            resourceRequirements: z
              .object({
                cpu: z.string().optional(),
                memory: z.string().optional(),
                gpu: z.boolean().default(false),
              })
              .default({}),
          })
        ),
        compatibility: z.object({
          minContractVersion: z.object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          }),
          maxContractVersion: z
            .object({
              major: z.number().int().min(0),
              minor: z.number().int().min(0),
              patch: z.number().int().min(0),
              preRelease: z.string().optional(),
            })
            .optional(),
          supportedRanges: z
            .array(
              z.object({
                min: z.object({
                  major: z.number().int().min(0),
                  minor: z.number().int().min(0),
                  patch: z.number().int().min(0),
                  preRelease: z.string().optional(),
                }),
                max: z
                  .object({
                    major: z.number().int().min(0),
                    minor: z.number().int().min(0),
                    patch: z.number().int().min(0),
                    preRelease: z.string().optional(),
                  })
                  .optional(),
                exact: z
                  .object({
                    major: z.number().int().min(0),
                    minor: z.number().int().min(0),
                    patch: z.number().int().min(0),
                    preRelease: z.string().optional(),
                  })
                  .optional(),
              })
            )
            .default([]),
          incompatibleWith: z.array(z.string()).default([]),
          testedWith: z
            .array(
              z.object({
                contractVersion: z.object({
                  major: z.number().int().min(0),
                  minor: z.number().int().min(0),
                  patch: z.number().int().min(0),
                  preRelease: z.string().optional(),
                }),
                testedAt: z.string().datetime(),
                result: z.enum(['compatible', 'incompatible', 'unknown']),
              })
            )
            .default([]),
        }),
        trustSignals: z.object({
          overallTrust: z.enum(['verified', 'pending', 'failed', 'unverified']),
          contractTestStatus: z.enum(['passing', 'failing', 'not_tested', 'stale']),
          lastContractTestAt: z.string().datetime().optional(),
          lastVerifiedVersion: z.string().optional(),
          verificationMethod: z.enum([
            'automated_ci',
            'manual_review',
            'community_verified',
            'official_publisher',
          ]),
          securityScanStatus: z.enum(['passed', 'failed', 'pending', 'not_scanned']),
          lastSecurityScanAt: z.string().datetime().optional(),
          securityScanDetails: z
            .object({
              vulnerabilities: z
                .array(
                  z.object({
                    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
                    description: z.string(),
                    cve: z.string().optional(),
                  })
                )
                .default([]),
              scanDurationMs: z.number().min(0).optional(),
            })
            .default({}),
          codeQualityScore: z.number().min(0).max(100).optional(),
          maintainerReputation: z
            .enum(['official', 'verified', 'community', 'unknown'])
            .default('unknown'),
          downloadCount: z.number().min(0).default(0),
          rating: z
            .object({
              average: z.number().min(0).max(5).optional(),
              count: z.number().min(0).default(0),
            })
            .default({}),
        }),
        deprecation: z
          .object({
            isDeprecated: z.boolean().default(false),
            deprecationDate: z.string().datetime().optional(),
            replacementId: z.string().optional(),
            migrationGuide: z.string().url().optional(),
            reason: z.string().optional(),
          })
          .default({ isDeprecated: false }),
        status: z
          .enum(['active', 'deprecated', 'pending_review', 'rejected', 'delisted'])
          .default('active'),
        publishedAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        versionHistory: z
          .array(
            z.object({
              version: z.string(),
              publishedAt: z.string().datetime(),
              changelog: z.string().optional(),
              breakingChanges: z.boolean().default(false),
            })
          )
          .default([]),
        installation: z
          .object({
            npm: z.string().optional(),
            docker: z.string().optional(),
            binary: z.string().optional(),
            source: z.string().optional(),
          })
          .default({}),
      }),
      z.object({
        id: z.string(),
        config: z.object({
          id: z.string(),
          name: z.string(),
          type: z.enum([
            'database',
            'queue',
            'storage',
            'api',
            'webhook',
            'stream',
            'cache',
            'messaging',
          ]),
          version: z.string(),
          description: z.string(),
          configSchema: z.record(z.unknown()),
          required: z.boolean().default(false),
          healthCheckable: z.boolean().default(true),
        }),
        description: z.string(),
        longDescription: z.string().optional(),
        author: z.object({
          name: z.string(),
          email: z.string().email().optional(),
          url: z.string().url().optional(),
          organization: z.string().optional(),
        }),
        repository: z
          .object({
            url: z.string().url(),
            type: z.enum(['git', 'svn', 'mercurial']).default('git'),
            branch: z.string().default('main'),
          })
          .optional(),
        documentation: z
          .object({
            readme: z.string().url().optional(),
            configuration: z.string().url().optional(),
            examples: z.array(z.string().url()).default([]),
          })
          .default({}),
        license: z.string(),
        keywords: z.array(z.string()).default([]),
        inputSchema: z.record(z.unknown()),
        outputSchema: z.record(z.unknown()),
        compatibility: z.object({
          minContractVersion: z.object({
            major: z.number().int().min(0),
            minor: z.number().int().min(0),
            patch: z.number().int().min(0),
            preRelease: z.string().optional(),
          }),
          maxContractVersion: z
            .object({
              major: z.number().int().min(0),
              minor: z.number().int().min(0),
              patch: z.number().int().min(0),
              preRelease: z.string().optional(),
            })
            .optional(),
          supportedRanges: z
            .array(
              z.object({
                min: z.object({
                  major: z.number().int().min(0),
                  minor: z.number().int().min(0),
                  patch: z.number().int().min(0),
                  preRelease: z.string().optional(),
                }),
                max: z
                  .object({
                    major: z.number().int().min(0),
                    minor: z.number().int().min(0),
                    patch: z.number().int().min(0),
                    preRelease: z.string().optional(),
                  })
                  .optional(),
                exact: z
                  .object({
                    major: z.number().int().min(0),
                    minor: z.number().int().min(0),
                    patch: z.number().int().min(0),
                    preRelease: z.string().optional(),
                  })
                  .optional(),
              })
            )
            .default([]),
          incompatibleWith: z.array(z.string()).default([]),
          testedWith: z
            .array(
              z.object({
                contractVersion: z.object({
                  major: z.number().int().min(0),
                  minor: z.number().int().min(0),
                  patch: z.number().int().min(0),
                  preRelease: z.string().optional(),
                }),
                testedAt: z.string().datetime(),
                result: z.enum(['compatible', 'incompatible', 'unknown']),
              })
            )
            .default([]),
        }),
        trustSignals: z.object({
          overallTrust: z.enum(['verified', 'pending', 'failed', 'unverified']),
          contractTestStatus: z.enum(['passing', 'failing', 'not_tested', 'stale']),
          lastContractTestAt: z.string().datetime().optional(),
          lastVerifiedVersion: z.string().optional(),
          verificationMethod: z.enum([
            'automated_ci',
            'manual_review',
            'community_verified',
            'official_publisher',
          ]),
          securityScanStatus: z.enum(['passed', 'failed', 'pending', 'not_scanned']),
          lastSecurityScanAt: z.string().datetime().optional(),
          securityScanDetails: z
            .object({
              vulnerabilities: z
                .array(
                  z.object({
                    severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
                    description: z.string(),
                    cve: z.string().optional(),
                  })
                )
                .default([]),
              scanDurationMs: z.number().min(0).optional(),
            })
            .default({}),
          codeQualityScore: z.number().min(0).max(100).optional(),
          maintainerReputation: z
            .enum(['official', 'verified', 'community', 'unknown'])
            .default('unknown'),
          downloadCount: z.number().min(0).default(0),
          rating: z
            .object({
              average: z.number().min(0).max(5).optional(),
              count: z.number().min(0).default(0),
            })
            .default({}),
        }),
        deprecation: z
          .object({
            isDeprecated: z.boolean().default(false),
            deprecationDate: z.string().datetime().optional(),
            replacementId: z.string().optional(),
            migrationGuide: z.string().url().optional(),
            reason: z.string().optional(),
          })
          .default({ isDeprecated: false }),
        status: z
          .enum(['active', 'deprecated', 'pending_review', 'rejected', 'delisted'])
          .default('active'),
        publishedAt: z.string().datetime(),
        updatedAt: z.string().datetime(),
        versionHistory: z
          .array(
            z.object({
              version: z.string(),
              publishedAt: z.string().datetime(),
              changelog: z.string().optional(),
              breakingChanges: z.boolean().default(false),
            })
          )
          .default([]),
        installation: z
          .object({
            npm: z.string().optional(),
            docker: z.string().optional(),
          })
          .default({}),
      }),
    ])
  ),
  facets: z.object({
    categories: z.record(z.number()).default({}),
    trustLevels: z.record(z.number()).default({}),
    connectorTypes: z.record(z.number()).default({}),
    status: z.record(z.number()).default({}),
  }),
});

/**
 * TypeScript type inferred from MarketplaceQueryResultSchema
 */
export type MarketplaceQueryResult = z.infer<typeof MarketplaceQueryResultSchema>;

/**
 * Zod schema for MarketplaceTrustSignals
 * @category types
 */
export const MarketplaceTrustSignalsSchema = z.object({
  overallTrust: z.enum(['verified', 'pending', 'failed', 'unverified']),
  contractTestStatus: z.enum(['passing', 'failing', 'not_tested', 'stale']),
  lastContractTestAt: z.string().datetime().optional(),
  lastVerifiedVersion: z.string().optional(),
  verificationMethod: z.enum([
    'automated_ci',
    'manual_review',
    'community_verified',
    'official_publisher',
  ]),
  securityScanStatus: z.enum(['passed', 'failed', 'pending', 'not_scanned']),
  lastSecurityScanAt: z.string().datetime().optional(),
  securityScanDetails: z
    .object({
      vulnerabilities: z
        .array(
          z.object({
            severity: z.enum(['critical', 'high', 'medium', 'low', 'info']),
            description: z.string(),
            cve: z.string().optional(),
          })
        )
        .default([]),
      scanDurationMs: z.number().min(0).optional(),
    })
    .default({}),
  codeQualityScore: z.number().min(0).max(100).optional(),
  maintainerReputation: z.enum(['official', 'verified', 'community', 'unknown']).default('unknown'),
  downloadCount: z.number().min(0).default(0),
  rating: z
    .object({
      average: z.number().min(0).max(5).optional(),
      count: z.number().min(0).default(0),
    })
    .default({}),
});

/**
 * TypeScript type inferred from MarketplaceTrustSignalsSchema
 */
export type MarketplaceTrustSignals = z.infer<typeof MarketplaceTrustSignalsSchema>;

/**
 * Zod schema for TrustStatus
 * @category types
 */
export const TrustStatusSchema = z.enum(['verified', 'pending', 'failed', 'unverified']);

/**
 * TypeScript type inferred from TrustStatusSchema
 */
export type TrustStatus = z.infer<typeof TrustStatusSchema>;

/**
 * Zod schema for SecurityScanStatus
 * @category types
 */
export const SecurityScanStatusSchema = z.enum(['passed', 'failed', 'pending', 'not_scanned']);

/**
 * TypeScript type inferred from SecurityScanStatusSchema
 */
export type SecurityScanStatus = z.infer<typeof SecurityScanStatusSchema>;

/**
 * Zod schema for ContractTestStatus
 * @category types
 */
export const ContractTestStatusSchema = z.enum(['passing', 'failing', 'not_tested', 'stale']);

/**
 * TypeScript type inferred from ContractTestStatusSchema
 */
export type ContractTestStatus = z.infer<typeof ContractTestStatusSchema>;

/**
 * Zod schema for VerificationMethod
 * @category types
 */
export const VerificationMethodSchema = z.enum([
  'automated_ci',
  'manual_review',
  'community_verified',
  'official_publisher',
]);

/**
 * TypeScript type inferred from VerificationMethodSchema
 */
export type VerificationMethod = z.infer<typeof VerificationMethodSchema>;
