# Contract Upgrade Guide

This guide explains how to adopt `@controlplane/contracts` and keep your implementation compatible. Organizations should evaluate contract changes against their own change management and approval processes before adoption.

## Overview

`@controlplane/contracts` provides:

- Zod schemas for request/response payloads
- TypeScript types and error envelopes
- Version utilities for contract compatibility

## Upgrade Steps

### 1. Install the Packages

```bash
pnpm add @controlplane/contracts
pnpm add -D @controlplane/contract-test-kit
```

### 2. Replace Local Schemas

Before:

```typescript
export interface JobRequest {
  id: string;
  type: string;
  payload: unknown;
}
```

After:

```typescript
import { JobRequest } from '@controlplane/contracts';
export type { JobRequest };
```

### 3. Validate Requests at Runtime

```typescript
import { JobRequest } from '@controlplane/contracts';

export function handleJob(input: unknown) {
  const validated = JobRequest.parse(input);
  return validated;
}
```

### 4. Use Structured Errors

```typescript
import { createErrorEnvelope } from '@controlplane/contracts';

const error = createErrorEnvelope({
  category: 'RUNTIME_ERROR',
  severity: 'error',
  code: 'EXECUTION_FAILED',
  message: 'Something went wrong',
  service: 'my-service',
  retryable: true,
});
```

### 5. Add Contract Tests

```bash
pnpm exec contract-test
```

### 6. Add CI Gate

```yaml
- name: Contract Tests
  run: pnpm exec contract-test --json
```

## Verification Checklist

- Contracts package installed
- Runtime validation in critical handlers
- Error envelopes used consistently
- `contract-test` passes in CI

## Troubleshooting

### "Cannot find module '@controlplane/contracts'"

Ensure your lockfile is up to date and dependencies are installed:

```bash
pnpm install
```

### Schema validation fails

Use `safeParse` to inspect issues:

```typescript
const result = JobRequest.safeParse(input);
if (!result.success) {
  console.log(result.error.issues);
}
```

## Getting Help

- Review contract schemas in `packages/contracts/src`.
- Review validation helpers in `packages/contract-test-kit/src`.
- Open a GitHub issue if you need assistance.
