# Deployment & Operations

This repository ships contracts and tooling only. There are no hosted services to deploy, but you can run the CLI tooling locally or in CI.

## Local Usage

```bash
pnpm install
pnpm run build
pnpm run contract:validate
```

## Demo Mode (Deterministic, Offline)

Demo mode produces deterministic artifacts using the local runner adapter. It never calls external services.

```bash
pnpm run demo:reset
pnpm run demo:start
```

Artifacts are written to `demo/` (report, evidence, manifest). Use `CONTROLPLANE_DEMO_TIME` to pin a fixed timestamp.

## CI Usage

Recommended CI gates:

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run test:e2e:demo
pnpm run contract:validate
pnpm run compat:check
pnpm run distribution:verify
```

## Production Consumers

If you embed these tools in production pipelines:

- Lock dependency versions with `pnpm-lock.yaml`.
- Run `pnpm run secret-scan` before releases.
- Validate reports and evidence packets before ingestion.
# Deployment Guide

This repo ships contracts, tooling, and runner templates. There is no production ControlPlane service in this repo; deployments focus on CI/tooling and generated runners.

## Local Development

### Prerequisites
- Node.js 18+
- pnpm 8+

### Install Dependencies

```bash
pnpm install
```

### Core Validation

```bash
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run build
```

### Contract Validation

```bash
pnpm run build:contracts
pnpm run build:test-kit
pnpm run contract:validate
```

### E2E Tests (requires running services)

```bash
pnpm run test:e2e
```

## Runner Template Deployment

Generated runners are standard Node.js services. For the Express templates in `packages/create-runner/templates/*`:

1. Copy `.env.example` and configure values for your environment.
2. Start the service (example):

```bash
pnpm install
pnpm run build
node dist/index.js
```

### Required Environment Variables

Use `.env.example` as the source of truth. At minimum, configure:

- `JOBFORGE_URL`
- `EXTERNAL_API_URL` / `EXTERNAL_API_KEY` (http-connector template)
- `REDIS_URL` (queue-worker template)
- `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` (if overriding defaults)

## Production Notes

- Deploy generated runners behind a reverse proxy that terminates TLS.
- Configure per-runner authentication/authorization at the edge.
- For rate limiting beyond the in-memory defaults, use a shared store (Redis) or API gateway.
- Capture structured logs (JSON) from stdout/stderr to your observability stack.
