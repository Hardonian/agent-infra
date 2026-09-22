# Extension Guide

How to extend ControlPlane with new runners, connectors, validation rules, and contract schemas.

---

## Add a New Runner

Runners are discovered from the `runners/` directory. Each runner has a manifest and an entrypoint.

### Option A: Use the scaffolding tool

```bash
# Interactive scaffolding — generates manifest, entrypoint, and tests
npx @controlplane/create-runner
```

This generates a runner from a template (`http-connector` or `queue-worker`) with the correct structure.

### Option B: Manual setup

**Step 1:** Create the runner directory and manifest.

```bash
mkdir -p runners/my-runner
```

Create `runners/my-runner/runner.manifest.json`:

```json
{
  "name": "my-runner",
  "version": "0.1.0",
  "description": "What this runner does",
  "entrypoint": {
    "command": "node",
    "args": ["scripts/adapters/runner-adapter.mjs", "--runner", "my-runner"]
  },
  "capabilities": ["adapter", "dry-run"],
  "requiredEnv": [],
  "outputs": ["report"]
}
```

**Step 2:** Implement the entrypoint.

The entrypoint must accept these flags:
- `--input <path>` — path to a JSON input file
- `--out <path>` — path to write the output report
- `--format json` — output format

The entrypoint must produce a report conforming to `contracts/reports.schema.json`:

```json
{
  "runner": { "name": "my-runner", "version": "0.1.0" },
  "status": "success",
  "startedAt": "2025-01-01T00:00:00Z",
  "finishedAt": "2025-01-01T00:00:01Z",
  "summary": "All checks passed"
}
```

**Step 3:** Validate.

```bash
# Check the manifest is valid
pnpm run contracts:check

# Run the full plan to see your runner in the execution order
pnpm run controlplane:plan

# Run diagnostics to confirm discovery
pnpm run doctor
```

**Step 4:** Update docs.

- Add your runner to `docs/reality/EXECUTION_GRAPH.md`.
- Add your runner to `docs/reality/REPO_SCAN_MATRIX.md`.

---

## Add a New Connector

Connectors are runner templates that connect to external systems. They follow the same contract as runners but are typically distributed via the marketplace.

**Step 1:** Create a connector template.

```bash
mkdir -p packages/create-runner/templates/my-connector
```

Add these files:
- `runner.manifest.json` — same schema as runners
- `src/index.ts` — connector implementation
- `src/config.ts` — configuration schema (Zod)
- `test/connector.test.ts` — test stubs
- `README.md` — usage documentation

**Step 2:** Register the template.

Add your template name to the choices in `packages/create-runner/src/` so the interactive CLI offers it.

**Step 3:** Validate against contracts.

```bash
pnpm run build:contracts
pnpm run contracts:check
pnpm run connectors:test
```

**Step 4:** Submit to marketplace (optional).

See [MARKETPLACE-SUBMISSION-GUIDE.md](./MARKETPLACE-SUBMISSION-GUIDE.md) for submission requirements.

---

## Add a New Validation Rule

Validation rules are implemented in `@controlplane/contract-test-kit` and run during `contracts:check`.

**Step 1:** Add the rule to the test kit.

Edit `packages/contract-test-kit/src/index.ts` and add a new validation function:

```typescript
import { z } from 'zod';

export function validateMyRule(data: unknown): ValidationResult {
  const schema = z.object({
    // your validation schema
  });
  return validateWithSchema(schema, data);
}
```

**Step 2:** Register the rule in the CLI.

Edit `packages/contract-test-kit/src/cli.ts` to invoke your validation function as part of the test suite.

**Step 3:** Add tests.

Create or update a test file in `packages/contract-test-kit/test/`:

```typescript
import { describe, it, expect } from 'vitest';
import { validateMyRule } from '../src/index.js';

describe('my-rule', () => {
  it('passes for valid input', () => {
    expect(validateMyRule(validData).success).toBe(true);
  });

  it('fails for invalid input', () => {
    expect(validateMyRule(invalidData).success).toBe(false);
  });
});
```

**Step 4:** Verify.

```bash
pnpm run build:test-kit
pnpm run test:contracts
pnpm run contracts:check
```

---

## Extend Contract Schemas

Schema changes affect every consumer. Follow the [Contract Upgrade Guide](./CONTRACT-UPGRADE.md) and respect these rules:

### Additive changes (minor version)

Adding a new optional field is safe within a major version:

```typescript
// packages/contracts/src/types/report.ts
export const ReportSchema = z.object({
  runner: RunnerSchema,
  status: z.enum(['success', 'failed', 'degraded']),
  startedAt: z.string().datetime(),
  finishedAt: z.string().datetime(),
  summary: z.string().min(1),
  // NEW: optional field — safe to add
  tags: z.array(z.string()).optional(),
});
```

After making the change:

```bash
# 1. Build contracts
pnpm run build:contracts

# 2. Sync JSON schemas
pnpm run contract:sync:fix

# 3. Validate everything
pnpm run contracts:check

# 4. Check compatibility
pnpm run compat:check

# 5. Run full test suite
pnpm run test
```

### Breaking changes (major version)

Removing or narrowing a field requires a major version bump. You must:

1. File a [contract change proposal](https://github.com/Hardonian/ControlPlane/issues/new?template=contract-change.yml).
2. Include a migration plan and downstream impact analysis.
3. Update the compatibility matrix.
4. Coordinate with downstream consumers before merging.

### Adding a new schema

1. Create the JSON Schema in `contracts/my-schema.schema.json`.
2. Create the Zod schema in `packages/contracts/src/types/`.
3. Export it from `packages/contracts/src/index.ts`.
4. Add validation to `packages/contract-test-kit/`.
5. Run `pnpm run contracts:check` to verify.

---

## Checklist for Any Extension

- [ ] `pnpm run build` succeeds
- [ ] `pnpm run test` passes
- [ ] `pnpm run contracts:check` exits 0
- [ ] `pnpm run lint` passes
- [ ] `pnpm run typecheck` passes
- [ ] Documentation updated
- [ ] Conventional commit message used
