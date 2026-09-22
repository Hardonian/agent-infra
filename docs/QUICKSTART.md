# Quickstart

Get the ControlPlane contracts and tooling running locally. This tooling is designed to integrate into existing operating models and change management processes.

## Prerequisites

- Node.js 18+
- pnpm 8+
- npmjs registry for all scopes

## Setup

```bash
pnpm install
pnpm run build:contracts
pnpm run build:test-kit
```

### Registry Configuration (required)

Create or update `.npmrc` with:

```ini
registry=https://registry.npmjs.org/
@Hardonian:registry=https://registry.npmjs.org/
always-auth=false
```

## Validate Contracts

```bash
pnpm run contract:validate
```

## Generate Compatibility Matrix

```bash
pnpm run compat:generate
```

This writes `docs/COMPATIBILITY.md` using the current package versions.

## Next Steps

- Review [Contracts Versioning](../packages/contracts/VERSIONING.md).
- Use the [Create Runner Quickstart](./CREATE-RUNNER-QUICKSTART.md) to scaffold a runner.
- Integrate `contract-test` into downstream CI pipelines.
