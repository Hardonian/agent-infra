# Logging + Metrics Contract

This document defines the observability contract for the ControlPlane ecosystem. It applies to services and runners that consume the contracts in this repository; no runtime services are shipped here. Organizations implementing these contracts are responsible for configuring observability tooling according to their own governance and retention policies.

## Design Principles

1. **Structured Logging**: All logs are structured JSON for machine parsing
2. **Correlation IDs**: Every request has a traceable correlation ID
3. **Standard Codes**: Common error codes across all components
4. **Semantic Metrics**: Well-defined metrics with labels and dimensions

## Log Schema

### Standard Log Entry

```typescript
interface LogEntry {
  // Required fields
  timestamp: string;           // ISO 8601
  level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
  message: string;
  
  // Context fields
  service: string;             // Service name
  version: string;             // Service version
  correlationId: string;       // Request correlation ID
  causationId?: string;        // Causal chain ID
  
  // Optional fields
  traceId?: string;           // Distributed trace ID
  spanId?: string;            // Span ID within trace
  component?: string;         // Component within service
  operation?: string;         // Operation being performed
  duration?: number;          // Duration in milliseconds
  
  // Error context (for error/fatal levels)
  error?: {
    code: string;              // Standard error code
    category: ErrorCategory;   // Error category
    stack?: string;           // Stack trace (dev only)
    details?: Record<string, unknown>;
  };
  
  // Additional context
  context?: Record<string, unknown>;
}
```

### Log Levels

| Level | Use Case | Example |
|-------|----------|---------|
| `debug` | Detailed debugging info | Request payload details |
| `info` | Normal operations | Job started/completed |
| `warn` | Recoverable issues | Retry attempt, degraded mode |
| `error` | Failed operations | Job execution failed |
| `fatal` | System failure | Cannot connect to database |

## Error Codes

### Standard Error Codes

| Code | Category | Description |
|------|----------|-------------|
| `CONTRACT_VIOLATION` | `VALIDATION_ERROR` | Schema validation failure |
| `TIMEOUT_EXCEEDED` | `TIMEOUT` | Operation exceeded time limit |
| `NETWORK_UNAVAILABLE` | `NETWORK_ERROR` | Cannot reach service |
| `AUTHENTICATION_FAILED` | `AUTH_ERROR` | Invalid credentials |
| `AUTHORIZATION_DENIED` | `AUTH_ERROR` | Insufficient permissions |
| `RATE_LIMIT_EXCEEDED` | `RATE_LIMIT` | Too many requests |
| `RESOURCE_NOT_FOUND` | `NOT_FOUND` | Requested resource missing |
| `CONFLICT_DETECTED` | `CONFLICT` | Resource conflict |
| `INTERNAL_ERROR` | `RUNTIME_ERROR` | Unexpected system error |
| `DEPENDENCY_FAILED` | `RUNTIME_ERROR` | Downstream service error |

## Metrics Contract

### Standard Metric Types

```typescript
interface Counter {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

interface Gauge {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

interface Histogram {
  name: string;
  buckets: Array<{ le: number; count: number }>;
  sum: number;
  count: number;
  labels: Record<string, string>;
  timestamp: string;
}
```

### Standard Metrics

| Metric | Type | Description | Labels |
|--------|------|-------------|--------|
| `jobs_received_total` | Counter | Jobs received | `job_type`, `priority` |
| `jobs_completed_total` | Counter | Jobs completed | `job_type`, `status` |
| `jobs_failed_total` | Counter | Jobs failed | `job_type`, `error_code` |
| `job_duration_seconds` | Histogram | Job execution time | `job_type` |
| `active_jobs` | Gauge | Currently running jobs | `job_type` |
| `runner_heartbeat_timestamp` | Gauge | Last heartbeat time | `runner_id` |
| `external_api_requests_total` | Counter | External API calls | `endpoint`, `status` |
| `external_api_duration_seconds` | Histogram | External API latency | `endpoint` |

## Correlation ID Propagation

### Propagation Rules

1. **New Request**: Generate new correlation ID
2. **Child Operations**: Inherit correlation ID
3. **Cross-Service**: Pass via headers
4. **Async Operations**: Maintain through queues

### Header Format

```
X-Correlation-Id: <uuid>
X-Causation-Id: <uuid>
X-Trace-Id: <uuid>
X-Span-Id: <uuid>
```

### Correlation ID Lifecycle

```
Client Request (gen CID: abc-123)
    ↓
API Gateway (passes CID: abc-123)
    ↓
Service A (passes CID: abc-123, gen SID: def-456)
    ↓
Service B (passes CID: abc-123, gen SID: ghi-789)
    ↓
Service C (passes CID: abc-123, gen SID: jkl-012)
```

## Usage Examples

### Basic Logging

```typescript
import { createLogger } from '@controlplane/observability';

const logger = createLogger({
  service: 'my-runner',
  version: '1.0.0'
});

logger.info('Job started', {
  jobId: 'job-123',
  jobType: 'data-processing',
  correlationId: 'corr-456'
});

logger.error('Job failed', {
  jobId: 'job-123',
  error: {
    code: 'VALIDATION_FAILED',
    message: 'Invalid payload'
  }
});
```

### Correlation ID Management

```typescript
import { CorrelationManager } from '@controlplane/observability';

const correlation = new CorrelationManager();

// In middleware
app.use((req, res, next) => {
  correlation.runWithNew(() => {
    req.correlationId = correlation.getId();
    next();
  });
});

// In handler
app.post('/execute', (req, res) => {
  const logger = createLogger({
    correlationId: req.correlationId
  });
  
  logger.info('Processing job', { jobId: req.body.jobId });
});
```

### Metrics Collection

```typescript
import { MetricsCollector } from '@controlplane/observability';

const metrics = new MetricsCollector();

// Counter
metrics.increment('jobs_completed_total', {
  job_type: 'data-processing',
  status: 'success'
});

// Histogram
metrics.observe('job_duration_seconds', durationMs / 1000, {
  job_type: 'data-processing'
});

// Gauge
metrics.set('active_jobs', currentActiveJobs, {
  job_type: 'data-processing'
});
```

## Integration

### Express Middleware

```typescript
import { observabilityMiddleware } from '@controlplane/observability';

app.use(observabilityMiddleware({
  service: 'my-runner',
  version: '1.0.0'
}));
```

### With Contracts Package

```typescript
import { createLogger } from '@controlplane/observability';
import { ErrorEnvelope } from '@controlplane/contracts';

const logger = createLogger({
  service: 'my-runner',
  version: '1.0.0'
});

// Log contract errors with proper codes
logger.errorContract(ErrorEnvelope.parse(error), {
  context: 'job-execution'
});
```

## Dashboard Queries

### Failure Rate by Job Type

```promql
rate(jobs_failed_total[5m]) / rate(jobs_received_total[5m])
```

### P99 Latency

```promql
histogram_quantile(0.99, 
  sum(rate(job_duration_seconds_bucket[5m])) by (le, job_type)
)
```

### Active Runners

```promql
count(increase(runner_heartbeat_timestamp[5m]) > 0)
```

## See Also

- [Observability Package](../packages/observability/README.md)
- [Runbook](RUNBOOK.md)
- [Contract Errors](../packages/contracts/src/errors/index.ts)
