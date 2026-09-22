# AGENTS.md

## Purpose

ControlPlane is a contract-first ecosystem for platform services and runners. It provides:

- Canonical Zod schemas (`@controlplane/contracts`) defining APIs and error envelopes
- Contract validation tooling (`@controlplane/contract-test-kit`) for ecosystem compatibility
- Runner scaffolding (`@controlplane/create-runner`) to bootstrap compatible implementations
- SDK generation utilities for downstream consumers
- Benchmark harnesses and optimization utilities

**Done means:**
- Contracts validate without errors
- Compatibility matrix is up to date
- Tests pass (unit, contract, smoke)
- Documentation reflects current state
- No breaking changes to major version contracts

## Repo Map

```
packages/
  contracts/          # Canonical Zod schemas + types + versioning (SOURCE OF TRUTH)
  contract-test-kit/  # CLI validators, registry generators, sync tools
  create-runner/      # Scaffold new ControlPlane-compatible runners
  observability/      # Observability middleware and contract helpers
  sdk-generator/      # Generate SDKs from contracts
  benchmark/          # Benchmark harnesses for contracts and services
  optimization-utils/ # Caching, hardening, monitoring utilities

config/
  distribution.oss.json   # OSS distribution flags
  distribution.cloud.json # Cloud-only feature flags

scripts/
  verify-distribution.js  # Validates OSS/cloud boundaries
  generate-compat-matrix.js # Creates ecosystem compatibility docs
  smoke-test.js           # Health verification for local dev
  secret-scan.js          # Checks for hardcoded secrets
  runner-ci-sanity-check.js # Runner CI guardrails

.github/workflows/        # CI/CD pipelines
docs/                     # Architecture, guides, policy docs
tests/                    # E2E tests (Playwright)
benchmarks/               # Benchmark definitions and results
```

**Sources of Truth:**
- Contracts (JSON Schema): `contracts/`
- Zod types: `packages/contracts/src/types/`
- Error envelopes: `packages/contracts/src/errors/`
- Distribution config: `config/distribution.*.json`
- Compatibility: `docs/COMPATIBILITY.md`

## Golden Rules

1. **No secrets in code**: Use env vars for all credentials. Run `pnpm run secret-scan` before committing.
2. **Contract backwards compatibility**: Schemas must remain compatible within major versions. Breaking changes require version bump.
3. **Deterministic builds**: Always use Turborepo pipelines. No implicit caching assumptions.
4. **No placeholder docs**: Documentation must reflect actual behavior. Remove TODOs or convert to issues.
5. **Fail gracefully**: Contract validation errors must include field-level diagnostics.
6. **Minimal diffs**: Avoid refactoring unrelated code. Keep changes scoped to the task.
7. **OSS/cloud boundary**: Never ship cloud-only features in OSS artifacts. Validate with `pnpm run distribution:verify`.

## Agent Workflow

### 1. Discover
- Read the task description and linked issues/PRs
- Identify the contribution lane (docs, runner, connector, contracts)
- Check existing schemas in `contracts/` and Zod types in `packages/contracts/src/types/`
- Review `docs/CONTRACT-UPGRADE.md` for breaking change protocols

### 2. Diagnose
- Gather evidence before proposing changes:
  - Current contract state (`packages/contracts/src/`)
  - Existing tests (`packages/*/test/` or `tests/`)
  - Compatibility matrix (`docs/COMPATIBILITY.md`)
  - Distribution config (`config/`)

### 3. Implement
- Smallest safe patch principle:
  - Add new schemas alongside existing ones (never modify in place for breaking changes)
  - Update compatibility matrix when versions change
  - Add tests for new schemas before shipping
- Follow contribution lane guardrails from `CONTRIBUTING.md`

### 4. Verify
```bash
pnpm run lint && pnpm run typecheck && pnpm run build && pnpm run test
```

### 5. Report
- Document what changed and why
- Include compatibility impact for ecosystem consumers
- Reference the contract versioning guide for breaking changes

## Command Cookbook

```bash
# Install dependencies
pnpm install

# Development (parallel watch mode)
pnpm run dev

# Local stack (Docker + health check)
pnpm run dev:stack
pnpm run dev:stack:logs
pnpm run dev:stack:down

# Core validation
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build

# Contract-specific
pnpm run build:contracts
pnpm run build:test-kit
pnpm run contract:validate
pnpm run contract:lint

# Compatibility
pnpm run compat:generate
pnpm run compat:check

# Distribution
pnpm run distribution:verify

# Full verification
pnpm run verify  # lint + typecheck + test + build + docs

# Full CI (includes E2E)
pnpm run ci

# Release prep
pnpm run release:validate

# Smoke test
pnpm run test:smoke

# Demo mode (deterministic, offline)
pnpm run demo:reset
pnpm run demo:setup
pnpm run demo:start
```

## Safe-to-Edit Map

- ✅ **Docs & metadata**: `docs/`, `.github/workflows/`, `SECURITY.md`, `AGENTS.md`, `.env.example`
- ✅ **Contracts tooling**: `packages/contract-kit/`, `packages/contract-test-kit/`
- ✅ **CLI & adapters**: `packages/controlplane/`, `scripts/adapters/`, `scripts/demo-*.mjs`
- ⚠️ **Runner manifests**: `runners/*/runner.manifest.json` (validate with contract tests)
- ⚠️ **Distribution config**: `config/distribution.*.json` (verify with `pnpm run distribution:verify`)

## Invariants & Guardrails

- Contract changes must remain backwards compatible within the same major version.
- Runner reports must validate against `contracts/reports.schema.json`.
- Demo mode must remain deterministic (fixed timestamp, no external calls).
- No secrets in repo; `.env.example` is the authoritative template.

## Change Safety Checklist

Before committing:

- [ ] `pnpm run lint` passes (0 errors, warnings acceptable)
- [ ] `pnpm run typecheck` passes
- [ ] `pnpm run build` succeeds
- [ ] `pnpm run test` passes
- [ ] Contract changes validated with `pnpm run contract:validate`
- [ ] Compatibility matrix updated (if version changed)
- [ ] Distribution verified (if OSS/cloud boundaries affected)
- [ ] No unused imports or dead code introduced
- [ ] Documentation updated (in `docs/` or package READMEs)

## Code Standards

- **TypeScript**: Strict mode. No `any` without explicit `eslint-disable` comment explaining why.
- **ESLint**: Config from `.eslintrc.cjs`. Run `pnpm run lint:fix` for auto-fixable issues.
- **Prettier**: Config from `.prettierrc` and `.prettierrc.json`.
- **Testing**: Vitest for unit tests, Playwright for E2E.
- **Schema validation**: Zod for all contracts. Use branded types for semantic distinction.
- **Error handling**: Standard error envelopes from `packages/contracts/src/errors/`.
- **Environment variables**: Document in `.env.example` (do not commit actual values). Validation at runtime.

## PR/Commit Standards

**Branch naming:**
- `feat/contracts-*` for new schemas
- `fix/contract-test-kit-*` for tooling fixes
- `docs/*` for documentation
- `chore/*` for maintenance

**Commit messages:** Conventional Commits (`feat:`, `fix:`, `docs:`, `chore:`, etc.)

```bash
feat(contracts): add heartbeat schema for runners
fix(contract-test-kit): improve contract sync diagnostics
docs: update compatibility matrix for v1.1
chore: add lint rule for schema documentation
```

**PR description should include:**
- What changed and why
- Compatibility impact (major/minor/patch)
- Verification steps run locally
- Links to related issues or design discussions

## Roadmap Hooks

The following improvements are actionable and aligned with current direction:

1. **TypeScript strictness**: Resolve `any` type warnings in `benchmark/src/cli/benchmark-cli.ts` and `observability/src/middleware.ts`
2. **Contract documentation**: Add JSDoc comments to all Zod schemas in `packages/contracts/src/schemas/`
3. **SDK drift detection**: Extend `scripts/check-sdk-drift.js` to cover breaking changes
4. **E2E test coverage**: Add smoke tests for contract validation CLI in `tests/`
5. **Observability middleware hardening**: Improve error handling in `packages/observability/src/middleware.ts`
6. **Benchmark reporting**: Standardize benchmark output format across all harness types
7. **Runner template updates**: Refresh `packages/create-runner/` templates to use latest contracts
8. **Compatibility automation**: Add CI check to fail if `docs/COMPATIBILITY.md` is stale
9. **Dependency auditing**: Regular audit for security vulnerabilities in dependencies
10. **Performance regression tests**: Add latency assertions to benchmark E2E tests
