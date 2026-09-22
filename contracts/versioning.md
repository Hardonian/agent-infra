# ControlPlane Contract Versioning

## Semver rules
- **Major**: breaking changes to any contract schema, field removals, or incompatible behavior.
- **Minor**: backward-compatible additions (new optional fields, new event types, new report fields).
- **Patch**: clarifications, docs, or constraints that do not change schema shape.

## Compatibility expectations
- Producers must only **add** optional fields within a major version.
- Consumers must ignore unknown fields.
- Deprecations must be documented for at least one minor release before removal.

## Contract validation
- Contract test kit validates JSON payloads against the canonical schemas.
- Failing validation is a **hard error** for CI and runtime verification.
