# Create Runner Quickstart

Use the scaffolding tool in this repository to bootstrap a ControlPlane-compatible runner.

## Prerequisites

- Node.js 18+
- pnpm 8+
- npmjs registry for all scopes

### Registry Configuration (required)

Create or update `.npmrc` with:

```ini
registry=https://registry.npmjs.org/
@Hardonian:registry=https://registry.npmjs.org/
always-auth=false
```

## Build the Scaffold Tool

```bash
pnpm install
pnpm --filter @controlplane/create-runner build
```

## Generate a Runner

```bash
node packages/create-runner/bin/create-runner.js
```

Follow the prompts to name the runner and select templates.

## Validate the Generated Runner

From the generated runner directory:

```bash
pnpm add @controlplane/contracts @controlplane/contract-test-kit
pnpm exec contract-test
```

## Next Steps

- Implement your capability logic.
- Add runtime validation using the generated schemas.
- Keep contract versions in sync with upstream releases.
