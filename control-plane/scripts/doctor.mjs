#!/usr/bin/env node
/**
 * doctor — checks environment, required tools, node version,
 * build artifacts, schema drift, and prints fixes.
 * Exit 0 = healthy, Exit 1 = issues found.
 */
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '..');

const checks = [];

const check = (name, status, message, fix) => {
  checks.push({ name, status, message, fix: fix || null });
};

// 1. Node version
const nodeVersion = process.version;
const major = parseInt(nodeVersion.slice(1).split('.')[0], 10);
if (major >= 18) {
  check('node-version', 'ok', `Node ${nodeVersion}`);
} else {
  check('node-version', 'fail', `Node ${nodeVersion} < 18`, 'Install Node.js >= 18');
}

// 2. pnpm available
try {
  const pnpmVersion = execSync('pnpm --version', { encoding: 'utf-8' }).trim();
  check('pnpm', 'ok', `pnpm ${pnpmVersion}`);
} catch {
  check('pnpm', 'fail', 'pnpm not found', 'npm install -g pnpm@8');
}

// 3. Dependencies installed
const nodeModulesPath = path.join(repoRoot, 'node_modules');
if (existsSync(nodeModulesPath)) {
  check('dependencies', 'ok', 'node_modules present');
} else {
  check('dependencies', 'fail', 'node_modules missing', 'pnpm install');
}

// 4. Build artifacts exist
const buildTargets = [
  'packages/contracts/dist',
  'packages/contract-kit/dist',
  'packages/controlplane/dist',
  'packages/contract-test-kit/dist',
];

for (const target of buildTargets) {
  const fullPath = path.join(repoRoot, target);
  if (existsSync(fullPath)) {
    check(`build:${target}`, 'ok', 'dist present');
  } else {
    check(`build:${target}`, 'warn', 'dist missing', `pnpm run build`);
  }
}

// 5. Runner manifests valid
const runnersDir = path.join(repoRoot, 'runners');
if (existsSync(runnersDir)) {
  const entries = readdirSync(runnersDir);
  let runnerCount = 0;
  for (const entry of entries) {
    const manifestPath = path.join(runnersDir, entry, 'runner.manifest.json');
    try {
      const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      if (manifest.name && manifest.version && manifest.entrypoint) {
        runnerCount++;
      } else {
        check(`runner:${entry}`, 'warn', 'Incomplete manifest', 'Add required fields to runner.manifest.json');
      }
    } catch {
      // Not a runner directory
    }
  }
  check('runners', 'ok', `${runnerCount} runner(s) discovered`);
} else {
  check('runners', 'fail', 'runners/ directory missing', 'mkdir runners');
}

// 6. Contract schemas exist
const schemas = [
  'contracts/runner.manifest.schema.json',
  'contracts/events.schema.json',
  'contracts/reports.schema.json',
  'contracts/cli.schema.json',
  'contracts/evidence.schema.json',
  'contracts/module.manifest.schema.json',
  'contracts/audit-trail.schema.json',
];

let schemaCount = 0;
for (const schema of schemas) {
  const fullPath = path.join(repoRoot, schema);
  if (existsSync(fullPath)) {
    schemaCount++;
  } else {
    check(`schema:${path.basename(schema)}`, 'warn', 'Missing', `Create ${schema}`);
  }
}
check('schemas', 'ok', `${schemaCount}/${schemas.length} schemas present`);

// 7. Golden fixture exists
const fixturePath = path.join(repoRoot, 'tests/fixtures/golden-input.json');
if (existsSync(fixturePath)) {
  check('golden-fixture', 'ok', 'Golden input fixture present');
} else {
  check('golden-fixture', 'warn', 'Missing golden fixture', 'Create tests/fixtures/golden-input.json');
}

// 8. Environment variables
const envVars = ['NODE_ENV'];
const optionalEnvVars = ['GITHUB_TOKEN', 'CONTROLPLANE_OFFLINE'];
for (const v of envVars) {
  if (process.env[v]) {
    check(`env:${v}`, 'ok', `Set to ${process.env[v]}`);
  } else {
    check(`env:${v}`, 'info', 'Not set (optional)');
  }
}

// 9. Module manifest (root)
const moduleManifest = path.join(repoRoot, 'module.manifest.json');
if (existsSync(moduleManifest)) {
  check('module-manifest', 'ok', 'module.manifest.json present');
} else {
  check('module-manifest', 'info', 'No root module.manifest.json (optional for mono-repo root)');
}

// Print results
const jsonOutput = process.argv.includes('--json');
const failures = checks.filter((c) => c.status === 'fail');
const warnings = checks.filter((c) => c.status === 'warn');

if (jsonOutput) {
  console.log(JSON.stringify({
    status: failures.length > 0 ? 'unhealthy' : warnings.length > 0 ? 'degraded' : 'healthy',
    node: nodeVersion,
    checks,
    failures: failures.length,
    warnings: warnings.length,
    total: checks.length,
  }, null, 2));
} else {
  console.log(`\nControlPlane Doctor\n${'='.repeat(50)}`);
  for (const c of checks) {
    const icons = { ok: 'OK  ', fail: 'FAIL', warn: 'WARN', info: 'INFO' };
    const icon = icons[c.status] || '????';
    console.log(`  [${icon}] ${c.name}: ${c.message}`);
    if (c.fix) {
      console.log(`         Fix: ${c.fix}`);
    }
  }
  const status = failures.length > 0 ? 'UNHEALTHY' : warnings.length > 0 ? 'DEGRADED' : 'HEALTHY';
  console.log(`\nStatus: ${status} (${checks.length} checks, ${failures.length} failures, ${warnings.length} warnings)\n`);
}

process.exit(failures.length > 0 ? 1 : 0);
