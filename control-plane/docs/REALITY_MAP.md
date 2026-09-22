# ControlPlane Reality Map

**Generated:** 2026-02-06
**Version:** 1.0.0

This document provides a canonical, code-grounded view of the ControlPlane ecosystem. It serves as the source of truth for architecture, data flows, and invariants.

---

## A) User-Facing Surfaces

### CLI Commands (Entrypoints)

| Command | Package | Entry Point | Description |
|---------|---------|-------------|-------------|
| `pnpm controlplane` | `controlplane` | `packages/controlplane/src/cli.ts` | Core orchestrator CLI |
| `pnpm contract-test` | `contract-test-kit` | `packages/contract-test-kit/src/cli.ts` | Contract validation CLI |
| `pnpm marketplace` | `contract-test-kit` | `packages/contract-test-kit/src/marketplace-cli.ts` | Marketplace index CLI |
| `pnpm capability-registry` | `contract-test-kit` | `packages/contract-test-kit/src/registry-cli.ts` | Capability registry CLI |
| `pnpm sdk-gen` | `sdk-generator` | `packages/sdk-generator/src/cli.ts` | SDK generation CLI |
| `pnpm create-runner` | `create-runner` | `packages/create-runner/src/cli.ts` | Runner scaffolding CLI |
| `pnpm cp-benchmark` | `benchmark` | `packages/benchmark/src/cli/benchmark-cli.ts` | Benchmark harness CLI |

### ControlPlane CLI Subcommands

| Subcommand | Options | Description |
|------------|---------|-------------|
| `doctor` | `--sibling` | Aggregated health check for system |
| `list` | - | List discovered runners |
| `plan` | - | Dry-run discovery + validation |
| `run <runner>` | `--input <path>` `--out <path>` | Execute a runner |
| `run --smoke` | - | Smoke-test all runners |
| `verify-integrations` | - | Full integration verification |

### Marketplace CLI Commands

| Command | Description |
|---------|-------------|
| `marketplace build` | Build marketplace index |
| `marketplace query` | Query marketplace |
| `marketplace serve` | Start marketplace API server |

**Marketplace API Endpoints (when serving):**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/v1/marketplace` | GET | Query marketplace |
| `/api/v1/stats` | GET | Marketplace statistics |
| `/api/v1/runners` | GET | List all runners |
| `/api/v1/connectors` | GET | List all connectors |

### Contract Test CLI

| Command | Options | Description |
|---------|---------|-------------|
| `controlplane doctor` | `@controlplane/controlplane` | Aggregated health check across all discovered runners |
| `controlplane list` | `@controlplane/controlplane` | List all discovered runner manifests |
| `controlplane run <runner>` | `@controlplane/controlplane` | Execute a single runner with input/output |
| `controlplane plan` | `@controlplane/controlplane` | Dry-run: discover runners, validate contracts, print plan |
| `controlplane run --smoke` | `@controlplane/controlplane` | Execute all runners with golden fixture, validate outputs |
| `controlplane verify-integrations` | `@controlplane/controlplane` | Run all runners against golden fixture, assert schemas |
| `contract-test` | `@controlplane/contract-test-kit` | Validate all contract schemas |
| `contract-sync` | `@controlplane/contract-test-kit` | Sync schemas to implementations |
| `capability-registry` | `@controlplane/contract-test-kit` | Generate capability registry |

## Demo Mode (Deterministic, Offline)

Demo mode uses the local runner adapter with a fixed timestamp for deterministic output. It does not call external services.

| Script | Purpose |
|--------|---------|
| `pnpm run demo:reset` | Reset demo state and regenerate `demo/input.json` |
| `pnpm run demo:setup` | Generate demo report + evidence artifacts |
| `pnpm run demo:start` | Run demo setup and print locations |

## Module Discovery Logic
| `contract-test` | `--json` `--junit` `--verbose` | Run contract tests |

### Benchmark CLI Suites

| Suite | Description |
|-------|-------------|
| `throughput` | Job throughput benchmark |
| `latency` | End-to-end latency benchmark |
| `truthcore` | TruthCore query benchmark |
| `runner` | Runner scaling benchmark |
| `contract` | Contract validation benchmark |
| `queue` | Queue performance benchmark |
| `health` | Health check performance benchmark |

---

## B) Request Flow Diagrams

### Runner Execution Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Runner Discovery & Execution                        │
└─────────────────────────────────────────────────────────────────────────────┘

  controlplane CLI
         │
         ▼
  listRunnerManifests()
         │
         ▼
  ┌──────────────────────────────┐
  │  Scan for runner.manifest.json│
  │  in: runners/, .cache/repos/ │
  └──────────────────────────────┘
         │
         ▼
  runRunner({
    runner: string,
    input: unknown,
    outputPath?: string,
    timeoutMs?: number
  })
         │
         ▼
  ┌──────────────────────────────┐
  │  Resolve runner entrypoint    │
  │  from manifest               │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Write input JSON to file     │
  │  controlplane-input-*.json    │
  └──────────────────────────────┘
         │
         ▼
  runEntrypoint(command, args, env)
         │
         ▼
  ┌──────────────────────────────┐
  │  Execute runner process       │
  │  (spawn child process)       │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Read output report JSON     │
  │  from --out path             │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  validateReport(report)       │
  │  (Zod schema validation)     │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  validateEvidencePacket()     │
  │  (evidence validation)       │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Return:                     │
  │  - report                    │
  │  - validation result         │
  │  - evidence validity         │
  └──────────────────────────────┘
```

### Contract Validation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Contract Validation Flow                            │
└─────────────────────────────────────────────────────────────────────────────┘

  contract-test CLI
         │
         ▼
  runAllContractTestsDetailed()
         │
         ▼
  ┌──────────────────────────────┐
  │  Load PredefinedTestSuites   │
  │  - Registry validation       │
  │  - Marketplace validation   │
  │  - Capability validation    │
  │  - Schema validation       │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  For each test:              │
  │  - Parse input data         │
  │  - Validate against Zod      │
  │  - Compare expected result   │
  │  - Collect errors           │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Format output:              │
  │  - pretty (chalk colored)    │
  │  - json                     │
  │  - junit (XML)              │
  └──────────────────────────────┘
         │
         ▼
  Exit with code 0 (pass) or 1 (fail)
```

### SDK Generation Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         SDK Generation Flow                                 │
└─────────────────────────────────────────────────────────────────────────────┘

  sdk-gen CLI
         │
         ▼
  ┌──────────────────────────────┐
  │  Extract schemas from         │
  │  @controlplane/contracts      │
  └──────────────────────────────┘
         │
         ▼
  validateSchemas(schemas)
         │
         ▼
  ┌──────────────────────────────┐
  │  Generate SDK per language:   │
  │  - TypeScript SDK           │
  │  - Python SDK               │
  │  - Go SDK                   │
  └──────────────────────────────┘
         │
         ▼
  Write SDK files to outputDir/
         │
         ▼
  (Optional) validateSDK(language)
```

### Runner Template Scaffold Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         Runner Template Scaffold                            │
└─────────────────────────────────────────────────────────────────────────────┘

  create-runner CLI <name> [options]
         │
         ▼
  ┌──────────────────────────────┐
  │  Interactive prompts (if -i)  │
  │  - Template selection        │
  │  - Description               │
  │  - Author                    │
  │  - Capabilities              │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Validate name (kebab-case) │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Copy template files:        │
  │  - queue-worker template    │
  │  - http-connector template  │
  └──────────────────────────────┘
         │
         ▼
  ┌──────────────────────────────┐
  │  Generate:                    │
  │  - CAPABILITY.md             │
  │  - schemas/input.json         │
  │  - schemas/output.json       │
  │  - test/contract.test.ts     │
  │  - .github/workflows/ci.yml│
  │  - docs/RUNNER.md           │
  └──────────────────────────────┘
         │
         ▼
  Replace placeholders in templates
  (name, description, version, etc.)
```

---

## C) Data Model Inventory

### Core Contracts (Zod Schemas)

All schemas defined in `packages/contracts/src/types/`:

| Schema | File | Purpose |
|--------|------|---------|
| `JobId` | jobs.ts | UUID job identifier |
| `JobStatus` | jobs.ts | Job lifecycle state |
| `JobPriority` | jobs.ts | Priority (0-100) |
| `JobMetadata` | jobs.ts | Job context metadata |
| `JobPayload` | jobs.ts | Job type and data |
| `JobRequest` | jobs.ts | Job submission |
| `JobResult` | jobs.ts | Job execution result |
| `JobResponse` | jobs.ts | Job status response |
| `JobEvent` | jobs.ts | Job lifecycle event |
| `QueueMessage` | jobs.ts | Queue message format |
| `RunnerCapability` | runners.ts | Runner capabilities |
| `RunnerMetadata` | runners.ts | Runner registration |
| `RunnerRegistrationRequest` | runners.ts | Runner registration |
| `RunnerRegistrationResponse` | runners.ts | Registration result |
| `RunnerHeartbeat` | runners.ts | Heartbeat payload |
| `ModuleManifest` | runners.ts | Module metadata |
| `RunnerExecutionRequest` | runners.ts | Execution dispatch |
| `RunnerExecutionResponse` | runners.ts | Execution result |
| `HealthStatus` | common.ts | Health enumeration |
| `HealthCheck` | common.ts | Health check response |
| `ServiceMetadata` | common.ts | Service metadata |
| `PaginatedRequest` | common.ts | Pagination params |
| `PaginatedResponse` | common.ts | Paginated results |
| `ApiRequest` | common.ts | API request envelope |
| `ApiResponse` | common.ts | API response envelope |
| `ErrorEnvelope` | errors.ts | Standard error format |
| `ErrorDetail` | errors.ts | Error detail |
| `RetryPolicy` | errors.ts | Retry configuration |

### Data Models (No Persistent Storage)

**Note:** This is a contract-first, schema-driven system. No database tables exist in this repository. All "models" are Zod schemas that define API contracts.

| Concept | Schema | Ownership |
|---------|--------|-----------|
| Job | `JobRequest`, `JobResponse` | TruthCore |
| Runner | `RunnerMetadata`, `RunnerCapability` | Registry |
| Module | `ModuleManifest` | Registry |
| Error | `ErrorEnvelope` | All services |
| Event | `JobEvent` | Event bus |

---

## D) Security Model

### Authentication & Authorization

**This repository implements contracts only.** Authentication/authorization logic is delegated to downstream implementations.

### Contract Validation

All contracts are validated using Zod schemas defined in `@controlplane/contracts`:

```typescript
import { JobRequest, RunnerCapability, HealthCheck } from '@controlplane/contracts';

// Validation example
const result = JobRequest.safeParse(input);
if (!result.success) {
  // Handle validation errors
}
```

### Error Security

Errors are wrapped in `ErrorEnvelope` with standardized fields:

| Field | Security Consideration |
|-------|------------------------|
| `id` | UUID prevents information leakage |
| `category` | Categorizes error type |
| `severity` | Helps with alerting |
| `message` | Should not expose internals |
| `details` | Structured debugging info |
| `correlationId` | Request tracing |

### Environment Security

Secrets are redacted in runner invocations:

```typescript
// From packages/controlplane/src/invoke/index.ts
redactEnvKeys: runner.requiredEnv ?? []
```

---

## E) Async Model (Jobs/Queues/Schedulers)

### Retry Policy Configuration

Defined in `packages/contracts/src/errors/index.ts`:

```typescript
export const RetryPolicy = z.object({
  maxRetries: z.number().int().nonnegative().default(3),
  backoffMs: z.number().nonnegative().default(1000),
  maxBackoffMs: z.number().nonnegative().default(30000),
  backoffMultiplier: z.number().positive().default(2),
  retryableCategories: z.array(ErrorCategory).default([...]),
  nonRetryableCategories: z.array(ErrorCategory).default([...]),
});
```

### Retryable Error Categories

| Category | Retryable |
|----------|-----------|
| `TIMEOUT` | Yes |
| `NETWORK_ERROR` | Yes |
| `SERVICE_UNAVAILABLE` | Yes |
| `RUNTIME_ERROR` | Yes |
| `VALIDATION_ERROR` | No |
| `SCHEMA_MISMATCH` | No |
| `AUTHENTICATION_ERROR` | No |
| `AUTHORIZATION_ERROR` | No |
| `RESOURCE_NOT_FOUND` | No |

### Benchmark Job Queues

Benchmarks use internal job queue simulation:

| Suite | Description |
|-------|-------------|
| `queue-performance` | Message queue throughput |
| `job-throughput` | Job submission rate |
| `end-to-end-latency` | Complete lifecycle |

---

## F) Observability

### Logging (pino-based)

From `packages/observability/src/logger.ts`:

```typescript
createLogger({
  service: string,
  version: string,
  correlationId?: string,
  level?: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  prettyPrint?: boolean,
});
```

### Metrics (Prometheus-style)

From `packages/observability/src/metrics.ts`:

| Metric | Type | Description |
|--------|------|-------------|
| `jobs_received_total` | Counter | Jobs submitted |
| `jobs_completed_total` | Counter | Jobs finished |
| `jobs_failed_total` | Counter | Jobs failed |
| `job_duration_seconds` | Histogram | Job duration |
| `active_jobs` | Gauge | Running jobs |
| `runner_heartbeat_timestamp` | Gauge | Last heartbeat |
| `external_api_requests_total` | Counter | API calls |
| `external_api_duration_seconds` | Histogram | API latency |

### Correlation ID Flow

From `packages/observability/src/correlation.ts`:

1. Extract from incoming request headers
2. Generate new UUID if not present
3. Propagate through all async operations
4. Include in all logs and metrics

### Middleware

From `packages/observability/src/middleware.ts`:

```typescript
observabilityMiddleware({
  service: string,
  version: string,
  logLevel?: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
  prettyPrint?: boolean,
});
```

Provides:
- Request logging
- Response time tracking
- Metrics collection
- Correlation ID propagation

### Performance Monitoring

From `packages/optimization-utils/src/monitoring/index.ts`:

| Component | Purpose |
|-----------|---------|
| `PerformanceMonitor` | Track operation metrics |
| `HotPathTracker` | Identify optimization targets |
| Optimization suggestions | Caching, batching, circuit-breaking |

### Benchmark Reporting

From `packages/benchmark/src/reporter.ts`:
- JSON output
- Table format (chalk-colored)
- Markdown format

---

## G) External Integrations

### Contract Dependencies

| Package | Purpose |
|---------|---------|
| `@controlplane/contracts` | Canonical Zod schemas |
| `@controlplane/contract-test-kit` | Validation tooling |
| `@controlplane/sdk-generator` | SDK generation |

### Benchmark External URLs

Configured via CLI options:

| Option | Default | Description |
|--------|---------|-------------|
| `--truthcore` | `http://localhost:3001` | TruthCore URL |
| `--jobforge` | `http://localhost:3002` | JobForge URL |
| `--runner` | `http://localhost:3003` | Runner URL |

---

## Invariants & Assertions

### Schema Invariants

1. All job IDs must be valid UUIDs
2. Job priority must be 0-100
3. Timestamps must be ISO 8601 format
4. Error envelopes must include correlation IDs

### Runner Invariants

1. Runners must have valid `runner.manifest.json`
2. Manifests must reference existing entrypoints
3. Capabilities must match registered schemas

### Contract Compatibility

- Schemas are versioned with semver
- Breaking changes require major version bump
- Zod schema validation ensures backward compatibility

---

## H) Distribution Boundaries

| Feature | OSS | Cloud |
|---------|-----|-------|
| `@controlplane/contracts` | Yes | Yes |
| `@controlplane/contract-test-kit` | Yes | Yes |
| `@controlplane/create-runner` | Yes | Yes |
| `@controlplane/sdk-generator` | Yes | Yes |
| `@controlplane/benchmark` | Yes | Yes |
| `@controlplane/observability` | Yes | Yes |
| `@controlplane/optimization-utils` | Yes | Yes |

See `config/distribution.oss.json` and `config/distribution.cloud.json` for feature flags.

---

## I) Module Discovery Logic

1. **Primary path**: `<repoRoot>/runners/*/runner.manifest.json`
2. **Fallback path**: `<repoRoot>/.cache/repos/*/runner.manifest.json`
3. Each manifest is validated against `contracts/runner.manifest.schema.json`
4. Returns array of `RunnerRecord` objects with `source` path

---

## J) Evidence / Artifact Paths

- **Input temp files**: `<repoRoot>/controlplane-input-<timestamp>.json`
- **Runner reports**: `<repoRoot>/<runner>-report.json` (default) or `--out <path>`
- **Integration results**: `<repoRoot>/test-results/<runner>-report.json`
- **Evidence packets**: `<repoRoot>/artifacts/<runner>/<timestamp>/evidence.json`
- **Logs**: Structured JSON to stdout/stderr with secret redaction
- **Demo artifacts**: `<repoRoot>/demo/report.json`, `<repoRoot>/demo/evidence.json`, `<repoRoot>/demo/manifest.json`

---

## K) Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NODE_ENV` | No | Environment identifier |
| `CONTROLPLANE_OFFLINE` | No | Skip external repo cloning |
| `CP_SMOKE_ALLOW_MISSING` | No | Allow missing services in smoke tests |
| `GITHUB_TOKEN` | No | GitHub access for workflow automation |
| `TRUTHCORE_URL` | No | TruthCore base URL for e2e tests |
| `JOBFORGE_URL` | No | JobForge base URL for e2e tests |
| `RUNNER_URL` | No | Runner base URL for e2e tests |
| `RATE_LIMIT_WINDOW_MS` | No | Template runner rate-limit window (ms) |
| `RATE_LIMIT_MAX` | No | Template runner max requests per window |

---

## L) Package Dependency Graph

```
@controlplane/contracts (Zod schemas - source of truth)
 └─ @controlplane/contract-kit (lightweight validators from JSON schemas)
     └─ @controlplane/controlplane (CLI + SDK)
         └─ @controlplane/contract-test-kit (CLI testing tools)
             └─ @controlplane/integration-tests
```

---

## M) Contract Schemas (Legacy JSON Schema Format)

| Schema | Location | Purpose |
|--------|----------|---------|
| Runner Manifest | `contracts/runner.manifest.schema.json` | Validate runner registration |
| Event Envelope | `contracts/events.schema.json` | Validate structured log events |
| Report Envelope | `contracts/reports.schema.json` | Validate runner output reports |
| CLI Surface | `contracts/cli.schema.json` | Validate CLI command surface |
| Evidence Packet | `contracts/evidence.schema.json` | Validate evidence/artifact bundles |
| Module Manifest | `contracts/module.manifest.schema.json` | Validate module discovery manifests |
| Audit Trail | `contracts/audit-trail.schema.json` | Validate audit trail entries from compliance runners |

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `NODE_ENV` | No | Environment identifier |
| `CONTROLPLANE_OFFLINE` | No | Skip external repo cloning |
| `CP_SMOKE_ALLOW_MISSING` | No | Allow missing services in smoke tests |
| `GITHUB_TOKEN` | No | GitHub access for workflow automation |
| `CONTROLPLANE_DEMO_TIME` | No | Fixed timestamp for deterministic demo runs |
| `CONTROLPLANE_PROFILE` | No | Emit profile timing logs when `1` |
| `CONTROLPLANE_REQUEST_ID` | No | Correlation ID for profile logs |
