#!/usr/bin/env node
/**
 * Compatibility Matrix Generator
 *
 * Generates a compatibility matrix from package metadata and contract declarations.
 * Anchors all versions to the canonical contracts package.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT_DIR = resolve(__dirname, '..');

function getContractVersion() {
  const contractsPackagePath = join(ROOT_DIR, 'packages', 'contracts', 'package.json');
  const contractsPackage = JSON.parse(readFileSync(contractsPackagePath, 'utf8'));
  return contractsPackage.version;
}

function scanComponents(contractVersion) {
  const components = [];
  const packagesDir = join(ROOT_DIR, 'packages');

  if (existsSync(packagesDir)) {
    const packages = readdirSync(packagesDir, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    for (const pkg of packages) {
      const packageJsonPath = join(packagesDir, pkg, 'package.json');
      if (existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
        const cpConfig = packageJson.controlplane || {};

        components.push({
          name: packageJson.name,
          version: packageJson.version,
          contractVersion: cpConfig.contractVersion || contractVersion,
          contractCompatibility: cpConfig.contractCompatibility || {
            min: '1.0.0',
            max: '<2.0.0',
          },
          location: `packages/${pkg}`,
          status: cpConfig.status || 'active',
          lastUpdated: new Date().toISOString().split('T')[0],
        });
      }
    }
  }

  // Add root orchestrator
  const rootPackagePath = join(ROOT_DIR, 'package.json');
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf8'));
  const rootCpConfig = rootPackage.controlplane || {};

  components.push({
    name: rootPackage.name,
    version: rootPackage.version,
    contractVersion: rootCpConfig.contractVersion || contractVersion,
    contractCompatibility: rootCpConfig.contractCompatibility || {
      min: '1.0.0',
      max: '<2.0.0',
    },
    location: 'root',
    status: 'active',
    lastUpdated: new Date().toISOString().split('T')[0],
  });

  return components;
}

function generateCompatibilityRanges(components) {
  const ranges = {};

  for (const component of components) {
    const compat = component.contractCompatibility;
    const max = compat.max.startsWith('<') ? compat.max.slice(1) : compat.max;
    ranges[component.name] = `${compat.min} <= version < ${max}`;
  }

  return ranges;
}

function checkVersionDrift(components, contractVersion) {
  const warnings = [];

  for (const component of components) {
    const compat = component.contractCompatibility;

    // Check if component is compatible with current contract version
    if (!isVersionInRange(contractVersion, compat.min, compat.max)) {
      warnings.push(
        `⚠️  ${component.name}@${component.version} may be incompatible with contracts@${contractVersion} ` +
          `(requires ${compat.min} - ${compat.max})`
      );
    }

    // Check for outdated contract declarations
    if (
      component.contractVersion !== contractVersion &&
      component.name !== '@controlplane/contracts'
    ) {
      warnings.push(
        `⚠️  ${component.name} declares contract@${component.contractVersion} but current is ${contractVersion}`
      );
    }
  }

  return warnings;
}

function isVersionInRange(version, min, max) {
  const v = parseVersion(version);
  const minV = parseVersion(min);
  const maxV = parseVersion(max.replace('<', ''));

  // Check min
  if (v.major < minV.major) return false;
  if (v.major === minV.major && v.minor < minV.minor) return false;
  if (v.major === minV.major && v.minor === minV.minor && v.patch < minV.patch) return false;

  // Check max (if specified with <)
  if (max.startsWith('<')) {
    if (v.major > maxV.major) return false;
    if (v.major === maxV.major && v.minor > maxV.minor) return false;
    if (v.major === maxV.major && v.minor === maxV.minor && v.patch >= maxV.patch) return false;
  }

  return true;
}

function parseVersion(version) {
  const [core] = version.split('-');
  const [major, minor, patch] = core.split('.').map(Number);
  return { major: major ?? 0, minor: minor ?? 0, patch: patch ?? 0 };
}

function generateMarkdown(matrix) {
  const lines = [];

  lines.push('# Compatibility Matrix');
  lines.push('');
  lines.push(`> **Generated**: ${matrix.generatedAt}`);
  lines.push(`> **Contract Version**: ${matrix.contractVersion}`);
  lines.push('');
  lines.push('## Current Component Versions');
  lines.push('');
  lines.push('| Component | Version | Contract Range | Status | Location |');
  lines.push('|-------------|---------|----------------|--------|----------|');

  for (const component of matrix.components) {
    const statusEmoji =
      component.status === 'active' ? '✅' : component.status === 'deprecated' ? '⚠️' : '🧪';
    const range = `${component.contractCompatibility.min} - ${component.contractCompatibility.max}`;
    lines.push(
      `| ${component.name} | ${component.version} | ${range} | ${statusEmoji} ${component.status} | ${component.location} |`
    );
  }

  lines.push('');
  lines.push('## Contract Compatibility');
  lines.push('');
  lines.push('| Component | Compatible Contract Versions |');
  lines.push('|-------------|------------------------------|');

  for (const [name, range] of Object.entries(matrix.compatibilityRanges)) {
    lines.push(`| ${name} | ${range} |`);
  }

  if (matrix.warnings.length > 0) {
    lines.push('');
    lines.push('## ⚠️ Version Warnings');
    lines.push('');
    for (const warning of matrix.warnings) {
      lines.push(`- ${warning}`);
    }
  }

  lines.push('');
  lines.push('## Automated Checks');
  lines.push('');
  lines.push('This matrix is automatically generated on every release. CI gates will fail if:');
  lines.push('');
  lines.push('- Component versions drift beyond declared contract ranges');
  lines.push('- Breaking changes are introduced in non-major versions');
  lines.push('- Contract compatibility declarations are missing');
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push(
    '**Note**: This matrix is auto-generated. Do not edit manually. Run `pnpm run compat:generate` to update.'
  );

  return lines.join('\n');
}

function generateJson(matrix) {
  return JSON.stringify(matrix, null, 2);
}

function main() {
  const args = process.argv.slice(2);
  const format = args.includes('--json') ? 'json' : 'markdown';
  const outputArg = args.find((arg) => arg.startsWith('--output='));
  const outputFile = outputArg
    ? outputArg.split('=')[1]
    : format === 'json'
      ? 'compatibility-matrix.json'
      : 'docs/COMPATIBILITY.md';

  console.log('🔍 Scanning components...');
  const contractVersion = getContractVersion();
  if (!contractVersion) {
    throw new Error('Contract version could not be resolved.');
  }
  const components = scanComponents(contractVersion);
  console.log(`📦 Found ${components.length} components`);
  console.log(`🔗 Contract version: ${contractVersion}`);

  const warnings = checkVersionDrift(components, contractVersion);
  if (warnings.length > 0) {
    console.log('⚠️  Warnings detected:');
    warnings.forEach((w) => console.log(`   ${w}`));
  }

  const matrix = {
    generatedAt: new Date().toISOString(),
    contractVersion,
    components,
    compatibilityRanges: generateCompatibilityRanges(components),
    warnings,
  };

  const content = format === 'json' ? generateJson(matrix) : generateMarkdown(matrix);
  const outputPath = resolve(ROOT_DIR, outputFile);

  writeFileSync(outputPath, content, 'utf8');
  console.log(`✅ Compatibility matrix written to ${outputFile}`);

  // Exit with error if there are warnings and --strict flag is set
  if (args.includes('--strict') && warnings.length > 0) {
    console.error('❌ Version drift detected (strict mode)');
    process.exit(1);
  }

  process.exit(0);
}

main();
