#!/usr/bin/env node

import { readFile, writeFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import { glob } from 'glob';
import chalk from 'chalk';

interface PackageInfo {
  name: string;
  path: string;
  version: string;
  contractsVersion?: string;
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface SyncOptions {
  fix: boolean;
  verbose: boolean;
  workspaceRoot: string;
}

interface SyncResult {
  success: boolean;
  packages: PackageInfo[];
  mismatches: Mismatch[];
  canonicalVersion: string;
}

interface Mismatch {
  package: string;
  path: string;
  current: string;
  expected: string;
  type: 'workspace' | 'semver';
}

const CONTRACTS_PACKAGE = '@controlplane/contracts';
const WORKSPACE_PATTERN = /^workspace:\*$/;

function parseArgs(): SyncOptions {
  const args = process.argv.slice(2);

  return {
    fix: args.includes('--fix'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    workspaceRoot: process.cwd(),
  };
}

async function existsAsync(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function findWorkspaceRoot(): Promise<string> {
  let current = process.cwd();

  while (current !== '/') {
    const packageJsonPath = join(current, 'package.json');
    if (await existsAsync(packageJsonPath)) {
      const content = await readFile(packageJsonPath, 'utf-8');
      const pkg = JSON.parse(content);
      // Check if this is a workspace root
      if (pkg.workspaces || (pkg.name && pkg.name.includes('orchestrator'))) {
        return current;
      }
    }
    const parent = resolve(current, '..');
    if (parent === current) break;
    current = parent;
  }

  return process.cwd();
}

async function getCanonicalVersion(workspaceRoot: string): Promise<string> {
  const contractsPackagePath = join(workspaceRoot, 'packages', 'contracts', 'package.json');

  if (!(await existsAsync(contractsPackagePath))) {
    throw new Error(`Cannot find contracts package at ${contractsPackagePath}`);
  }

  const content = await readFile(contractsPackagePath, 'utf-8');
  const pkg = JSON.parse(content);

  return pkg.version;
}

async function findWorkspacePackages(workspaceRoot: string): Promise<PackageInfo[]> {
  // Find all package.json files in packages directory - async glob
  const packageJsonPaths = await glob('packages/*/package.json', {
    cwd: workspaceRoot,
    absolute: true,
  });

  // Process all packages in parallel with Promise.all
  const packagePromises = packageJsonPaths.map(async (pkgPath) => {
    try {
      const content = await readFile(pkgPath, 'utf-8');
      const pkg = JSON.parse(content);

      const deps = pkg.dependencies || {};
      const devDeps = pkg.devDependencies || {};

      // Only include packages that depend on @controlplane/contracts
      const contractsVersion = deps[CONTRACTS_PACKAGE] || devDeps[CONTRACTS_PACKAGE];

      return {
        name: pkg.name,
        path: pkgPath,
        version: pkg.version,
        contractsVersion,
        dependencies: deps,
        devDependencies: devDeps,
      };
    } catch (error) {
      console.warn(chalk.yellow(`Warning: Could not parse ${pkgPath}`));
      return null;
    }
  });

  const results = await Promise.all(packagePromises);
  return results.filter((p): p is NonNullable<typeof p> => p !== null);
}

function checkVersionSync(
  packages: PackageInfo[],
  canonicalVersion: string
): { mismatches: Mismatch[]; synced: PackageInfo[] } {
  const mismatches: Mismatch[] = [];
  const synced: PackageInfo[] = [];

  for (const pkg of packages) {
    if (!pkg.contractsVersion) {
      // Package doesn't depend on contracts - skip
      continue;
    }

    if (WORKSPACE_PATTERN.test(pkg.contractsVersion)) {
      // Uses workspace:* - this is correct
      synced.push(pkg);
    } else {
      // Uses a specific version - check if it matches
      const cleanVersion = pkg.contractsVersion.replace(/^[\^~]/, '');
      if (cleanVersion !== canonicalVersion) {
        mismatches.push({
          package: pkg.name,
          path: pkg.path,
          current: pkg.contractsVersion,
          expected: `workspace:*`,
          type: 'semver',
        });
      } else {
        synced.push(pkg);
      }
    }
  }

  return { mismatches, synced };
}

async function fixMismatches(mismatches: Mismatch[], options: SyncOptions): Promise<void> {
  // Process all fixes in parallel
  const fixPromises = mismatches.map(async (mismatch) => {
    if (options.verbose) {
      console.log(chalk.blue(`Fixing ${mismatch.package}...`));
    }

    const content = await readFile(mismatch.path, 'utf-8');
    const pkg = JSON.parse(content);

    // Update dependencies
    if (pkg.dependencies && pkg.dependencies[CONTRACTS_PACKAGE]) {
      pkg.dependencies[CONTRACTS_PACKAGE] = 'workspace:*';
    }

    // Update devDependencies
    if (pkg.devDependencies && pkg.devDependencies[CONTRACTS_PACKAGE]) {
      pkg.devDependencies[CONTRACTS_PACKAGE] = 'workspace:*';
    }

    // Write back with proper formatting
    await writeFile(mismatch.path, JSON.stringify(pkg, null, 2) + '\n');

    console.log(chalk.green(`  ✓ Fixed ${mismatch.package}`));
  });

  await Promise.all(fixPromises);
}

function formatOutput(result: SyncResult, options: SyncOptions): string {
  let output = '\n';
  output += chalk.bold.blue('╔══════════════════════════════════════════════════════════╗\n');
  output += chalk.bold.blue('║      ControlPlane Contract Sync Results                 ║\n');
  output += chalk.bold.blue('╚══════════════════════════════════════════════════════════╝\n\n');

  output += chalk.bold('Canonical Contract Version: ');
  output += chalk.cyan(result.canonicalVersion) + '\n\n';

  // Show synced packages
  const syncedCount = result.packages.filter((p) => {
    if (!p.contractsVersion) return false;
    return (
      WORKSPACE_PATTERN.test(p.contractsVersion) ||
      p.contractsVersion.replace(/^[\^~]/, '') === result.canonicalVersion
    );
  }).length;

  output += chalk.bold(`Packages Checked: ${result.packages.length}\n`);
  output += chalk.green(`  ✓ In Sync: ${syncedCount}\n`);

  if (result.mismatches.length > 0) {
    output += chalk.red(`  ✗ Mismatched: ${result.mismatches.length}\n\n`);
    output += chalk.bold('Mismatches:\n');

    for (const mismatch of result.mismatches) {
      output += chalk.red(`  ✗ ${mismatch.package}\n`);
      output += chalk.gray(`    Path: ${mismatch.path}\n`);
      output += chalk.gray(`    Current: ${mismatch.current}\n`);
      output += chalk.gray(`    Expected: ${mismatch.expected}\n`);
    }
  } else {
    output += chalk.gray(`  ✗ Mismatched: 0\n\n`);
  }

  output += '\n';

  if (result.success) {
    output += chalk.bold.green('All packages are in sync! ✓\n');
  } else {
    output += chalk.bold.red(`${result.mismatches.length} package(s) have version mismatches.\n`);
    if (!options.fix) {
      output += chalk.yellow('Run with --fix to automatically correct mismatches.\n');
    }
  }

  return output;
}

function formatJSON(result: SyncResult): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      success: result.success,
      canonicalVersion: result.canonicalVersion,
      packages: result.packages.map((p) => ({
        name: p.name,
        version: p.version,
        contractsVersion: p.contractsVersion,
      })),
      mismatches: result.mismatches,
    },
    null,
    2
  );
}

async function main() {
  const options = parseArgs();
  const args = process.argv.slice(2);
  const jsonOutput = args.includes('--json');

  try {
    const workspaceRoot = await findWorkspaceRoot();

    if (options.verbose && !jsonOutput) {
      console.error(chalk.gray(`Workspace root: ${workspaceRoot}`));
    }

    // Get canonical version from contracts package
    const canonicalVersion = await getCanonicalVersion(workspaceRoot);

    // Find all workspace packages (parallelized internally)
    const packages = await findWorkspacePackages(workspaceRoot);

    // Check for mismatches
    const { mismatches, synced: _synced } = checkVersionSync(packages, canonicalVersion);

    // Fix mismatches if requested (parallelized internally)
    if (options.fix && mismatches.length > 0) {
      await fixMismatches(mismatches, options);
    }

    const result: SyncResult = {
      success: mismatches.length === 0 || options.fix,
      packages,
      mismatches: options.fix ? [] : mismatches,
      canonicalVersion,
    };

    // Output results
    if (jsonOutput) {
      console.log(formatJSON(result));
    } else {
      console.log(formatOutput(result, options));
    }

    // Exit with error code if there are still mismatches
    if (!result.success) {
      process.exit(1);
    }

    process.exit(0);
  } catch (error) {
    if (jsonOutput) {
      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      );
    } else {
      console.error(
        chalk.red(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    }
    process.exit(2);
  }
}

main();
