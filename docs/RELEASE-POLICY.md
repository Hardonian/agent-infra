# Release Policy

This repository ships contracts and tooling packages. Releases must protect compatibility across the ecosystem. Implementing organizations should evaluate releases against their own change management and approval processes.

## Versioning

We follow semantic versioning:

- **Patch**: bug fixes, no schema changes.
- **Minor**: backwards-compatible schema additions and tooling improvements.
- **Major**: breaking schema changes or contract semantics changes.

## Contract Compatibility

- Breaking changes require a major version bump.
- Compatibility ranges are tracked in the compatibility matrix.
- Update compatibility ranges in package metadata when breaking changes ship.

## Release Workflow

1. Update contracts/tooling.
2. Run `pnpm run verify`.
3. Update `docs/COMPATIBILITY.md` with `pnpm run compat:generate`.
4. Merge to `main` and release via CI.

## Pre-Release (Optional)

Use prerelease tags (`next`) for ecosystem testing before a major release.
