# Invariants

These are rules that must **never** be broken. They protect consumers of the contracts and tooling from silent regressions.

## Schema Invariants

### 1. Backwards compatibility within major versions

Contract schemas must not remove or narrow fields within the same major version. All changes within a major version must be additive (new optional fields only).

**Why:** Downstream services and runners depend on these schemas. Removing a field breaks deserialization in every consumer.

**Enforced by:** `pnpm run compat:check` (strict mode fails on drift).

### 2. JSON Schemas and Zod schemas must agree

The JSON Schema files in `contracts/` and the Zod schemas in `packages/contracts/src/` must produce the same validation results for all inputs. The Zod schemas are the source of truth; JSON Schemas are derived.

**Why:** SDK generators and CI tools may use either format. Disagreement causes silent drift.

**Enforced by:** `pnpm run contract:sync:check`.

### 3. Required fields in schemas

These required fields must exist in their respective schemas and must never be removed:

| Schema | Required fields |
|---|---|
| `reports.schema.json` | `runner`, `status`, `startedAt`, `finishedAt`, `summary` |
| `evidence.schema.json` | `id`, `runner`, `timestamp`, `hash`, `items` |
| `runner.manifest.schema.json` | `name`, `version`, `description`, `entrypoint` |
| `module.manifest.schema.json` | (see schema) |

**Enforced by:** `pnpm run contracts:check`.

## Validation Invariants

### 4. Deterministic validation

The same input to any validation command must always produce the same pass/fail result, regardless of environment, time, or execution order.

**Why:** Non-deterministic validation makes CI flaky and erodes trust.

**Enforced by:** `pnpm run test:golden` (TruthCore determinism test).

### 5. Error envelopes stay parseable

Error objects follow the shape `{ code: string, message: string, details?: object }`. This shape must not change within a major version.

**Why:** Error-handling code in consumers pattern-matches on this structure.

### 6. Validation failures include field paths

When a schema validation fails, the error output must include the JSON path to the failing field (e.g., `runner.name`).

**Why:** Field-level diagnostics let consumers fix issues without guessing.

**Enforced by:** Zod's built-in error paths in `@controlplane/contracts`.

## Runner Invariants

### 7. Every runner must have a valid manifest

Every directory under `runners/` must contain a `runner.manifest.json` that passes validation against `contracts/runner.manifest.schema.json`.

**Enforced by:** `pnpm run contracts:check`.

### 8. Runner entrypoints must accept standard flags

Runner entrypoints must accept `--input <path>`, `--out <path>`, and `--format json`.

**Why:** The orchestration CLI invokes runners using these flags. Non-conforming runners break the execution pipeline.

### 9. Runner outputs must conform to contract schemas

Reports must validate against `contracts/reports.schema.json`. Evidence packets must validate against `contracts/evidence.schema.json`.

**Enforced by:** `pnpm run controlplane:run:smoke` validates outputs post-execution.

## Repository Invariants

### 10. No secrets in source

No API keys, tokens, passwords, or other credentials may be committed to this repository.

**Enforced by:** `pnpm run secret-scan`.

### 11. No placeholder documentation

Every command, file path, and code example in docs must be runnable and reference real files that exist in the repository.

**Why:** Placeholder docs erode trust and waste contributor time.

**Enforced by:** `pnpm run docs:verify`.

### 12. OSS/cloud boundary enforcement

Features flagged as cloud-only in `config/` must not appear in OSS builds. Features flagged as OSS must remain available.

**Enforced by:** `pnpm run distribution:verify`.

## How to Verify All Invariants

```bash
# Run everything
pnpm run verify

# Or individually:
pnpm run contracts:check       # Invariants 1-3, 7, 9
pnpm run compat:check          # Invariant 1
pnpm run test:golden           # Invariant 4
pnpm run secret-scan           # Invariant 10
pnpm run docs:verify           # Invariant 11
pnpm run distribution:verify   # Invariant 12
```
