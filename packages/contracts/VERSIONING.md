# Contract Versioning Policy

## Overview

This document defines the versioning policy for ControlPlane contracts. All services in the ecosystem must adhere to these rules to ensure compatibility and prevent drift.

## Semantic Versioning for Contracts

Contracts follow [Semantic Versioning 2.0.0](https://semver.org/):

- **MAJOR**: Breaking changes that require consumer updates
- **MINOR**: Backward-compatible additions (new optional fields, new types)
- **PATCH**: Backward-compatible bug fixes, documentation, internal changes

## Breaking Changes (MAJOR bump)

The following are ALWAYS breaking changes:

1. **Removing or renaming required fields** from any schema
2. **Changing the type** of an existing field
3. **Adding new required fields** without defaults
4. **Removing enum values** from existing enums
5. **Changing error codes** or their meanings
6. **Removing retry categories** from default retry policies
7. **Changing the default value** of a field in a way that changes behavior

## Non-Breaking Changes (MINOR/PATCH)

The following are safe, non-breaking changes:

1. **Adding new optional fields** with sensible defaults
2. **Adding new enum values** (consumers should handle unknown values gracefully)
3. **Adding new schemas/types** that don't affect existing ones
4. **Improving error messages** without changing error codes
5. **Adding new retry categories**
6. **Documentation improvements**

## Version Declaration

Every message, request, and response must include its contract version:

```typescript
{
  "contractVersion": {
    "major": 1,
    "minor": 0,
    "patch": 0
  }
}
```

## Compatibility Ranges

Services declare which contract versions they support:

```typescript
{
  "supportedContracts": ["^1.0.0"]
}
```

Ranges follow npm semver syntax:
- `1.0.0` - exact version
- `^1.0.0` - compatible with 1.x.x
- `~1.0.0` - compatible with 1.0.x
- `>=1.0.0 <2.0.0` - range

## Upgrade Process

### When a Breaking Change is Needed

1. **Designate a migration window** (minimum 30 days for production)
2. **Release new major version** with updated schemas
3. **Maintain both versions** during migration window
4. **Deprecate old version** with clear sunset date
5. **Remove old version** after sunset date

### Consumer Upgrade Steps

1. Run contract tests against new version
2. Update `supportedContracts` range
3. Handle new fields/codes if needed
4. Deploy and verify with e2e tests

## Contract Test Enforcement

All repositories MUST:

1. Run contract tests in CI
2. Fail builds on contract drift
3. Pin contract package version in package.json
4. Update contracts atomically across repos

## Current Versions

| Contract | Current Version | Status |
|----------|----------------|--------|
| Core Contracts | 1.0.0 | Active |

## Changelog

### 1.0.0 (Initial Release)

- Base schemas for jobs, runners, truth assertions
- Error envelope with retry semantics
- Capability metadata for runners
- Health check standards
