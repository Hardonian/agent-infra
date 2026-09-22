# Architecture

This repository defines the contracts and tooling that ControlPlane-compatible services and runners rely on. It does **not** ship runtime services and does not retain ownership of data or artifacts processed by consuming implementations.

## Package Dependency Graph

```mermaid
graph TD
    A["@controlplane/contracts<br/>Zod schemas, types, error envelopes"] --> B["@controlplane/contract-test-kit<br/>CLI validators + registry"]
    A --> C["@controlplane/controlplane<br/>Orchestration CLI"]
    A --> D["@controlplane/contract-kit<br/>JSON schema validation helpers"]
    A --> E["@controlplane/sdk-generator<br/>TS / Python / Go SDKs"]
    A --> F["@controlplane/observability<br/>Pino logging + correlation IDs"]
    A --> G["@controlplane/benchmark<br/>Performance harnesses"]
    C --> H["runners/<br/>8 runner manifests"]
    C --> I["artifacts/<br/>reports + evidence"]
    B --> J["CI gates"]
    E --> K["sdks/typescript<br/>sdks/python<br/>sdks/go"]
    L["@controlplane/create-runner<br/>Scaffolding generator"] --> A
    M["@controlplane/optimization-utils<br/>Caching + monitoring"] --> A
```

### ASCII Fallback

```
                      @controlplane/contracts
                    (Zod schemas + types + errors)
                               |
          ┌────────────┬───────┼───────┬────────────┬──────────┐
          v            v       v       v            v          v
   contract-test-kit  controlplane  contract-kit  sdk-generator  observability
   (CLI validators)   (plan/run/    (JSON schema  (TS/Py/Go     (pino logging)
                       doctor CLI)   helpers)      SDK gen)
          |            |                  |
          v            v                  v
     CI gates     runners/            sdks/
                  (8 manifests)       (generated)
                       |
                       v
                  artifacts/
                  (reports + evidence)
```

## Core Packages

### `@controlplane/contracts` — Source of Truth

- **Location:** `packages/contracts/`
- Canonical Zod schemas and TypeScript types for all ControlPlane APIs.
- Error envelope utilities (`{code, message, details?}`).
- Contract versioning rules (semver-based, additive within major).
- Every other package in this repo depends on this one.

### `@controlplane/contract-test-kit` — Validation CLIs

- **Location:** `packages/contract-test-kit/`
- CLI binaries: `contract-test`, `contract-sync`, `capability-registry`, `marketplace`.
- Validates runner manifests, schemas, and contract sync state.
- Produces compatibility reports for CI pipelines.

### `@controlplane/controlplane` — Orchestration CLI

- **Location:** `packages/controlplane/`
- Commands: `plan` (dry-run execution plan), `run` (invoke runners), `doctor` (health check).
- Discovers runner manifests from `runners/` directory.
- Validates runner outputs (reports + evidence) against contract schemas.
- Writes artifacts to `artifacts/<runner>/<timestamp>/`.

### `@controlplane/create-runner` — Runner Scaffolding

- **Location:** `packages/create-runner/`
- Interactive CLI (`create-runner`) to generate new runner implementations.
- Templates: `http-connector`, `queue-worker`.
- Produces correct contract imports and test stubs.

### `@controlplane/sdk-generator` — SDK Generation

- **Location:** `packages/sdk-generator/`
- Generates TypeScript, Python, and Go SDKs from contract schemas.
- Output: `packages/sdk-generator/sdks/{typescript,python,go}/`.

### `@controlplane/observability` — Logging & Correlation

- **Location:** `packages/observability/`
- Pino-based structured logging with correlation ID propagation.
- Shared observability contract for all ControlPlane services.

### `@controlplane/benchmark` — Performance Testing

- **Location:** `packages/benchmark/`
- Benchmark harnesses for contract validation, queue, health, latency, and scale.
- CLI: `cp-benchmark`.

### `@controlplane/optimization-utils` — Utilities

- **Location:** `packages/optimization-utils/`
- Caching, hardening, and monitoring helpers.

## Supporting Directories

| Directory | Purpose |
|---|---|
| `contracts/` | JSON Schema files (reports, evidence, runner manifest, events, audit-trail, module manifest, CLI) |
| `runners/` | Runner manifest files (8 runners: JobForge, truthcore, aias, autopilot-suite, finops/growth/ops/support-autopilot) |
| `scripts/` | Validation, diagnostics, release, secret scanning, compatibility matrix generation |
| `config/` | OSS/cloud distribution flags |
| `tests/` | E2E (Playwright), integration, golden-fixture tests |
| `benchmarks/` | Performance benchmark definitions |

## Data Flow

### Plan Phase (`controlplane plan`)

1. Scan `runners/` for `runner.manifest.json` files.
2. Validate each manifest against `contracts/runner.manifest.schema.json`.
3. Check SDK exports and schema presence.
4. Output a JSON execution plan with ordered steps.

### Run Phase (`controlplane run`)

1. Load execution plan.
2. Invoke each runner's entrypoint with golden fixture input.
3. Validate each runner's report against `contracts/reports.schema.json`.
4. Validate each runner's evidence against `contracts/evidence.schema.json`.
5. Write artifacts to `artifacts/<runner>/<timestamp>/`.
6. Produce aggregate summary.

### Validation Phase (CI)

1. `contracts:check` validates all manifests + schemas.
2. `compat:check` detects version drift across ecosystem.
3. `distribution:verify` enforces OSS/cloud feature boundaries.
4. `lint` + `typecheck` + `test` run across all packages via Turborepo.

## Build System

- **Turborepo** orchestrates builds across the monorepo.
- **tsup** bundles TypeScript packages (ESM + CJS + DTS).
- **Vitest** runs unit tests.
- **Playwright** runs E2E tests against the local Docker stack.
- Build order respects workspace dependencies (`^build` in turbo.json).

## Security Boundaries

### Authentication & Authorization

This repository implements contracts only. Authentication/authorization logic is delegated to downstream implementations. Generated runners should enforce authN/authZ at the API gateway or inside the runner, depending on platform requirements.

### Secrets Hygiene

- Use `.env.example` as the reference list of environment variables
- Run `pnpm run secret-scan` before committing changes
- No API keys, tokens, passwords, or credentials committed to repository

### Input Validation

All contracts are validated using Zod schemas:

```typescript
import { JobRequest, RunnerCapability, HealthCheck } from '@controlplane/contracts';

// Validation example
const result = JobRequest.safeParse(input);
if (!result.success) {
  // Handle validation errors
}
```

### Error Security

Errors use `ErrorEnvelope` with standardized fields to prevent information leakage:

| Field | Security Consideration |
|-------|------------------------|
| `id` | UUID prevents information leakage |
| `category` | Categorizes error type |
| `severity` | Helps with alerting |
| `message` | Should not expose internals |
| `details` | Structured debugging info |
| `correlationId` | Request tracing |

## Integration Patterns

### Runner Discovery

ControlPlane detects runners in three locations (priority order):

1. **Primary path**: `<repoRoot>/runners/*/runner.manifest.json`
2. **Fallback path**: `<repoRoot>/.cache/repos/*/runner.manifest.json`
3. **Cached clones**: `.cache/repos/<name>` within the repo

### Command Invocation Flow

```
controlplane run <runner> --input <file> --out <path>
  │
  ├─ Load runner manifest
  ├─ Validate manifest schema
  ├─ Write input JSON to temp file
  ├─ Spawn runner process (node scripts/adapters/runner-adapter.mjs)
  ├─ Read output report JSON
  ├─ Validate report against schema
  └─ Validate evidence packet against schema
```

### Correlation ID Propagation

All operations propagate correlation IDs through the request lifecycle:

1. Extract from incoming request headers (`X-Correlation-Id`)
2. Generate new UUID if not present
3. Propagate through all async operations
4. Include in all logs and metrics

### Error Handling Patterns

All CLI errors are typed with:
- **Error code**: Machine-readable identifier
- **Message**: Human-readable description
- **Hint**: Actionable remediation step

Example:
```json
{
  "error": "RUNNER_NOT_FOUND",
  "message": "Runner 'foo' was not found in any manifest directory.",
  "hint": "Ensure a runner.manifest.json for 'foo' exists under runners/."
}
```

## Extension Points

See [EXTENSION-GUIDE.md](./EXTENSION-GUIDE.md) for step-by-step instructions on:

- Adding a new runner
- Adding a new connector
- Adding a new validation rule
- Extending contract schemas
