# OSS vs Cloud Boundary

This repository ships contracts and tooling for the ControlPlane ecosystem. It does not ship hosted services. The OSS/cloud boundary is expressed through distribution configuration and validation scripts so downstream services can make explicit decisions. All schemas, tools, and configurations remain under the control of implementing organizations.

## Principles

- OSS artifacts remain usable on their own.
- Cloud-only features must be explicit, not hidden.
- Distribution flags are validated in CI with `scripts/verify-distribution.js`.

## OSS Distribution

OSS artifacts include:

- Contracts (`@controlplane/contracts`)
- Validation tooling (`@controlplane/contract-test-kit`)
- Runner scaffolding (`@controlplane/create-runner`)
- Compatibility tooling (`scripts/generate-compat-matrix.js`)

## Cloud Distribution

Hosted features (dashboards, SLAs, managed hosting) are **out of scope** for this repository. Downstream service implementations should use the distribution config to expose cloud-only features explicitly. Implementing organizations retain full control over feature decisions and deployment configurations.

## Distribution Config

- `CONTROLPLANE_DISTRIBUTION` (`oss` or `cloud`)
- `CONTROLPLANE_DISTRIBUTION_CONFIG` (optional path override)

Config files live in:

- `config/distribution.oss.json`
- `config/distribution.cloud.json`

CI validates these via `pnpm run distribution:verify`.
