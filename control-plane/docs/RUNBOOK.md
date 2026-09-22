# ControlPlane Runbook

Operational procedures for the ControlPlane contracts and tooling ecosystem.

## Quick Reference

### Core Commands
```bash
# Full verification pipeline
pnpm run verify

# Contract validation
pnpm run contract:validate

# Module discovery
pnpm controlplane list

# Health check
pnpm controlplane doctor

# Smoke test
pnpm controlplane run --smoke

# Ecosystem verification (Phase 4)
pnpm controlplane verify:ecosystem
```

### Development Workflow
```bash
# 1. Install dependencies
pnpm install

# 2. Build all packages
pnpm run build

# 3. Run verification
pnpm run verify

# 4. Test changes
pnpm run test

# 5. Check ecosystem drift
pnpm controlplane verify:ecosystem
```

## Operational Procedures

### 1. System Health Check

**Command**: `pnpm controlplane doctor`

**Purpose**: Comprehensive health verification of the ControlPlane ecosystem.

**What it checks**:
- Node.js and pnpm versions
- Package build status
- Schema presence and validity
- Runner manifest validation
- Module registry coherence
- Sibling repository compatibility

**Expected Output**:
```
ControlPlane Doctor
==================================================
  [OK  ] node-version: Node v22.22.0
  [OK  ] pnpm: pnpm 8.12.0
  [OK  ] dependencies: node_modules present
  [OK  ] build:packages/contracts/dist: dist present
  [OK  ] build:packages/contract-kit/dist: dist present
  [OK  ] build:packages/controlplane/dist: dist present
  [OK  ] runners: 8 runner(s) discovered
  [OK  ] schemas: 7/7 schemas present
  [OK  ] golden-fixture: Golden input fixture present
  [OK  ] module-manifest: module.manifest.json present

Status: HEALTHY (12 checks, 0 failures, 0 warnings)
```

**Troubleshooting**:
- Missing builds: Run `pnpm run build`
- Schema issues: Check `packages/contracts/src/`
- Runner issues: Verify manifests in `runners/`

### 2. Contract Validation

**Command**: `pnpm run contract:validate`

**Purpose**: Validate all contracts against their schemas.

**What it validates**:
- JSON schema compliance
- Zod schema consistency
- Runner manifest validation
- Error envelope structure

**Expected Output**:
```
Contracts Check Results
==================================================
  [PASS] runner-manifest:JobForge
  [PASS] runner-manifest:truthcore
  [PASS] schema:reports.schema.json
  [PASS] schema:evidence.schema.json
  [PASS] contracts-package
  [PASS] module-manifest:ControlPlane

18 checks, 0 failures
```

### 3. Module Discovery

**Command**: `pnpm controlplane list`

**Purpose**: List all discovered runners and their capabilities.

**Expected Output**:
```json
[
  {
    "name": "JobForge",
    "version": "0.1.0",
    "description": "Job orchestration runner",
    "entrypoint": {
      "command": "node",
      "args": ["scripts/adapters/runner-adapter.mjs", "--runner", "jobforge"]
    },
    "capabilities": ["adapter", "dry-run"],
    "source": "runners/jobforge/runner.manifest.json"
  },
  // ... other runners
]
```

### 4. Smoke Testing

**Command**: `pnpm controlplane run --smoke`

**Purpose**: Execute all runners with golden fixture input.

**What it does**:
1. Loads golden fixture from `tests/fixtures/golden.json`
2. Executes each runner with standard flags
3. Validates output against contract schemas
4. Writes artifacts to `artifacts/smoke/<timestamp>/`

**Expected Artifacts**:
```
artifacts/smoke/2026-02-06T20:30:00.000Z/
├── manifest.json
├── truthcore/
│   ├── report.json
│   └── evidence.json
├── JobForge/
│   ├── report.json
│   └── evidence.json
└── ...
```

### 5. Ecosystem Verification (Phase 4)

**Command**: `pnpm controlplane verify:ecosystem`

**Purpose**: Detect drift between expected and actual module configurations.

**What it checks**:
- Manifest schema compliance
- Command surface validation
- Export presence verification
- Version compatibility
- Required capabilities

**Expected Output**:
```
Ecosystem Verification Report
==================================================
✅ All modules verified (0 drift detected)

Modules: 8/8 verified
Commands: 24/24 verified
Exports: 16/16 verified
```

**Drift Detection**:
- Missing commands: Exit code 2
- Invalid manifests: Exit code 3
- Schema mismatches: Exit code 4
- Version conflicts: Exit code 5

## Maintenance Procedures

### Adding a New Runner

1. **Create runner directory**:
   ```bash
   mkdir runners/my-runner
   ```

2. **Create manifest** (`runners/my-runner/runner.manifest.json`):
   ```json
   {
     "name": "my-runner",
     "version": "0.1.0",
     "description": "My custom runner",
     "entrypoint": {
       "command": "node",
       "args": ["dist/index.js"]
     },
     "capabilities": ["adapter"],
     "requiredEnv": [],
     "outputs": ["report"]
   }
   ```

3. **Validate**:
   ```bash
   pnpm run contract:validate
   pnpm controlplane list
   ```

4. **Test**:
   ```bash
   pnpm controlplane run my-runner --input test.json --out output.json
   ```

### Updating Contracts

1. **Modify schema** in `packages/contracts/src/types/`
2. **Build contracts**: `pnpm run build:contracts`
3. **Sync JSON schemas**: `pnpm run contract:sync:fix`
4. **Validate**: `pnpm run contract:validate`
5. **Update compatibility**: `pnpm run compat:generate`

### Troubleshooting Common Issues

#### Build Failures
```bash
# Clean and rebuild
rm -rf node_modules packages/*/dist
pnpm install
pnpm run build
```

#### Test Failures
```bash
# Check test output
pnpm run test --reporter=verbose

# Run specific test
pnpm --filter @controlplane/contract-test-kit test
```

#### CLI Issues
```bash
# Check CLI help
node packages/controlplane/dist/cli.js --help

# Debug with verbose output
CONTROLPLANE_LOG_LEVEL=debug node packages/controlplane/dist/cli.js doctor
```

#### Verification Failures
```bash
# Check specific verification
pnpm run lint
pnpm run typecheck
pnpm run contract:validate
pnpm run docs:verify
```

## Environment Variables

| Variable | Purpose | Default |
|----------|---------|---------|
| `NODE_ENV` | Environment identifier | `development` |
| `CONTROLPLANE_OFFLINE` | Skip external repo cloning | `false` |
| `CP_SMOKE_ALLOW_MISSING` | Allow missing services in smoke tests | `false` |
| `CONTROLPLANE_LOG_LEVEL` | CLI logging level | `info` |

## Exit Codes Reference

| Code | Meaning | Action |
|------|---------|--------|
| 0 | Success | Continue |
| 1 | Invalid arguments | Check command help |
| 2 | Execution/validation failure | Check logs |
| 3 | Build missing | Run `pnpm run build` |
| 4 | Schema validation failed | Check contracts |
| 5 | Ecosystem drift detected | Run `verify:ecosystem` |

## Performance Monitoring

### Benchmark Commands
```bash
# Run all benchmarks
pnpm cp-benchmark

# Specific benchmark suites
pnpm cp-benchmark --suite throughput
pnpm cp-benchmark --suite latency
pnpm cp-benchmark --suite contract
```

### Metrics Collection
- Job throughput: `jobs_received_total`, `jobs_completed_total`
- Latency: `job_duration_seconds`
- Health checks: `runner_heartbeat_timestamp`
- Error rates: `jobs_failed_total`

## Security Procedures

### Secret Scanning
```bash
# Scan for hardcoded secrets
pnpm run secret-scan
```

### Contract Security
- All inputs validated at runtime
- Error envelopes prevent information leakage
- Environment variables redacted in logs

## Integration with CI/CD

### GitHub Actions
```yaml
- name: Verify ControlPlane
  run: pnpm run verify

- name: Check Ecosystem Drift
  run: pnpm controlplane verify:ecosystem

- name: Run Smoke Tests
  run: pnpm controlplane run --smoke
```

### Local Development
```bash
# Full verification (matches CI)
pnpm run verify

# Fast path (skip docs)
pnpm run lint && pnpm run typecheck && pnpm run test && pnpm run build
```

## Documentation Updates

When making changes:
1. Update relevant runbook sections
2. Update `docs/contracts.md` for schema changes
3. Update `docs/architecture.md` for structural changes
4. Verify docs: `pnpm run docs:verify`

## Legacy Procedures

### Update Contracts (Legacy)
1. Modify schemas in `packages/contracts/src`.
2. Run `pnpm run build:contracts`.
3. Run `pnpm run contract:validate`.
4. Update compatibility matrix via `pnpm run compat:generate`.

### Release Preparation (Legacy)
1. Run `pnpm run verify`.
2. Ensure compatibility matrix is current.
3. Merge changes into `main` and allow CI release automation.

### Investigate Compatibility Drift (Legacy)
```bash
pnpm run compat:check
```

### Investigate Distribution Config Issues (Legacy)
```bash
pnpm run distribution:verify
```

### Incident Response (Legacy)
- Revert breaking contract changes immediately.
- Notify downstream maintainers with the version and impact scope.
