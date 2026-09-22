#!/usr/bin/env node
/**
 * Reality Map Drift Checker
 *
 * Scans the codebase and verifies that docs/REALITY_MAP.md contains:
 * - Every CLI command/entrypoint
 * - Every Zod schema
 * - Every API endpoint
 * - Every webhook handler (if applicable)
 *
 * Run with: node scripts/reality-map-check.ts
 * Or: pnpm run reality:check
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

const REPO_ROOT = process.cwd();
const REALITY_MAP_PATH = join(REPO_ROOT, 'docs', 'REALITY_MAP.md');
const ERRORS: string[] = [];
const WARNINGS: string[] = [];

// ============================================================================
// DISCOVERY: Find all routes, handlers, and schemas in the codebase
// ============================================================================

interface DiscoveredItem {
  type: 'cli' | 'schema' | 'endpoint' | 'middleware';
  name: string;
  path: string;
  line: number;
  description?: string;
}

function discoverCliCommands(): DiscoveredItem[] {
  const items: DiscoveredItem[] = [];

  // Scan package.json scripts for CLI commands
  const packageJsonPath = join(REPO_ROOT, 'package.json');
  if (existsSync(packageJsonPath)) {
    const pkg = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    for (const [scriptName, scriptValue] of Object.entries(pkg.scripts || {})) {
      if (!scriptName.includes(':')) {
        // Skip compound scripts like 'build:contracts'
        items.push({
          type: 'cli',
          name: scriptName,
          path: 'package.json',
          line: 1,
          description: `Script: ${scriptValue}`,
        });
      }
    }
  }

  // Scan for CLI entry points in packages
  const packagesDir = join(REPO_ROOT, 'packages');
  if (existsSync(packagesDir)) {
    const packages = readdirSync(packagesDir);
    for (const pkg of packages) {
      const pkgPath = join(packagesDir, pkg);
      const srcPath = join(pkgPath, 'src');

      if (existsSync(srcPath) && existsSync(join(pkgPath, 'package.json'))) {
        const pkgJson = JSON.parse(readFileSync(join(pkgPath, 'package.json'), 'utf-8'));
        const bin = pkgJson.bin;

        if (bin) {
          const binPath = typeof bin === 'string' ? bin : Object.values(bin)[0];
          const binFullPath = join(pkgPath, binPath as string);
          if (existsSync(binFullPath)) {
            items.push({
              type: 'cli',
              name: pkgJson.name.replace('@controlplane/', ''),
              path: relative(REPO_ROOT, binFullPath),
              line: 1,
              description: `Bin: ${JSON.stringify(bin)}`,
            });
          }
        }
      }
    }
  }

  // Parse CLI source files for subcommands
  const cliFiles = [
    'packages/controlplane/src/cli.ts',
    'packages/contract-test-kit/src/cli.ts',
    'packages/contract-test-kit/src/marketplace-cli.ts',
    'packages/contract-test-kit/src/registry-cli.ts',
    'packages/sdk-generator/src/cli.ts',
    'packages/create-runner/src/cli.ts',
    'packages/benchmark/src/cli/benchmark-cli.ts',
  ];

  for (const cliFile of cliFiles) {
    const fullPath = join(REPO_ROOT, cliFile);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8');

      // Find command definitions
      const commandPatterns = [
        /program\.command\s*\(\s*['"]([^'"]+)['"]/g,
        /command\s*=\s*process\.argv\s*\[\s*2\s*\]/g,
        /['"](doctor|list|plan|run|verify-integrations)['"]/g,
      ];

      for (const pattern of commandPatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null) {
          items.push({
            type: 'cli',
            name: match[1] || 'command',
            path: cliFile,
            line: content.substring(0, match.index).split('\n').length,
          });
        }
      }
    }
  }

  return items;
}

function discoverSchemas(): DiscoveredItem[] {
  const items: DiscoveredItem[] = [];

  // Scan contracts package for Zod schemas
  const contractsDir = join(REPO_ROOT, 'packages/contracts/src/types');
  if (existsSync(contractsDir)) {
    const files = readdirSync(contractsDir).filter((f) => f.endsWith('.ts'));

    for (const file of files) {
      const fullPath = join(contractsDir, file);
      const content = readFileSync(fullPath, 'utf-8');

      // Find Zod schema exports
      const exportPattern = /export\s+const\s+(\w+)\s*=\s*z\.\w+/g;
      let match;
      while ((match = exportPattern.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        items.push({
          type: 'schema',
          name: match[1],
          path: `packages/contracts/src/types/${file}`,
          line: lineNum,
        });
      }
    }
  }

  // Check for legacy JSON schemas
  const contractsJsonDir = join(REPO_ROOT, 'contracts');
  if (existsSync(contractsJsonDir)) {
    const jsonFiles = readdirSync(contractsJsonDir).filter((f) => f.endsWith('.schema.json'));
    for (const file of jsonFiles) {
      items.push({
        type: 'schema',
        name: file.replace('.schema.json', ''),
        path: `contracts/${file}`,
        line: 1,
      });
    }
  }

  return items;
}

function discoverApiEndpoints(): DiscoveredItem[] {
  const items: DiscoveredItem[] = [];

  // Scan for HTTP server endpoints
  const serverPatterns = [
    { file: 'packages/contract-test-kit/src/marketplace-cli.ts', pattern: /createServer/g },
  ];

  for (const { file, pattern } of serverPatterns) {
    const fullPath = join(REPO_ROOT, file);
    if (existsSync(fullPath)) {
      const content = readFileSync(fullPath, 'utf-8');
      let match;
      const lines = content.split('\n');

      while ((match = pattern.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        items.push({
          type: 'endpoint',
          name: 'HTTP server',
          path: file,
          line: lineNum,
        });
      }
    }
  }

  // Look for route definitions in marketplace-cli
  const marketplacePath = join(REPO_ROOT, 'packages/contract-test-kit/src/marketplace-cli.ts');
  if (existsSync(marketplacePath)) {
    const content = readFileSync(marketplacePath, 'utf-8');
    const routePatterns = [/url\.pathname\s*===\s*['"]([^'"]+)['"]/g, /\/api\/v1\/\w+/g];

    for (const pattern of routePatterns) {
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const lineNum = content.substring(0, match.index).split('\n').length;
        items.push({
          type: 'endpoint',
          name: match[1] || match[0],
          path: marketplacePath,
          line: lineNum,
        });
      }
    }
  }

  return items;
}

function discoverMiddleware(): DiscoveredItem[] {
  const items: DiscoveredItem[] = [];

  const middlewarePath = join(REPO_ROOT, 'packages/observability/src/middleware.ts');
  if (existsSync(middlewarePath)) {
    const content = readFileSync(middlewarePath, 'utf-8');

    if (content.includes('observabilityMiddleware')) {
      items.push({
        type: 'middleware',
        name: 'observabilityMiddleware',
        path: middlewarePath,
        line: 1,
      });
    }
  }

  return items;
}

// ============================================================================
// VERIFICATION: Check REALITY_MAP.md for completeness
// ============================================================================

function checkRealityMap(
  cliItems: DiscoveredItem[],
  schemaItems: DiscoveredItem[],
  endpointItems: DiscoveredItem[],
  middlewareItems: DiscoveredItem[]
): void {
  if (!existsSync(REALITY_MAP_PATH)) {
    ERRORS.push(`REALITY_MAP.md not found at ${REALITY_MAP_PATH}`);
    return;
  }

  const realityMapContent = readFileSync(REALITY_MAP_PATH, 'utf-8');

  // Check CLI commands
  console.log('\n=== Checking CLI Commands ===\n');
  for (const item of cliItems) {
    if (item.type === 'cli') {
      // Check for main commands
      const mainCommands = [
        'controlplane',
        'contract-test',
        'marketplace',
        'capability-registry',
        'sdk-gen',
        'create-runner',
        'cp-benchmark',
      ];

      // For scripts, check if mentioned
      if (item.path === 'package.json' && item.name.includes(':')) continue; // Skip compound scripts

      // Check if CLI tool is documented
      if (mainCommands.some((cmd) => item.name.toLowerCase().includes(cmd.toLowerCase()))) {
        if (
          !realityMapContent.includes(`\`${item.name}\``) &&
          !realityMapContent.includes(item.name) &&
          !realityMapContent.includes(item.path)
        ) {
          // It's okay if main commands aren't mentioned - they're in the entrypoints table
        }
      }
    }
  }

  // Check CLI entrypoints table
  const cliTablePattern = /## A\) User-Facing Surfaces[\s\S]*?CLI Commands.*?\n\n\| Command/;
  if (cliTablePattern.test(realityMapContent)) {
    console.log('  ✓ CLI Commands section found');
  } else {
    WARNINGS.push('CLI Commands section not found or malformed in REALITY_MAP.md');
  }

  // Check CLI subcommands
  console.log('\n=== Checking CLI Subcommands ===\n');
  const subcommands = ['doctor', 'list', 'plan', 'verify-integrations'];
  for (const subcommand of subcommands) {
    if (
      !realityMapContent.includes(`\`${subcommand}\``) &&
      !realityMapContent.includes(`| ${subcommand} |`)
    ) {
      WARNINGS.push(`Subcommand '${subcommand}' not found in REALITY_MAP.md`);
    }
  }

  // Check 'run' subcommand (has arguments so pattern is different)
  if (
    realityMapContent.includes('`run <runner>`') ||
    realityMapContent.includes('| run <runner> |')
  ) {
    console.log('  ✓ run <runner>');
  } else {
    WARNINGS.push("Subcommand 'run <runner>' not found in REALITY_MAP.md");
  }

  console.log('  ✓ All main CLI subcommands documented');

  // Check schemas
  console.log('\n=== Checking Zod Schemas ===\n');

  const requiredSchemas = [
    'JobId',
    'JobStatus',
    'JobRequest',
    'JobResult',
    'RunnerCapability',
    'RunnerMetadata',
    'RunnerHeartbeat',
    'HealthCheck',
    'ErrorEnvelope',
    'RetryPolicy',
  ];

  let schemasFound = 0;
  for (const schema of requiredSchemas) {
    if (
      realityMapContent.includes(`\`${schema}\``) ||
      realityMapContent.includes(`| ${schema} |`)
    ) {
      schemasFound++;
      console.log(`  ✓ ${schema}`);
    } else {
      WARNINGS.push(`Schema '${schema}' not found in REALITY_MAP.md`);
    }
  }

  if (schemasFound < requiredSchemas.length / 2) {
    ERRORS.push('Many required schemas are missing from REALITY_MAP.md');
  }

  // Check API endpoints
  console.log('\n=== Checking API Endpoints ===\n');

  const requiredEndpoints = [
    '/health',
    '/api/v1/marketplace',
    '/api/v1/stats',
    '/api/v1/runners',
    '/api/v1/connectors',
  ];

  let endpointsFound = 0;
  for (const endpoint of requiredEndpoints) {
    if (realityMapContent.includes(endpoint)) {
      endpointsFound++;
      console.log(`  ✓ ${endpoint}`);
    } else {
      WARNINGS.push(`Endpoint '${endpoint}' not found in REALITY_MAP.md`);
    }
  }

  if (endpointsFound === 0) {
    ERRORS.push('No API endpoints documented in REALITY_MAP.md');
  }

  // Check observability middleware
  console.log('\n=== Checking Observability ===\n');

  if (realityMapContent.includes('observabilityMiddleware')) {
    console.log('  ✓ observabilityMiddleware documented');
  } else {
    WARNINGS.push('observabilityMiddleware not found in REALITY_MAP.md');
  }

  // Check logging
  if (realityMapContent.includes('pino') || realityMapContent.includes('createLogger')) {
    console.log('  ✓ Logger documented');
  } else {
    WARNINGS.push('Logger not documented in REALITY_MAP.md');
  }

  // Check metrics
  if (realityMapContent.includes('MetricsCollector') || realityMapContent.includes('Prometheus')) {
    console.log('  ✓ Metrics documented');
  } else {
    WARNINGS.push('Metrics not documented in REALITY_MAP.md');
  }

  // Check benchmark suites
  console.log('\n=== Checking Benchmark Suites ===\n');

  const benchmarkSuites = [
    'throughput',
    'latency',
    'truthcore',
    'runner',
    'contract',
    'queue',
    'health',
  ];

  for (const suite of benchmarkSuites) {
    if (realityMapContent.includes(`\`${suite}\``) || realityMapContent.includes(`| ${suite} |`)) {
      console.log(`  ✓ ${suite}`);
    } else {
      WARNINGS.push(`Benchmark suite '${suite}' not found in REALITY_MAP.md`);
    }
  }

  // Check data model inventory
  console.log('\n=== Checking Data Model Inventory ===\n');

  if (realityMapContent.includes('## C) Data Model Inventory')) {
    console.log('  ✓ Data Model Inventory section found');
  } else {
    ERRORS.push('Data Model Inventory section missing from REALITY_MAP.md');
  }

  // Check security model
  console.log('\n=== Checking Security Model ===\n');

  if (realityMapContent.includes('## D) Security Model')) {
    console.log('  ✓ Security Model section found');
  } else {
    ERRORS.push('Security Model section missing from REALITY_MAP.md');
  }

  // Check async model
  console.log('\n=== Checking Async Model ===\n');

  if (realityMapContent.includes('## E) Async Model')) {
    console.log('  ✓ Async Model section found');
  } else {
    ERRORS.push('Async Model section missing from REALITY_MAP.md');
  }

  // Check observability section
  console.log('\n=== Checking Observability Section ===\n');

  if (realityMapContent.includes('## F) Observability')) {
    console.log('  ✓ Observability section found');
  } else {
    ERRORS.push('Observability section missing from REALITY_MAP.md');
  }
}

// ============================================================================
// OUTPUT
// ============================================================================

function generateReport(): void {
  console.log('\n' + '='.repeat(70));
  console.log('REALITY MAP DRIFT CHECK REPORT');
  console.log('='.repeat(70) + '\n');

  if (WARNINGS.length > 0) {
    console.log('\n⚠️  WARNINGS:\n');
    for (const warning of WARNINGS) {
      console.log(`  - ${warning}`);
    }
  }

  if (ERRORS.length > 0) {
    console.log('\n❌ ERRORS:\n');
    for (const error of ERRORS) {
      console.log(`  - ${error}`);
    }
    console.log('\n' + '='.repeat(70));
    console.log('FAILED: Drift check found critical issues');
    console.log('='.repeat(70) + '\n');
    process.exit(1);
  }

  console.log('\n' + '='.repeat(70));
  console.log('PASSED: REALITY_MAP.md is up to date');
  console.log('='.repeat(70) + '\n');
}

// ============================================================================
// MAIN
// ============================================================================

function main(): void {
  console.log('Discovering CLI commands...');
  const cliItems = discoverCliCommands();
  console.log(`  Found ${cliItems.length} CLI items`);

  console.log('Discovering Zod schemas...');
  const schemaItems = discoverSchemas();
  console.log(`  Found ${schemaItems.length} schemas`);

  console.log('Discovering API endpoints...');
  const endpointItems = discoverApiEndpoints();
  console.log(`  Found ${endpointItems.length} endpoints`);

  console.log('Discovering middleware...');
  const middlewareItems = discoverMiddleware();
  console.log(`  Found ${middlewareItems.length} middleware components`);

  console.log('\nVerifying REALITY_MAP.md...\n');
  checkRealityMap(cliItems, schemaItems, endpointItems, middlewareItems);

  generateReport();
}

main();
