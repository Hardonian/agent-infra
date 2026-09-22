#!/usr/bin/env node
/**
 * contracts:check — validates all contract schemas, runner manifests,
 * evidence schemas, and module manifests in the repo.
 * Exit 0 = all valid, Exit 1 = failures found.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const readJson = (filePath) => JSON.parse(readFileSync(filePath, 'utf-8'));

const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const isString = (v) => typeof v === 'string' && v.length > 0;
const hasString = (obj, key) => isString(obj[key]);
const hasArray = (obj, key) => Array.isArray(obj[key]);

const results = [];

const check = (label, valid, errors) => {
  results.push({ label, valid, errors });
};

// 1. Validate all runner manifests
const runnersDir = path.join(repoRoot, 'runners');
try {
  const entries = readdirSync(runnersDir);
  for (const entry of entries) {
    const fullPath = path.join(runnersDir, entry);
    if (!statSync(fullPath).isDirectory()) continue;
    const manifestPath = path.join(fullPath, 'runner.manifest.json');
    try {
      const manifest = readJson(manifestPath);
      const errors = [];
      if (!hasString(manifest, 'name')) errors.push('name is required');
      if (!hasString(manifest, 'version')) errors.push('version is required');
      if (!hasString(manifest, 'description')) errors.push('description is required');
      if (!isRecord(manifest.entrypoint)) {
        errors.push('entrypoint is required');
      } else {
        if (!hasString(manifest.entrypoint, 'command')) errors.push('entrypoint.command is required');
        if (!hasArray(manifest.entrypoint, 'args')) errors.push('entrypoint.args must be an array');
      }
      check(`runner-manifest:${entry}`, errors.length === 0, errors);
    } catch (err) {
      check(`runner-manifest:${entry}`, false, [err.message]);
    }
  }
} catch {
  check('runner-manifests', false, ['runners/ directory not found']);
}

// 2. Validate JSON schemas exist and parse
const schemaFiles = [
  'contracts/runner.manifest.schema.json',
  'contracts/events.schema.json',
  'contracts/reports.schema.json',
  'contracts/cli.schema.json',
  'contracts/evidence.schema.json',
  'contracts/module.manifest.schema.json',
  'contracts/audit-trail.schema.json',
];

for (const file of schemaFiles) {
  const filePath = path.join(repoRoot, file);
  try {
    const schema = readJson(filePath);
    const errors = [];
    if (!hasString(schema, '$schema')) errors.push('$schema is required');
    if (!hasString(schema, 'title')) errors.push('title is required');
    if (!hasString(schema, 'type')) errors.push('type is required');
    check(`schema:${path.basename(file)}`, errors.length === 0, errors);
  } catch (err) {
    check(`schema:${path.basename(file)}`, false, [err.message]);
  }
}

// 3. Validate contract package exports compile
const contractsPkg = path.join(repoRoot, 'packages/contracts/package.json');
try {
  const pkg = readJson(contractsPkg);
  const errors = [];
  if (!hasString(pkg, 'name')) errors.push('name is required');
  if (!hasString(pkg, 'version')) errors.push('version is required');
  if (!isRecord(pkg.exports)) errors.push('exports is required');
  check('contracts-package', errors.length === 0, errors);
} catch (err) {
  check('contracts-package', false, [err.message]);
}

// 4. Validate contract-kit package
const contractKitPkg = path.join(repoRoot, 'packages/contract-kit/package.json');
try {
  const pkg = readJson(contractKitPkg);
  const errors = [];
  if (!hasString(pkg, 'name')) errors.push('name is required');
  if (!hasString(pkg, 'version')) errors.push('version is required');
  check('contract-kit-package', errors.length === 0, errors);
} catch (err) {
  check('contract-kit-package', false, [err.message]);
}

// 5. Validate all module.manifest.json files (for sibling repos)
const moduleManifestLocations = [
  path.join(repoRoot, 'module.manifest.json'),
];
// Also check runners for module manifests
try {
  const entries = readdirSync(runnersDir);
  for (const entry of entries) {
    const mp = path.join(runnersDir, entry, 'module.manifest.json');
    try {
      statSync(mp);
      moduleManifestLocations.push(mp);
    } catch {
      // No module manifest for this runner, that's OK
    }
  }
} catch {
  // runners dir missing
}

for (const mp of moduleManifestLocations) {
  try {
    const manifest = readJson(mp);
    const errors = [];
    if (!hasString(manifest, 'name')) errors.push('name is required');
    if (!hasString(manifest, 'version')) errors.push('version is required');
    if (!hasString(manifest, 'type')) errors.push('type is required');
    if (!hasString(manifest, 'contractVersion')) errors.push('contractVersion is required');
    check(`module-manifest:${path.basename(path.dirname(mp))}`, errors.length === 0, errors);
  } catch {
    // File doesn't exist, skip silently
  }
}

// Print results
const failures = results.filter((r) => !r.valid);
const jsonOutput = process.argv.includes('--json');

if (jsonOutput) {
  console.log(JSON.stringify({ results, failures: failures.length, total: results.length }, null, 2));
} else {
  console.log(`\nContracts Check Results\n${'='.repeat(50)}`);
  for (const r of results) {
    const icon = r.valid ? 'PASS' : 'FAIL';
    console.log(`  [${icon}] ${r.label}`);
    if (!r.valid) {
      for (const e of r.errors) {
        console.log(`         - ${e}`);
      }
    }
  }
  console.log(`\n${results.length} checks, ${failures.length} failures\n`);
}

process.exit(failures.length > 0 ? 1 : 0);
