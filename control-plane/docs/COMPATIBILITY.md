# Compatibility Matrix

> **Generated**: 2026-02-04T02:54:41.666Z
> **Contract Version**: 1.0.0

## Current Component Versions

| Component | Version | Contract Range | Status | Location |
|-------------|---------|----------------|--------|----------|
| @controlplane/benchmark | 1.0.0 | 1.0.0 - <2.0.0 | ✅ active | packages/benchmark |
| @controlplane/contract-test-kit | 1.0.0 | 1.0.0 - <2.0.0 | ✅ active | packages/contract-test-kit |
| @controlplane/contracts | 1.0.0 | 1.0.0 - <2.0.0 | ✅ active | packages/contracts |
| @controlplane/create-runner | 1.0.0 | 1.0.0 - <2.0.0 | ✅ active | packages/create-runner |
| @controlplane/observability | 1.0.0 | 1.0.0 - <2.0.0 | ✅ active | packages/observability |
| @controlplane/sdk-generator | 1.0.0 | 1.0.0 - <2.0.0 | ✅ active | packages/sdk-generator |
| @controlplane/orchestrator | 1.0.0 | 1.0.0 - <2.0.0 | ✅ active | root |

## Contract Compatibility

| Component | Compatible Contract Versions |
|-------------|------------------------------|
| @controlplane/benchmark | 1.0.0 <= version < 2.0.0 |
| @controlplane/contract-test-kit | 1.0.0 <= version < 2.0.0 |
| @controlplane/contracts | 1.0.0 <= version < 2.0.0 |
| @controlplane/create-runner | 1.0.0 <= version < 2.0.0 |
| @controlplane/observability | 1.0.0 <= version < 2.0.0 |
| @controlplane/sdk-generator | 1.0.0 <= version < 2.0.0 |
| @controlplane/orchestrator | 1.0.0 <= version < 2.0.0 |

## Automated Checks

This matrix is automatically generated on every release. CI gates will fail if:

- Component versions drift beyond declared contract ranges
- Breaking changes are introduced in non-major versions
- Contract compatibility declarations are missing

---

**Note**: This matrix is auto-generated. Do not edit manually. Run `pnpm run compat:generate` to update.