# ControlPlane Contracts Documentation

This document describes the canonical schemas and contracts that define the ControlPlane ecosystem.

## Overview

ControlPlane uses a contract-first architecture where all interactions are validated against Zod schemas. The contracts package (`@controlplane/contracts`) serves as the single source of truth for all data structures.

## Core Contracts

### Job Management Contracts

#### JobRequest
```typescript
export const JobRequest = z.object({
  id: JobId,
  type: z.string(),
  priority: JobPriority,
  metadata: JobMetadata.optional(),
  payload: JobPayload,
});
```

**Purpose**: Defines the structure for job submission requests.

**Fields**:
- `id`: UUID job identifier
- `type`: Job type identifier
- `priority`: Priority level (0-100)
- `metadata`: Optional job context metadata
- `payload`: Job-specific data

#### JobResponse
```typescript
export const JobResponse = z.object({
  id: JobId,
  status: JobStatus,
  result: JobResult.optional(),
  error: ErrorEnvelope.optional(),
  metadata: JobMetadata.optional(),
});
```

**Purpose**: Defines the response structure for job operations.

### Runner Management Contracts

#### RunnerManifest
```typescript
export const RunnerManifest = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  entrypoint: z.object({
    command: z.string(),
    args: z.array(z.string()),
  }),
  capabilities: z.array(RunnerCapability).optional(),
  requiredEnv: z.array(z.string()).optional(),
  outputs: z.array(z.string()).optional(),
  docs: z.string().optional(),
});
```

**Purpose**: Defines the manifest structure for runner registration.

**Required Fields**:
- `name`: Unique runner identifier
- `version`: Semantic version
- `description`: Human-readable description
- `entrypoint`: Command and arguments to execute the runner

#### RunnerCapability
```typescript
export const RunnerCapability = z.enum([
  'adapter',
  'dry-run',
  'batch',
  'streaming',
  'validation',
]);
```

**Purpose**: Defines the capabilities that runners can support.

### Error Handling Contracts

#### ErrorEnvelope
```typescript
export const ErrorEnvelope = z.object({
  id: z.string().uuid(),
  category: ErrorCategory,
  severity: ErrorSeverity,
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
  correlationId: z.string().uuid().optional(),
  timestamp: z.string().datetime(),
});
```

**Purpose**: Standardized error format for all ControlPlane services.

**Fields**:
- `id`: Unique error identifier
- `category`: Error category classification
- `severity`: Error severity level
- `code`: Machine-readable error code
- `message`: Human-readable error message
- `details`: Additional error context
- `correlationId`: Request correlation ID
- `timestamp`: Error occurrence timestamp

### Health Check Contracts

#### HealthCheck
```typescript
export const HealthCheck = z.object({
  status: HealthStatus,
  timestamp: z.string().datetime(),
  service: z.string(),
  version: z.string(),
  checks: z.array(z.object({
    name: z.string(),
    status: HealthStatus,
    message: z.string().optional(),
    duration: z.number().optional(),
  })),
});
```

**Purpose**: Defines the health check response structure.

## Schema Versioning

### Versioning Rules

1. **Patch (x.y.z)**: Bug fixes, no schema changes
2. **Minor (x.y.0)**: Backwards-compatible schema additions
3. **Major (x.0.0)**: Breaking schema changes

### Compatibility Matrix

The compatibility matrix (`docs/COMPATIBILITY.md`) tracks version compatibility across all ecosystem components.

## Runtime Validation

### Validation Points

1. **Input Validation**: All incoming data is validated against Zod schemas
2. **Output Validation**: All outgoing data conforms to contract schemas
3. **Manifest Validation**: Runner manifests are validated before registration
4. **Error Envelope Validation**: Errors are wrapped in standardized envelopes

### Validation Examples

```typescript
import { JobRequest, ErrorEnvelope } from '@controlplane/contracts';

// Validate incoming job request
const jobResult = JobRequest.safeParse(input);
if (!jobResult.success) {
  const error = ErrorEnvelope.parse({
    id: crypto.randomUUID(),
    category: 'VALIDATION_ERROR',
    severity: 'error',
    code: 'INVALID_JOB_REQUEST',
    message: 'Job request failed validation',
    correlationId: correlationId,
    timestamp: new Date().toISOString(),
  });
  // Handle error
}

// Validate runner manifest
const manifestResult = RunnerManifest.safeParse(manifestData);
if (!manifestResult.success) {
  // Handle invalid manifest
}
```

## Contract Schemas (JSON Format)

### Runner Manifest Schema
**Location**: `contracts/runner.manifest.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": {
      "type": "string",
      "description": "Unique runner identifier"
    },
    "version": {
      "type": "string",
      "description": "Semantic version"
    },
    "description": {
      "type": "string",
      "description": "Human-readable description"
    },
    "entrypoint": {
      "type": "object",
      "properties": {
        "command": {
          "type": "string",
          "description": "Command to execute"
        },
        "args": {
          "type": "array",
          "items": {
            "type": "string"
          },
          "description": "Command arguments"
        }
      },
      "required": ["command", "args"]
    },
    "capabilities": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["adapter", "dry-run", "batch", "streaming", "validation"]
      },
      "description": "Supported capabilities"
    },
    "requiredEnv": {
      "type": "array",
      "items": {
        "type": "string"
      },
      "description": "Required environment variables"
    },
    "outputs": {
      "type": "array",
      "items": {
        "type": "string",
        "enum": ["report", "evidence", "metrics"]
      },
      "description": "Supported output types"
    }
  },
  "required": ["name", "version", "description", "entrypoint"]
}
```

### Report Schema
**Location**: `contracts/reports.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "runner": {
      "type": "object",
      "properties": {
        "name": {"type": "string"},
        "version": {"type": "string"}
      },
      "required": ["name", "version"]
    },
    "status": {
      "type": "string",
      "enum": ["success", "failed", "degraded"]
    },
    "startedAt": {
      "type": "string",
      "format": "date-time"
    },
    "finishedAt": {
      "type": "string",
      "format": "date-time"
    },
    "summary": {
      "type": "string"
    },
    "metrics": {
      "type": "object",
      "properties": {
        "durationMs": {"type": "number"}
      }
    },
    "artifacts": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": {"type": "string"},
          "path": {"type": "string"},
          "mediaType": {"type": "string"}
        }
      }
    },
    "errors": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "code": {"type": "string"},
          "message": {"type": "string"}
        }
      }
    }
  },
  "required": ["runner", "status", "startedAt", "finishedAt", "summary"]
}
```

### Evidence Packet Schema
**Location**: `contracts/evidence.schema.json`

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "id": {
      "type": "string",
      "description": "Unique evidence packet identifier"
    },
    "runner": {
      "type": "string",
      "description": "Runner that generated the evidence"
    },
    "timestamp": {
      "type": "string",
      "format": "date-time"
    },
    "hash": {
      "type": "string",
      "description": "SHA-256 hash of canonical items array"
    },
    "contractVersion": {
      "type": "string",
      "description": "Contract version used"
    },
    "items": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "key": {
            "type": "string",
            "description": "Evidence item key"
          },
          "value": {
            "description": "Evidence item value"
          },
          "source": {
            "type": "string",
            "description": "Source of the evidence"
          },
          "redacted": {
            "type": "boolean",
            "description": "Whether the value is redacted"
          }
        }
      }
    },
    "decision": {
      "type": "object",
      "properties": {
        "outcome": {
          "type": "string",
          "enum": ["pass", "fail", "uncertain", "skip"]
        },
        "reasons": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "ruleId": {"type": "string"},
              "message": {"type": "string"}
            }
          }
        },
        "confidence": {
          "type": "number",
          "minimum": 0,
          "maximum": 1
        }
      }
    }
  },
  "required": ["id", "runner", "timestamp", "hash", "items"]
}
```

## Contract Usage Examples

### Runner Implementation

```typescript
import { 
  RunnerManifest, 
  ReportSchema, 
  EvidencePacket,
  ErrorEnvelope 
} from '@controlplane/contracts';

export class MyRunner {
  private manifest: RunnerManifest;

  constructor(manifest: RunnerManifest) {
    this.manifest = manifest;
  }

  async execute(input: unknown): Promise<ReportSchema> {
    // Validate input
    const validated = JobRequest.safeParse(input);
    if (!validated.success) {
      throw new Error('Invalid input');
    }

    // Execute logic
    const result = await this.processJob(validated.data);

    // Create evidence packet
    const evidence: EvidencePacket = {
      id: crypto.randomUUID(),
      runner: this.manifest.name,
      timestamp: new Date().toISOString(),
      hash: this.calculateHash(result.evaluationItems),
      contractVersion: "1.0.0",
      items: result.evaluationItems,
      decision: result.decision
    };

    // Create report
    const report: ReportSchema = {
      runner: {
        name: this.manifest.name,
        version: this.manifest.version
      },
      status: result.success ? 'success' : 'failed',
      startedAt: result.startedAt,
      finishedAt: result.finishedAt,
      summary: result.summary,
      metrics: {
        durationMs: result.durationMs
      },
      artifacts: [
        {
          name: 'evidence',
          path: 'evidence.json',
          mediaType: 'application/json'
        }
      ],
      errors: result.errors || []
    };

    // Write evidence
    await this.writeEvidence(evidence);

    return report;
  }

  private calculateHash(items: EvidenceItem[]): string {
    const canonical = JSON.stringify(items);
    return crypto.createHash('sha256').update(canonical).digest('hex');
  }

  private async writeEvidence(evidence: EvidencePacket): Promise<void> {
    // Implementation depends on runner requirements
  }
}
```

### Contract Validation

```typescript
import { 
  validateReport, 
  validateRunnerManifest,
  validateEvidencePacket 
} from '@controlplane/contract-kit';

// Validate runner manifest
const manifestResult = validateRunnerManifest(manifestData);
if (!manifestResult.success) {
  console.error('Invalid runner manifest:', manifestResult.error);
  process.exit(1);
}

// Validate report output
const reportResult = validateReport(reportData);
if (!reportResult.success) {
  console.error('Invalid report:', reportResult.error);
  process.exit(1);
}

// Validate evidence packet
const evidenceResult = validateEvidencePacket(evidenceData);
if (!evidenceResult.success) {
  console.error('Invalid evidence packet:', evidenceResult.error);
  process.exit(1);
}
```

## Contract Evolution

### Adding New Fields

When adding new fields to existing schemas:

1. **Minor Version**: Add optional fields with default values
2. **Major Version**: Add required fields or change existing field types

### Example: Adding Optional Field

```typescript
// Before (v1.0.0)
export const JobRequest = z.object({
  id: JobId,
  type: z.string(),
  priority: JobPriority,
  payload: JobPayload,
});

// After (v1.1.0)
export const JobRequest = z.object({
  id: JobId,
  type: z.string(),
  priority: JobPriority,
  metadata: JobMetadata.optional(), // NEW optional field
  payload: JobPayload,
});
```

### Example: Breaking Change

```typescript
// Before (v1.0.0)
export const JobPriority = z.number().min(0).max(100);

// After (v2.0.0)
export const JobPriority = z.enum(['low', 'medium', 'high']); // BREAKING CHANGE
```

## Best Practices

### 1. Always Validate at Runtime
```typescript
// Good: Validate at boundaries
app.post('/jobs', async (req, res) => {
  const result = JobRequest.safeParse(req.body);
  if (!result.success) {
    res.status(400).json({
      error: 'Invalid job request',
      details: result.error.issues
    });
    return;
  }
  // Process validated data
});

// Bad: Skip validation
app.post('/jobs', async (req, res) => {
  const job = req.body as JobRequest; // Unsafe cast
  // Process unvalidated data
});
```

### 2. Use Error Envelopes for Failures
```typescript
try {
  const result = await riskyOperation();
} catch (error) {
  const envelope = ErrorEnvelope.parse({
    id: crypto.randomUUID(),
    category: 'RUNTIME_ERROR',
    severity: 'error',
    code: 'OPERATION_FAILED',
    message: error.message,
    correlationId: correlationId,
    timestamp: new Date().toISOString(),
  });
  res.status(500).json(envelope);
}
```

### 3. Maintain Backward Compatibility
```typescript
// Good: Additive changes
export const EnhancedSchema = BaseSchema.extend({
  newField: z.string().optional(),
});

// Bad: Breaking changes
export const BrokenSchema = BaseSchema.omit({
  removedField: true, // BREAKING
});
```

## Validation Tools

### Contract Test Kit
```bash
# Run contract validation
pnpm run contract:validate

# Run with JSON output
pnpm run contract:validate:json

# Sync JSON schemas from Zod
pnpm run contract:sync:fix
```

### Compatibility Matrix
```bash
# Generate compatibility matrix
pnpm run compat:generate

# Check for drift
pnpm run compat:check
```

## Troubleshooting

### Common Validation Errors

1. **Missing Required Fields**: Check schema definitions
2. **Type Mismatches**: Ensure TypeScript types match Zod schemas
3. **Version Conflicts**: Update compatibility matrix
4. **Schema Sync Issues**: Run `contract:sync:fix`

### Debugging Validation

```typescript
// Enable detailed error reporting
const result = JobRequest.safeParse(input);
if (!result.success) {
  console.error('Validation errors:');
  result.error.issues.forEach(issue => {
    console.error(`  ${issue.path}: ${issue.message}`);
  });
}
```

## Related Documentation

- [Architecture](./architecture.md) - System architecture overview
- [RUNBOOK](./RUNBOOK.md) - Operational procedures
- [Compatibility Matrix](./COMPATIBILITY.md) - Version compatibility
- [Contract Upgrade Guide](./CONTRACT-UPGRADE.md) - Safe evolution practices