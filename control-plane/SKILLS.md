# SKILLS.md

## How to Use This File

Use this guide to route tasks to the right agent/model/tooling. Match your task type to the appropriate skill lane, follow the validation steps, and ensure DoD is met before marking complete.

## Current Capability Inventory

### UI/Frontend
- **Detected**: No
- **Note**: This is a contracts/tooling repo. No UI components or frontend routes exist. See `packages/optimization-utils` for frontend hardening utilities intended for downstream consumers.

### Content System
- **Detected**: Yes
- **Location**: `docs/`, `README.md`, package READMEs
- **Update method**: Direct file edits, validated by `pnpm run format:check`

### Tooling (Lint/Typecheck/Test/Build)
- **Detected**: Yes
- **TypeScript**: Strict mode via `tsconfig.json` per package
- **Linting**: ESLint + Prettier, enforced via `pnpm run lint`
- **Testing**: Vitest (unit), Playwright (E2E)
- **Build**: Turborepo + tsup/tsc per package
- **Validation scripts**: `scripts/` directory with distribution, compatibility, SDK checks

### CI/CD
- **Detected**: Yes
- **Workflows**:
  - `.github/workflows/ci.yml` - Core CI (lint, typecheck, test, build)
  - `.github/workflows/compatibility.yml` - Compatibility matrix checks
  - `.github/workflows/e2e.yml` - Playwright E2E tests
  - `.github/workflows/release.yml` - Semantic release pipeline
  - `.github/workflows/sdk-generation.yml` - SDK generation
  - `.github/workflows/sdk-publish.yml` - SDK publishing
  - `.github/workflows/sdk-smoke-tests.yml` - SDK smoke validation
  - `.github/workflows/security.yml` - Security scanning

### Observability
- **Detected**: Yes
- **Package**: `packages/observability/` - Observability middleware helpers
- **Monitoring utilities**: `packages/optimization-utils/monitoring/`
- **Note**: Intended for downstream consumers; this repo validates contracts only

## Skill Lanes

### Product/UX Writing
- **Examples**: Documentation updates, contract JSDoc, error message wording
- **Tone**: Technical, precise, consultancy-appropriate
- **Location**: `docs/`, package READMEs, inline schema comments
- **Validation**: `pnpm run format:check`, human review for accuracy

### UI System Work (Downstream)
- **Examples**: Design token updates (not present), Tailwind config (not present)
- **Note**: No UI system exists in this repo. `packages/optimization-utils` provides utilities for downstream consumers.

### Frontend Engineering
- **Examples**: N/A - no frontend in this repo
- **Note**: Refer to `packages/optimization-utils` for hardening utilities

### Integration Boundaries
- **Examples**: SDK generation, contract sync, registry generation, module discovery
- **Tooling**: `packages/contract-test-kit/src/`, `packages/controlplane/src/registry/`
- **Commands**:
  - `pnpm run contract:sync` - Sync schemas to implementations
  - `pnpm run sdk:generate` - Generate SDKs
  - `pnpm run capability:registry` - Generate capability registry
  - `pnpm controlplane list` - List discovered modules
  - `pnpm controlplane run demo` - Execute integration pipeline

### QA & Release
- **Examples**: Contract validation, compatibility checks, smoke tests, integration testing
- **Tooling**: `scripts/` directory, `packages/controlplane/src/cli.ts`
- **Commands**:
  - `pnpm run contract:validate` - Validate contracts
  - `pnpm run compat:check` - Check compatibility matrix
  - `pnpm run test:smoke` - Smoke test local services
  - `pnpm run distribution:verify` - Verify OSS/cloud boundaries
  - `pnpm controlplane run demo` - Execute full pipeline integration test
  - `pnpm controlplane verify:ecosystem` - Detect ecosystem drift

## Which Agent for Which Task

| Task Type | Recommended Approach | Validation |
|-----------|---------------------|------------|
| Schema evolution | Engineer agent + contracts expert | `contract:validate` + `contract:lint` + compatibility check |
| Documentation updates | Human with LLM pass | `format:check` + human accuracy review |
| SDK generation | Script/tool agent | `sdk:generate` + `sdk:validate` |
| Contract validation | Automated CI | `contract:validate` + `compat:check` |
| Breaking changes | Engineer + design review | Version bump + changelog + migration guide |
| Error handling improvements | Engineer agent | Test coverage + error envelope validation |
| TypeScript strictness | Engineer agent | Lint warnings resolved + typecheck passes |
| Benchmark reporting | Performance engineer | Benchmark passes + regression detection |

## Known Risks & Pitfalls

| Symptom | Likely Cause | Diagnosis Steps |
|---------|--------------|-----------------|
| Lint warnings about `any` types | Incomplete TypeScript migration | Run `pnpm run lint` and check `benchmark/src/cli/benchmark-cli.ts` and `observability/src/middleware.ts` |
| Contract validation fails | Schema drift or missing sync | Run `pnpm run contract:sync` then `contract:validate` |
| Compatibility matrix stale | Version bump without matrix update | Run `pnpm run compat:generate` and commit changes |
| Build fails after schema change | Missing version export | Check `packages/contracts/src/versioning/` exports |
| Distribution verify fails | Cloud-only feature in OSS artifacts | Run `pnpm run distribution:verify` and check `config/` |
| SDK drift detected | Generated SDK out of sync | Run `pnpm run sdk:check` and regenerate if needed |

## Roadmap

### 30 Days: Stabilize
- Resolve all `any` type warnings across packages
- Add JSDoc comments to all Zod schemas in `packages/contracts/src/schemas/`
- Add E2E smoke tests for contract validation CLI
- Update runner templates to match latest contracts
- Ensure all scripts pass `secret-scan`

### 60 Days: Enforcement
- Add CI gate to fail if `docs/COMPATIBILITY.md` is stale
- Implement automated SDK drift detection and alerting
- Standardize benchmark output format across harness types
- Add contract version deprecation warning system
- Complete observability middleware error handling

### 90 Days: Deep Improvements
- Expand SDK language support based on compatibility matrix
- Add breaking change detection for major versions
- Implement schema migration tooling for consumers
- Create contributor onboarding improvements
- Establish performance regression baseline

## Definition of Done (DoD)

A change is ship-ready when:

1. **Commands green**:
   - `pnpm run lint` passes (0 errors, warnings documented)
   - `pnpm run typecheck` passes
   - `pnpm run test` passes
   - `pnpm run build` succeeds

2. **Contracts valid**:
   - `pnpm run contract:validate` exits 0
   - `pnpm run contract:lint` passes
   - Compatibility matrix updated if versions changed

3. **Distribution correct**:
   - `pnpm run distribution:verify` passes
   - No cloud-only features in OSS artifacts

4. **Documentation complete**:
   - Inline schema comments added/updated
   - `docs/` updated for new features
   - README reflects current state

5. **No regressions**:
   - Existing tests still pass
   - Smoke tests pass
   - No new `any` types introduced without justification

6. **Commit ready**:
   - Conventional commit message
   - Branch follows naming convention
   - PR description includes verification steps
