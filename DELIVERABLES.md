# ControlPlane Contracts & Tooling - Deliverables

## Project Overview

A contracts-and-tooling repository that provides the canonical ControlPlane schemas, validation utilities, compatibility reporting, and scaffolding for runners. It ships no runtime services and does not retain ownership of artifacts processed by consuming implementations.

## Repository Layout

```
ControlPlane/
├── packages/
│   ├── contracts/             # Canonical Zod schemas + types
│   ├── contract-test-kit/     # Contract validation CLI + helpers
│   ├── create-runner/         # Runner scaffolding CLI
│   ├── observability/         # Observability contract helpers
│   ├── sdk-generator/         # SDK generation utilities
│   └── benchmark/             # Contract benchmark harnesses
├── scripts/                    # Repo-wide validation utilities
├── config/                     # OSS/cloud distribution flags
├── docs/                       # Documentation
└── .github/workflows/          # CI workflows
```

## Key Capabilities

- Contract schemas and error envelopes.
- Contract validation tooling and registries.
- Compatibility matrix generation.
- Runner scaffolding templates.
- Distribution config validation.

## Primary Commands

```bash
pnpm install
pnpm run build:contracts
pnpm run build:test-kit
pnpm run contract:validate
pnpm run compat:generate
pnpm run verify
```

## Notes

This repository does not ship runtime services. Service implementations should consume the contracts and validation tools from here. All schemas, configurations, and artifacts remain under the control of implementing organizations.
