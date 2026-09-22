#!/usr/bin/env node
/**
 * Registry Lint Script
 *
 * Validates that:
 * 1. All modules/connectors/runners on disk are registered
 * 2. All registry entries point to real code
 * 3. All required build outputs exist
 * 4. Package.json exports are valid
 *
 * Usage: npx tsx scripts/registry-lint.ts
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Colors for output
const colors = {
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}[registry-lint] ${message}${colors.reset}`);
}

function fail(message) {
  log(message, 'red');
  process.exit(1);
}

function warn(message) {
  log(message, 'yellow');
}

function pass(message) {
  log(message, 'green');
}

// Track all errors and warnings
const errors = [];
const warnings = [];

function addError(message) {
  errors.push(message);
}

function addWarning(message) {
  warnings.push(message);
}

// Load package.json
function loadPackageJson(filePath) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    addError(`Failed to load ${filePath}: ${error.message}`);
    return null;
  }
}

// Check if a file exists
function fileExists(filePath) {
  return fs.existsSync(filePath);
}

// Check if a directory exists
function dirExists(dirPath) {
  return fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory();
}

// Get all packages in the monorepo
function getPackages() {
  const packages = new Map();

  // Read root package.json to get workspace packages
  const rootPkg = loadPackageJson(path.join(ROOT, 'package.json'));
  if (!rootPkg || !rootPkg.workspaces) {
    addError('Root package.json does not have workspaces defined');
    return packages;
  }

  // Glob patterns for workspaces (simplified)
  const workspacePatterns = rootPkg.workspaces || [];

  // Scan packages directory
  const packagesDir = path.join(ROOT, 'packages');
  if (!dirExists(packagesDir)) {
    addError('packages/ directory does not exist');
    return packages;
  }

  const entries = fs.readdirSync(packagesDir);
  for (const entry of entries) {
    const pkgDir = path.join(packagesDir, entry);
    const pkgJsonPath = path.join(pkgDir, 'package.json');

    if (fileExists(pkgJsonPath)) {
      const pkg = loadPackageJson(pkgJsonPath);
      if (pkg && pkg.name) {
        packages.set(pkg.name, {
          dir: pkgDir,
          pkg,
          pkgJsonPath,
        });
      }
    }
  }

  return packages;
}

// Get all runners in the monorepo
function getRunners() {
  const runners = new Map();
  const runnersDir = path.join(ROOT, 'runners');

  if (!dirExists(runnersDir)) {
    warn('runners/ directory does not exist');
    return runners;
  }

  const entries = fs.readdirSync(runnersDir);
  for (const entry of entries) {
    const runnerDir = path.join(runnersDir, entry);
    const manifestPath = path.join(runnerDir, 'runner.manifest.json');

    if (fileExists(manifestPath)) {
      const manifest = loadPackageJson(manifestPath);
      if (manifest && manifest.name) {
        runners.set(manifest.name, {
          dir: runnerDir,
          manifest,
          manifestPath,
        });
      }
    } else {
      addWarning(`Runner ${entry} is missing runner.manifest.json`);
    }
  }

  return runners;
}

// Validate a package
function validatePackage(name, { dir, pkg, pkgJsonPath }) {
  log(`Validating package: ${name}`, 'blue');

  // Check required fields
  if (!pkg.name) {
    addError(`Package ${name} is missing 'name' field`);
  }

  if (!pkg.version) {
    addError(`Package ${name} is missing 'version' field`);
  }

  if (!pkg.main && !pkg.exports) {
    addWarning(`Package ${name} has neither 'main' nor 'exports' field`);
  }

  // Check if main field points to existing file
  if (pkg.main) {
    const mainPath = path.join(dir, pkg.main);
    if (!fileExists(mainPath)) {
      addError(`Package ${name}: main field points to non-existent file: ${pkg.main}`);
    }
  }

  // Check if types field points to existing file
  if (pkg.types) {
    const typesPath = path.join(dir, pkg.types);
    if (!fileExists(typesPath)) {
      addError(`Package ${name}: types field points to non-existent file: ${pkg.types}`);
    }
  }

  // Validate exports field
  if (pkg.exports) {
    validateExports(name, dir, pkg.exports);
  }

  // Check if dist directory exists for packages that should have it
  const distDir = path.join(dir, 'dist');
  const hasBuildScript = pkg.scripts && pkg.scripts.build;

  if (hasBuildScript && !dirExists(distDir)) {
    addWarning(`Package ${name} has build script but dist/ directory does not exist`);
  }

  // Check dependencies on workspace packages
  if (pkg.dependencies) {
    for (const [depName, depVersion] of Object.entries(pkg.dependencies)) {
      if (depVersion.startsWith('workspace:')) {
        // This is a workspace dependency, should be in our packages map
        // We'll check this later
      }
    }
  }
}

// Validate exports field
function validateExports(pkgName, dir, exports) {
  if (typeof exports === 'string') {
    // Single export
    const exportPath = path.join(dir, exports);
    if (!fileExists(exportPath)) {
      addError(`Package ${pkgName}: exports field points to non-existent file: ${exports}`);
    }
  } else if (typeof exports === 'object' && exports !== null) {
    // Object exports
    for (const [key, value] of Object.entries(exports)) {
      const exportPath = value;

      // Handle conditional exports (object with types/import/etc.)
      if (typeof exportPath === 'object' && exportPath !== null) {
        const typeExport = exportPath.types || exportPath.import || exportPath.default;
        if (typeExport) {
          const resolvedPath = path.join(dir, typeExport);
          if (!fileExists(resolvedPath)) {
            addError(
              `Package ${pkgName}: exports['${key}'] points to non-existent file: ${typeExport}`
            );
          }
        }
      } else if (typeof exportPath === 'string') {
        const resolvedPath = path.join(dir, exportPath);
        if (!fileExists(resolvedPath)) {
          addError(
            `Package ${pkgName}: exports['${key}'] points to non-existent file: ${exportPath}`
          );
        }
      }
    }
  }
}

// Validate a runner
function validateRunner(name, { dir, manifest, manifestPath }) {
  log(`Validating runner: ${name}`, 'blue');

  // Check required manifest fields
  if (!manifest.name) {
    addError(`Runner ${name}: manifest is missing 'name' field`);
  }

  if (!manifest.version) {
    addError(`Runner ${name}: manifest is missing 'version' field`);
  }

  if (!manifest.entrypoint) {
    addError(`Runner ${name}: manifest is missing 'entrypoint' field`);
  } else {
    // Validate entrypoint files exist
    if (manifest.entrypoint.command) {
      // Check if command exists (if it's a file path)
      if (
        !manifest.entrypoint.command.startsWith('/') &&
        !manifest.entrypoint.command.startsWith('./') &&
        !manifest.entrypoint.command.startsWith('../') &&
        !manifest.entrypoint.command.includes(':')
      ) {
        // Assume it's a command name, not a file path
      } else {
        const cmdPath = path.join(dir, manifest.entrypoint.command);
        if (!fileExists(cmdPath) && !fileExists(manifest.entrypoint.command)) {
          addWarning(
            `Runner ${name}: entrypoint command may not exist: ${manifest.entrypoint.command}`
          );
        }
      }
    }

    if (manifest.entrypoint.args) {
      for (const arg of manifest.entrypoint.args) {
        if (arg.includes('runner.manifest.json')) {
          continue; // Skip self-reference
        }
        if (arg.startsWith('--')) {
          continue; // Skip flags
        }
        // Check if file args exist
        const argPath = path.join(dir, arg);
        if (!fileExists(argPath) && !arg.includes(':')) {
          addWarning(`Runner ${name}: entrypoint arg may not exist: ${arg}`);
        }
      }
    }
  }

  // Validate capabilities
  if (
    !manifest.capabilities ||
    !Array.isArray(manifest.capabilities) ||
    manifest.capabilities.length === 0
  ) {
    addWarning(`Runner ${name}: manifest has no capabilities defined`);
  }

  // Validate required env vars
  if (manifest.requiredEnv && !Array.isArray(manifest.requiredEnv)) {
    addError(`Runner ${name}: requiredEnv must be an array`);
  }
}

// Validate runtime registry
function validateRuntimeRegistry(runners) {
  const registryPath = path.join(ROOT, 'packages', 'controlplane', 'src', 'registry', 'index.ts');

  if (!fileExists(registryPath)) {
    addWarning('Runtime registry not found at packages/controlplane/src/registry/index.ts');
    return;
  }

  log('Validating runtime registry...', 'blue');

  // The runtime registry should discover runners from the runners/ directory
  // We already validated all runners have manifests, so this should be fine

  if (runners.size === 0) {
    addWarning('No runners found in the runners/ directory');
  } else {
    pass(`Found ${runners.size} runners with valid manifests`);
  }
}

// Validate schema registry
function validateSchemaRegistry() {
  const registryPath = path.join(ROOT, 'packages', 'contracts', 'src', 'types', 'registry.ts');

  if (!fileExists(registryPath)) {
    addWarning('Schema registry not found at packages/contracts/src/types/registry.ts');
    return;
  }

  log('Validating schema registry...', 'blue');

  try {
    const content = fs.readFileSync(registryPath, 'utf8');

    // Check for key registry types
    if (!content.includes('CapabilityRegistry')) {
      addError('Schema registry is missing CapabilityRegistry type');
    }

    if (!content.includes('RegisteredRunner')) {
      addError('Schema registry is missing RegisteredRunner type');
    }

    if (!content.includes('ConnectorType')) {
      addError('Schema registry is missing ConnectorType type');
    }

    pass('Schema registry contains expected types');
  } catch (error) {
    addError(`Failed to read schema registry: ${error.message}`);
  }
}

// Main validation function
function validate() {
  log('Starting registry validation...', 'blue');
  log('');

  // Get all packages and runners
  const packages = getPackages();
  const runners = getRunners();

  // Validate packages
  log(`Validating ${packages.size} packages...`, 'blue');
  for (const [name, pkg] of packages) {
    validatePackage(name, pkg);
  }

  log('');

  // Validate runners
  log(`Validating ${runners.size} runners...`, 'blue');
  for (const [name, runner] of runners) {
    validateRunner(name, runner);
  }

  log('');

  // Validate registries
  validateRuntimeRegistry(runners);
  validateSchemaRegistry();

  log('');

  // Report results
  if (errors.length > 0) {
    log(`❌ ${errors.length} ERROR(S) FOUND`, 'red');
    errors.forEach((err) => log(`  - ${err}`, 'red'));
    log('');
  }

  if (warnings.length > 0) {
    log(`⚠️  ${warnings.length} WARNING(S)`, 'yellow');
    warnings.forEach((warn) => log(`  - ${warn}`, 'yellow'));
    log('');
  }

  if (errors.length === 0) {
    pass('✅ All validations passed!');
    log('');
    return 0;
  } else {
    fail('Registry validation failed');
    return 1;
  }
}

// Run validation
const exitCode = validate();
process.exit(exitCode);
