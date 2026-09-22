/**
 * Smoke Test Script
 *
 * Usage: npx tsx scripts/smoke-test.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}[smoke-test] ${message}${colors.reset}`);
}

function pass(message) {
  log(message, 'green');
}

function fail(message) {
  log(message, 'red');
}

function info(message) {
  log(message, 'cyan');
}

const results = {
  passed: [],
  failed: [],
};

function loadPackageJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getPackages() {
  const packages = [];
  const packagesDir = path.join(ROOT, 'packages');

  if (!fs.existsSync(packagesDir)) {
    return packages;
  }

  const entries = fs.readdirSync(packagesDir);
  for (const entry of entries) {
    const pkgDir = path.join(packagesDir, entry);
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    if (fs.existsSync(pkgJsonPath)) {
      const pkg = loadPackageJson(pkgJsonPath);
      if (pkg && pkg.name) {
        packages.push({
          name: pkg.name,
          dir: pkgDir,
          pkg,
        });
      }
    }
  }

  return packages;
}

async function testPackage({ name, dir, pkg }) {
  info(`Testing package: ${name}`);

  // Skip CLI packages that execute on import
  if (pkg.bin && pkg.main && pkg.main.includes('cli')) {
    const mainPath = path.join(dir, pkg.main);
    if (fs.existsSync(mainPath)) {
      pass(`  ✓ CLI package (main: ${pkg.main})`);
      results.passed.push(name);
    } else {
      fail(`  ✗ CLI main does not exist: ${pkg.main}`);
      results.failed.push({ name, error: `CLI main missing: ${pkg.main}` });
    }
    return;
  }

  try {
    if (pkg.main) {
      const mainPath = path.join(dir, pkg.main);
      if (fs.existsSync(mainPath)) {
        try {
          const mainUrl = pathToFileURL(mainPath).href;
          const module = await import(mainUrl);
          pass(`  ✓ Main entry imported: ${pkg.main}`);

          const exports = Object.keys(module);
          if (exports.length === 0) {
            log(`  ⚠ Package has no exports`, 'yellow');
          } else {
            pass(`  ✓ Package has ${exports.length} export(s): ${exports.join(', ')}`);
          }

          results.passed.push(name);
        } catch (error) {
          if (
            error.message.includes('Cannot find package') &&
            error.message.includes('workspace:')
          ) {
            pass(`  ✓ Main entry found (workspace dependency not installed)`);
            results.passed.push(name);
          } else {
            fail(`  ✗ Failed to import: ${error.message}`);
            results.failed.push({ name, error: error.message });
          }
        }
      } else {
        fail(`  ✗ Main entry does not exist: ${pkg.main}`);
        results.failed.push({ name, error: `Main entry missing: ${pkg.main}` });
      }
    } else {
      log(`  ⚠ Package has no main field`, 'yellow');
      results.passed.push(name);
    }
  } catch (error) {
    fail(`  ✗ Unexpected error: ${error.message}`);
    results.failed.push({ name, error: error.message });
  }
}

function testCLI({ name, pkg }) {
  if (pkg.bin) {
    info(`Testing CLI binaries for: ${name}`);
    for (const [binName, binPath] of Object.entries(pkg.bin)) {
      const fullPath = path.join(ROOT, 'node_modules', '.bin', binName);
      if (fs.existsSync(fullPath)) {
        pass(`  ✓ CLI binary exists: ${binName}`);
      } else {
        log(`  ⚠ CLI binary not found: ${binName}`, 'yellow');
      }
    }
  }
}

async function runTests() {
  console.log('');
  log('🧪 Running Smoke Tests', 'blue');
  console.log('');

  const packages = getPackages();

  if (packages.length === 0) {
    fail('No packages found to test');
    process.exit(1);
  }

  info(`Found ${packages.length} packages\n`);

  for (const pkg of packages) {
    await testPackage(pkg);
    console.log('');
  }

  info('Testing CLI binaries...\n');
  for (const pkg of packages) {
    testCLI(pkg);
  }

  console.log('');
  log('═'.repeat(50), 'blue');
  log('SMOKE TEST RESULTS', 'blue');
  log('═'.repeat(50), 'blue');
  console.log('');

  if (results.passed.length > 0) {
    pass(`✅ ${results.passed.length} package(s) passed`);
    results.passed.forEach((name) => log(`  ✓ ${name}`, 'green'));
  }

  if (results.failed.length > 0) {
    console.log('');
    fail(`❌ ${results.failed.length} package(s) failed`);
    results.failed.forEach(({ name, error }) => {
      log(`  ✗ ${name}: ${error}`, 'red');
    });
    console.log('');
    fail('Smoke tests failed');
    process.exit(1);
  }

  console.log('');
  pass('✨ All smoke tests passed!');
  console.log('');
}

runTests().catch((error) => {
  fail(`Unexpected error: ${error.message}`);
  process.exit(1);
});
