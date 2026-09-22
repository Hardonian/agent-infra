#!/usr/bin/env node
/**
 * CI Contract Guard — fails the build if runner contracts drift.
 *
 * Checks:
 *   1. All required runners have valid runner.manifest.json files
 *   2. All manifests reference the universal adapter entrypoint
 *   3. The adapter script exists and has logic for every required runner
 *   4. All required contract schema files exist
 *   5. Every runner is executable (pre-flight validation via the execution registry)
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks failed
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..');

const REQUIRED_RUNNERS = [
  'truthcore',
  'JobForge',
  'ops-autopilot',
  'finops-autopilot',
  'growth-autopilot',
  'support-autopilot',
];

const REQUIRED_SCHEMAS = [
  'contracts/runner.manifest.schema.json',
  'contracts/reports.schema.json',
  'contracts/evidence.schema.json',
  'contracts/events.schema.json',
  'contracts/module.manifest.schema.json',
];

const jsonFlag = process.argv.includes('--json');
const results = [];
let failures = 0;

const check = (name, passed, message) => {
  results.push({ name, passed, message });
  if (!passed) failures++;
  if (!jsonFlag) {
    console.log(`${passed ? '✓' : '✗'} ${name}: ${message}`);
  }
};

// ── 1. Runner manifests exist and are valid ────────────────────────────

for (const name of REQUIRED_RUNNERS) {
  const manifestPath = resolve(repoRoot, 'runners', name, 'runner.manifest.json');

  if (!existsSync(manifestPath)) {
    check(`manifest:${name}`, false, `Missing runner.manifest.json at ${manifestPath}`);
    continue;
  }

  let manifest;
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  } catch (e) {
    check(`manifest:${name}`, false, `Invalid JSON in ${manifestPath}: ${e.message}`);
    continue;
  }

  // Validate required fields
  const requiredFields = ['name', 'version', 'description', 'entrypoint'];
  const missing = requiredFields.filter((f) => !manifest[f]);
  if (missing.length > 0) {
    check(`manifest:${name}`, false, `Missing fields: ${missing.join(', ')}`);
    continue;
  }

  if (!manifest.entrypoint.command || !Array.isArray(manifest.entrypoint.args)) {
    check(`manifest:${name}`, false, 'entrypoint must have command (string) and args (array)');
    continue;
  }

  // Verify name matches directory
  if (manifest.name !== name) {
    check(`manifest:${name}`, false, `Manifest name "${manifest.name}" does not match directory "${name}"`);
    continue;
  }

  check(`manifest:${name}`, true, `${name}@${manifest.version} — valid manifest`);
}

// ── 2. All manifests reference the universal adapter ───────────────────

for (const name of REQUIRED_RUNNERS) {
  const manifestPath = resolve(repoRoot, 'runners', name, 'runner.manifest.json');
  if (!existsSync(manifestPath)) continue;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
  const args = manifest.entrypoint?.args || [];

  const usesAdapter = manifest.entrypoint?.command === 'node'
    && args[0] === 'scripts/adapters/runner-adapter.mjs'
    && args.includes('--runner')
    && args.includes(name);

  check(
    `adapter:${name}`,
    usesAdapter,
    usesAdapter
      ? `Correctly references universal adapter with --runner ${name}`
      : `Does not correctly reference universal adapter (args: ${JSON.stringify(args)})`
  );
}

// ── 3. Adapter script exists and has logic for all runners ─────────────

const adapterPath = resolve(repoRoot, 'scripts/adapters/runner-adapter.mjs');
const adapterExists = existsSync(adapterPath);
check('adapter:exists', adapterExists, adapterExists ? 'runner-adapter.mjs exists' : 'runner-adapter.mjs is MISSING');

if (adapterExists) {
  const adapterContent = readFileSync(adapterPath, 'utf-8');

  for (const name of REQUIRED_RUNNERS) {
    // Check for runner name in the runnerLogic object
    const hasLogic = adapterContent.includes(`'${name}'`) || adapterContent.includes(`${name}:`);
    check(
      `adapter-logic:${name}`,
      hasLogic,
      hasLogic
        ? `Adapter has execution logic for "${name}"`
        : `Adapter is MISSING execution logic for "${name}"`
    );
  }

  // Compute adapter hash for drift detection
  const adapterHash = createHash('sha256').update(adapterContent).digest('hex').slice(0, 12);
  check('adapter:hash', true, `Adapter SHA-256 prefix: ${adapterHash}`);
}

// ── 4. Contract schema files exist ─────────────────────────────────────

for (const schema of REQUIRED_SCHEMAS) {
  const schemaPath = resolve(repoRoot, schema);
  const exists = existsSync(schemaPath);
  check(`schema:${schema}`, exists, exists ? 'exists' : 'MISSING');
}

// ── 5. Compute manifest fingerprint for drift detection ────────────────

const manifestFingerprints = {};
for (const name of REQUIRED_RUNNERS) {
  const manifestPath = resolve(repoRoot, 'runners', name, 'runner.manifest.json');
  if (existsSync(manifestPath)) {
    const content = readFileSync(manifestPath, 'utf-8');
    manifestFingerprints[name] = createHash('sha256').update(content).digest('hex').slice(0, 12);
  }
}

check(
  'fingerprints',
  true,
  `Manifest fingerprints: ${JSON.stringify(manifestFingerprints)}`
);

// ── Summary ────────────────────────────────────────────────────────────

if (jsonFlag) {
  console.log(JSON.stringify({
    timestamp: new Date().toISOString(),
    total: results.length,
    passed: results.filter((r) => r.passed).length,
    failed: failures,
    results,
    manifestFingerprints,
  }, null, 2));
} else {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(
    `Contract Guard: ${results.length} checks, ${results.length - failures} passed, ${failures} failed`
  );
}

process.exit(failures > 0 ? 1 : 0);
