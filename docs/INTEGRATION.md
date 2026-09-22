# ControlPlane Integration Guide

## Architecture

ControlPlane is a CLI + SDK orchestrator that coordinates multiple runner services (TruthCore, JobForge, autopilot variants, AIAS) through a contract-first architecture.

### Component Hierarchy

```
┌─────────────────────────────────────────────────────┐
│  controlplane CLI  (packages/controlplane/src/cli.ts)│
│    plan │ run │ doctor │ list │ verify-integrations  │
├─────────────────────────────────────────────────────┤
│  SDK layer         (packages/controlplane/src/index.ts)
│    ControlPlaneClient · runRunner · listRunnerManifests
├─────────────────────────────────────────────────────┤
│  Discovery         (src/discovery.ts)                │
│    discoverSiblings · findMissingSiblings            │
├─────────────────────────────────────────────────────┤
│  Compatibility     (src/compatibility.ts)            │
│    validateCompatibility                             │
├─────────────────────────────────────────────────────┤
│  Registry          (src/registry/index.ts)           │
│    listRunners · resolveRunner                       │
├─────────────────────────────────────────────────────┤
│  Invoke            (src/invoke/index.ts)             │
│    runEntrypoint · readJsonFile · ensureAbsolutePath  │
├─────────────────────────────────────────────────────┤
│  Contracts         (@controlplane/contracts)         │
│  Contract Kit      (@controlplane/contract-kit)      │
│    validateReport · validateRunnerManifest            │
│    validateEvidencePacket · validateEvent             │
└─────────────────────────────────────────────────────┘
```

### Invocation Graph

```
controlplane run --smoke
  │
  ├─ listRunnerManifests()
  │    └─ scan runners/ and .cache/repos/ for runner.manifest.json
  │
  ├─ for each runner:
  │    ├─ writeInputFile(goldenFixture)
  │    ├─ runEntrypoint(command, args)
  │    │    └─ spawn(node scripts/adapters/runner-adapter.mjs --runner <name> ...)
  │    ├─ readJsonFile(outputPath)  → report.json
  │    ├─ validateReport(report)
  │    └─ validateEvidencePacket(report.data.evidence)
  │
  └─ write artifacts/smoke/<timestamp>/manifest.json
```

### Artifacts Path

All smoke-run artifacts are written under a stable, deterministic path:

```
artifacts/smoke/<ISO-timestamp>/
  ├── manifest.json          # Run manifest with results, logs, summary
  ├── truthcore/
  │   ├── report.json        # Runner report
  │   └── evidence.json      # Evidence packet
  ├── JobForge/
  │   ├── report.json
  │   └── evidence.json
  └── ...
```

---

## Adding a New Runner

1. **Create the runner directory:**

```bash
mkdir runners/my-runner
```

2. **Add `runner.manifest.json`:**

```json
{
  "name": "my-runner",
  "version": "0.1.0",
  "description": "ControlPlane adapter for my-runner",
  "entrypoint": {
    "command": "node",
    "args": ["scripts/adapters/runner-adapter.mjs", "--runner", "my-runner"]
  },
  "capabilities": ["adapter", "dry-run"],
  "requiredEnv": [],
  "outputs": ["report"]
}
```

3. **Add runner logic to `scripts/adapters/runner-adapter.mjs`:**

In the `runnerLogic` object, add a new key matching your runner name:

```js
'my-runner': () => ({
  myResult: { ok: true },
  evaluationItems: [
    { key: 'my-check', value: true, source: 'my-runner' },
  ],
}),
```

4. **Verify:**

```bash
pnpm controlplane plan          # Should list my-runner in steps
pnpm controlplane run --smoke   # Should execute and validate
```

Alternatively, use the scaffolding tool:

```bash
pnpm --filter @controlplane/create-runner create
```

---

## Adding a New JobForge Connector

JobForge connectors are invoked through the adapter layer. To add a new connector:

1. **Add connector logic** to the `JobForge` case in `runner-adapter.mjs`, or create a dedicated runner manifest.

2. **Define the connector fixture** in `tests/fixtures/`:

```json
{
  "requestId": "connector-test-001",
  "timestamp": "2026-01-01T00:00:00.000Z",
  "payload": {
    "connector": "my-connector",
    "action": "process"
  }
}
```

3. **Register in the compatibility matrix** by adding an entry to `docs/COMPATIBILITY.md`.

4. **Test:**

```bash
pnpm connectors:test
```

---

## Adding a New TruthCore Rule

TruthCore rules are defined in the `truthcore` runner logic within `runner-adapter.mjs`.

1. **Add the rule** to the `reasons` array in the `truthcore` case:

```js
{
  ruleId: 'TC-006',
  message: 'My new validation rule passed',
  evidenceRefs: ['my-evidence-key'],
}
```

2. **Add the corresponding evaluation item:**

```js
{ key: 'my-evidence-key', value: computedValue, source: 'truthcore-my-checker' }
```

3. **Update the decision logic** if your rule affects the pass/fail outcome.

4. **Add a golden test** in `tests/golden/` if the rule is deterministic.

---

## CLI Commands Reference

| Command | Description |
|---------|-------------|
| `controlplane doctor` | Health check: builds, schemas, runners, siblings, compatibility |
| `controlplane doctor --sibling` | Also runs `doctor` in detected sibling repos |
| `controlplane list` | Lists all discovered runner manifests |
| `controlplane plan` | Dry-run: prints execution steps with reasons, no side effects |
| `controlplane run <name> --input <file> --out <path>` | Execute a single runner |
| `controlplane run --smoke` | Execute all runners with golden fixture, validate artifacts |
| `controlplane verify-integrations` | Full integration verification across all runners |

## Sibling Repository Discovery

ControlPlane detects sibling repos in three locations (priority order):

1. **Sibling directories** — `../<name>` relative to the ControlPlane repo root
2. **Cached clones** — `.cache/repos/<name>` within the repo
3. **Runner adapters** — `runners/<name>/runner.manifest.json`

Known siblings: `truthcore`, `JobForge`, `autopilot-suite`, `finops-autopilot`, `ops-autopilot`, `growth-autopilot`, `support-autopilot`, `aias`.

## Compatibility Validation

The `validateCompatibility()` function checks:

- **CLI commands**: `node` and `pnpm` are available
- **SDK exports**: `validateReport`, `validateRunnerManifest`, `validateEvidencePacket` are callable
- **Build artifacts**: `packages/contracts/dist`, `packages/contract-kit/dist`, `packages/controlplane/dist`
- **Schema files**: All five contract schemas exist
- **Runner manifests**: Each manifest passes validation
- **Sibling contracts**: Contract version compatibility between siblings

## Error Handling

All CLI errors are typed with an error code, human-readable message, and an actionable hint:

```json
{
  "error": "RUNNER_NOT_FOUND",
  "message": "Runner \"foo\" was not found in any manifest directory.",
  "hint": "Ensure a runner.manifest.json for \"foo\" exists under runners/ or .cache/repos/."
}
```

Error codes: `RUNNER_NOT_FOUND`, `MANIFEST_INVALID`, `CONTRACT_VERSION_MISMATCH`, `MISSING_DEPENDENCY`, `MISSING_REPO`, `MISSING_ENV`, `INVOCATION_FAILED`, `VALIDATION_FAILED`, `SCHEMA_MISSING`, `BUILD_MISSING`, `TIMEOUT`, `UNKNOWN`.
