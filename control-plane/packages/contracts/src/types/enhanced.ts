import { z } from 'zod';
import { ErrorEnvelope } from '../errors/index.js';

/**
 * Enhanced Contract Schemas for ControlPlane Ecosystem
 *
 * These schemas provide:
 * - Versioned manifests with additional metadata
 * - Invocation envelopes for standardized runner execution
 * - Enhanced error envelopes with structured diagnostics
 */

// ============================================================================
// Versioned Manifest Schema
// ============================================================================

/**
 * Semantic version string validation
 * Ensures versions follow semver (e.g., "1.2.3", "0.1.0-alpha")
 */
export const SemanticVersion = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/,
    'Must be a valid semantic version (e.g., "1.2.3" or "1.0.0-alpha")'
  );

/**
 * Enhanced runner manifest with versioning, metadata, and validation
 */
export const VersionedRunnerManifest = z.object({
  // Core identification
  name: z
    .string()
    .min(1, 'Runner name is required')
    .max(64, 'Runner name must be 64 characters or less')
    .regex(/^[a-z0-9-]+$/, 'Runner name must be lowercase alphanumeric with hyphens only'),

  version: SemanticVersion,

  description: z
    .string()
    .min(10, 'Description must be at least 10 characters')
    .max(500, 'Description must be 500 characters or less'),

  // Entrypoint configuration
  entrypoint: z.object({
    command: z.string().min(1, 'Command is required'),
    args: z.array(z.string()).default([]),
    env: z.record(z.string()).optional(),
    workingDir: z.string().optional(),
  }),

  // Versioning and compatibility
  contractVersion: SemanticVersion.default('1.0.0'),

  minimumContractsVersion: SemanticVersion.optional().describe(
    'Minimum required @controlplane/contracts version'
  ),

  maximumContractsVersion: SemanticVersion.optional().describe(
    'Maximum compatible @controlplane/contracts version'
  ),

  // Capabilities and features
  capabilities: z
    .array(
      z.enum([
        'adapter',
        'dry-run',
        'batch',
        'streaming',
        'validation',
        'async',
        'idempotent',
        'retryable',
      ])
    )
    .default([]),

  // Environment and dependencies
  requiredEnv: z.array(z.string()).default([]),

  optionalEnv: z.array(z.string()).default([]),

  outputs: z
    .array(z.enum(['report', 'evidence', 'metrics', 'logs', 'artifacts']))
    .default(['report']),

  // Execution configuration
  config: z
    .object({
      timeoutMs: z
        .number()
        .int()
        .positive()
        .default(30000)
        .describe('Default timeout for runner execution'),

      maxRetries: z.number().int().min(0).max(5).default(0).describe('Maximum retry attempts'),

      retryable: z.boolean().default(false).describe('Whether runner supports retry on failure'),

      parallelizable: z
        .boolean()
        .default(false)
        .describe('Whether runner can be executed in parallel with others'),

      requiresNetwork: z
        .boolean()
        .default(false)
        .describe('Whether runner requires network access'),

      cpuLimit: z.number().positive().optional().describe('CPU limit in millicores'),

      memoryLimit: z.string().optional().describe('Memory limit (e.g., "256Mi", "1Gi")'),
    })
    .default({}),

  // Metadata
  metadata: z
    .object({
      author: z.string().optional(),
      license: z.string().optional(),
      repository: z.string().url().optional(),
      documentation: z.string().url().optional(),
      tags: z.array(z.string()).default([]),
      createdAt: z.string().datetime().optional(),
      updatedAt: z.string().datetime().optional(),
    })
    .default({}),

  // Health check configuration
  healthCheck: z
    .object({
      enabled: z.boolean().default(true),
      endpoint: z.string().optional().describe('Health check endpoint for HTTP runners'),
      intervalMs: z.number().int().positive().default(60000).describe('Health check interval'),
      timeoutMs: z.number().int().positive().default(5000).describe('Health check timeout'),
    })
    .optional(),

  // Schema references
  schemas: z
    .object({
      input: z.string().optional().describe('Path to input JSON schema'),
      output: z.string().optional().describe('Path to output JSON schema'),
      report: z.string().optional().describe('Path to report JSON schema'),
      evidence: z.string().optional().describe('Path to evidence JSON schema'),
    })
    .optional(),
});

export type VersionedRunnerManifest = z.infer<typeof VersionedRunnerManifest>;

// ============================================================================
// Invocation Envelope Schema
// ============================================================================

/**
 * Standard envelope for runner invocation requests
 * Provides consistent structure for all runner executions
 */
export const InvocationRequest = z.object({
  // Request identification
  invocationId: z.string().uuid().describe('Unique identifier for this invocation'),

  correlationId: z.string().uuid().describe('Correlation ID for request tracing'),

  // Runner identification
  runner: z.object({
    name: z.string().describe('Name of the runner to invoke'),
    version: SemanticVersion.optional().describe('Specific runner version to use'),
  }),

  // Input payload
  input: z.unknown().describe('Runner-specific input data'),

  inputSchema: z.string().optional().describe('Reference to input schema for validation'),

  // Execution context
  context: z
    .object({
      // User/system making the request
      principal: z
        .object({
          id: z.string(),
          type: z.enum(['user', 'service', 'system']),
          roles: z.array(z.string()).default([]),
        })
        .optional(),

      // Request metadata
      timestamp: z
        .string()
        .datetime()
        .default(() => new Date().toISOString()),

      // Source information
      source: z
        .object({
          ip: z.string().ip().optional(),
          userAgent: z.string().optional(),
          requestId: z.string().optional(),
        })
        .optional(),

      // Execution hints
      dryRun: z
        .boolean()
        .default(false)
        .describe('If true, runner should validate but not execute'),

      priority: z.number().int().min(0).max(100).default(50).describe('Execution priority (0-100)'),

      deadline: z.string().datetime().optional().describe('Hard deadline for execution completion'),

      // Custom context extensions
      extensions: z.record(z.unknown()).default({}),
    })
    .default({}),

  // Execution configuration (overrides manifest defaults)
  config: z
    .object({
      timeoutMs: z.number().int().positive().optional(),
      maxRetries: z.number().int().min(0).max(5).optional(),
      retryDelayMs: z.number().int().nonnegative().optional(),
      env: z.record(z.string()).optional(),
      workingDir: z.string().optional(),
    })
    .optional(),

  // Callback configuration
  callbacks: z
    .object({
      onComplete: z.string().url().optional().describe('Webhook URL for completion notification'),
      onFailure: z.string().url().optional().describe('Webhook URL for failure notification'),
      authToken: z.string().optional().describe('Bearer token for callback authentication'),
    })
    .optional(),
});

export type InvocationRequest = z.infer<typeof InvocationRequest>;

/**
 * Standard envelope for runner invocation responses
 */
export const InvocationResponse = z.object({
  // Response identification
  invocationId: z.string().uuid().describe('Matches the request invocationId'),

  correlationId: z.string().uuid(),

  // Execution status
  status: z.enum([
    'pending', // Queued but not started
    'running', // Currently executing
    'completed', // Successfully completed
    'failed', // Failed during execution
    'cancelled', // Cancelled by user/system
    'timeout', // Exceeded timeout
  ]),

  // Timing information
  timing: z.object({
    requestedAt: z.string().datetime(),
    startedAt: z.string().datetime().optional(),
    completedAt: z.string().datetime().optional(),
    durationMs: z.number().int().nonnegative().optional(),
    queueWaitMs: z.number().int().nonnegative().optional(),
  }),

  // Output data
  output: z.unknown().optional().describe('Runner-specific output data'),

  outputSchema: z.string().optional().describe('Reference to output schema'),

  // Artifacts produced
  artifacts: z
    .array(
      z.object({
        name: z.string(),
        path: z.string(),
        type: z.string(),
        size: z.number().int().nonnegative().optional(),
        url: z.string().url().optional(),
        metadata: z.record(z.unknown()).optional(),
      })
    )
    .default([]),

  // Evidence packet
  evidence: z.unknown().optional().describe('Structured evidence of execution'),

  // Metrics
  metrics: z
    .object({
      cpuMs: z.number().nonnegative().optional(),
      memoryBytes: z.number().int().nonnegative().optional(),
      networkBytes: z.number().int().nonnegative().optional(),
      ioReadBytes: z.number().int().nonnegative().optional(),
      ioWriteBytes: z.number().int().nonnegative().optional(),
    })
    .optional(),

  // Error information (if status is 'failed')
  error: ErrorEnvelope.optional(),

  // Retry information
  retry: z
    .object({
      attempt: z.number().int().min(1).default(1),
      maxAttempts: z.number().int().min(1),
      willRetry: z.boolean().default(false),
      nextAttemptAt: z.string().datetime().optional(),
    })
    .optional(),

  // Additional metadata
  metadata: z.record(z.unknown()).default({}),
});

export type InvocationResponse = z.infer<typeof InvocationResponse>;

// ============================================================================
// Enhanced Error Envelope
// ============================================================================

/**
 * Enhanced error envelope with structured diagnostics and hints
 */
export const EnhancedErrorEnvelope = z.object({
  // Standard error fields (from base ErrorEnvelope)
  id: z.string().uuid().describe('Unique error identifier'),

  category: z.enum([
    'VALIDATION_ERROR',
    'RUNTIME_ERROR',
    'TIMEOUT',
    'NETWORK_ERROR',
    'AUTHENTICATION_ERROR',
    'AUTHORIZATION_ERROR',
    'RESOURCE_NOT_FOUND',
    'CONFLICT',
    'SCHEMA_MISMATCH',
    'SERVICE_UNAVAILABLE',
    'RATE_LIMIT',
    'INTERNAL_ERROR',
  ]),

  severity: z.enum(['info', 'warning', 'error', 'fatal']),

  code: z.string().describe('Machine-readable error code (e.g., RUNNER_NOT_FOUND)'),

  message: z.string().describe('Human-readable error message'),

  // Enhanced fields
  details: z
    .object({
      // Field-level validation errors
      fieldErrors: z
        .array(
          z.object({
            path: z.string().describe('JSON path to the field'),
            message: z.string(),
            value: z.unknown().optional(),
            constraint: z.string().optional().describe('Validation constraint that failed'),
          })
        )
        .optional(),

      // Stack trace (only in development)
      stack: z.string().optional(),

      // Contextual information
      context: z.record(z.unknown()).optional().describe('Additional context about the error'),

      // Related IDs
      relatedIds: z
        .object({
          invocationId: z.string().uuid().optional(),
          runnerId: z.string().optional(),
          jobId: z.string().uuid().optional(),
          parentId: z.string().uuid().optional(),
        })
        .optional(),

      // Retry information
      retryable: z.boolean().optional(),
      retryAfterMs: z.number().int().positive().optional(),
      maxRetries: z.number().int().optional(),
    })
    .optional(),

  // Actionable remediation
  hint: z
    .object({
      message: z.string().describe('Actionable hint for resolving the error'),

      suggestedCommands: z
        .array(z.string())
        .optional()
        .describe('Commands that might help resolve the issue'),

      documentation: z
        .array(
          z.object({
            title: z.string(),
            url: z.string().url(),
          })
        )
        .optional(),

      alternatives: z
        .array(
          z.object({
            description: z.string(),
            command: z.string().optional(),
          })
        )
        .optional(),
    })
    .optional(),

  // Standard fields
  correlationId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),

  // Source information
  source: z
    .object({
      service: z.string(),
      version: SemanticVersion.optional(),
      component: z.string().optional(),
      function: z.string().optional(),
      file: z.string().optional(),
      line: z.number().int().positive().optional(),
    })
    .optional(),
});

export type EnhancedErrorEnvelope = z.infer<typeof EnhancedErrorEnvelope>;

// ============================================================================
// Registry State Schema
// ============================================================================

/**
 * Represents the complete state of the module registry
 */
export const RegistryState = z.object({
  version: SemanticVersion.default('1.0.0'),

  generatedAt: z.string().datetime(),

  // Discovery configuration
  discovery: z.object({
    paths: z.array(z.string()).describe('Search paths for module discovery'),

    options: z
      .object({
        recursive: z.boolean().default(false),
        followSymlinks: z.boolean().default(false),
        maxDepth: z.number().int().positive().default(3),
      })
      .default({}),
  }),

  // Discovered modules
  modules: z.array(
    z.object({
      manifest: VersionedRunnerManifest,
      source: z.object({
        path: z.string(),
        type: z.enum(['runners', 'cache', 'sibling', 'custom']),
        discoveredAt: z.string().datetime(),
      }),
      status: z.enum([
        'valid', // All validations passed
        'invalid', // Validation failed
        'incompatible', // Version incompatibility
        'unreachable', // Cannot access module
        'disabled', // Explicitly disabled
      ]),
      validation: z.object({
        schemaValid: z.boolean(),
        versionCompatible: z.boolean(),
        entrypointExists: z.boolean(),
        requiredEnvPresent: z.boolean(),
        errors: z.array(z.string()),
      }),
      lastValidatedAt: z.string().datetime(),
    })
  ),

  // Health summary
  summary: z.object({
    total: z.number().int().nonnegative(),
    valid: z.number().int().nonnegative(),
    invalid: z.number().int().nonnegative(),
    incompatible: z.number().int().nonnegative(),
    unreachable: z.number().int().nonnegative(),
    disabled: z.number().int().nonnegative(),
  }),

  // Validation metadata
  validation: z.object({
    schemaVersion: SemanticVersion,
    contractVersion: SemanticVersion,
    validatedAt: z.string().datetime(),
    durationMs: z.number().int().nonnegative(),
  }),
});

export type RegistryState = z.infer<typeof RegistryState>;

// ============================================================================
// Drift Detection Schema
// ============================================================================

/**
 * Schema for ecosystem drift detection results
 */
export const DriftReport = z.object({
  scanId: z.string().uuid(),

  generatedAt: z.string().datetime(),

  status: z.enum([
    'healthy', // No drift detected
    'warning', // Minor drift, non-breaking
    'critical', // Significant drift, breaking
  ]),

  // Detected drifts
  drifts: z.array(
    z.object({
      type: z.enum([
        'MISSING_MODULE',
        'UNEXPECTED_MODULE',
        'VERSION_MISMATCH',
        'SCHEMA_MISMATCH',
        'MANIFEST_INVALID',
        'MISSING_COMMAND',
        'MISSING_EXPORT',
        'REMOVED_CAPABILITY',
        'CONFIG_DRIFT',
      ]),

      severity: z.enum(['info', 'warning', 'error', 'fatal']),

      module: z.string().describe('Name of the affected module'),

      expected: z.unknown().describe('Expected state'),

      actual: z.unknown().describe('Actual state'),

      diff: z.string().optional().describe('Human-readable diff'),

      hint: z.string().describe('Actionable remediation hint'),

      autoFixable: z.boolean().default(false).describe('Whether this drift can be auto-fixed'),
    })
  ),

  // Summary statistics
  summary: z.object({
    totalDrifts: z.number().int().nonnegative(),
    bySeverity: z.object({
      info: z.number().int().nonnegative(),
      warning: z.number().int().nonnegative(),
      error: z.number().int().nonnegative(),
      fatal: z.number().int().nonnegative(),
    }),
    byType: z.record(z.number().int().nonnegative()),
    modulesAffected: z.number().int().nonnegative(),
    autoFixable: z.number().int().nonnegative(),
  }),

  // Baseline comparison
  baseline: z
    .object({
      version: SemanticVersion,
      generatedAt: z.string().datetime(),
      path: z.string().optional(),
    })
    .optional(),

  // Recommendations
  recommendations: z
    .array(
      z.object({
        priority: z.number().int().min(1).max(10),
        description: z.string(),
        action: z.string(),
        estimatedEffort: z.enum(['low', 'medium', 'high']),
      })
    )
    .default([]),
});

export type DriftReport = z.infer<typeof DriftReport>;
