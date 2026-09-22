#!/usr/bin/env node

import { buildCapabilityRegistry } from './index.js';
import {
  buildMarketplaceIndex,
  queryMarketplace,
  formatMarketplaceOutput,
  createDeterministicTrustSignal,
  type TrustSignalSource,
} from './marketplace.js';
import type { MarketplaceQuery, RunnerCategory, ConnectorType } from '@controlplane/contracts';
import chalk from 'chalk';

interface CLIOptions {
  command: 'build' | 'query' | 'serve';
  format: 'json' | 'yaml' | 'table';
  output?: string;
  environment: 'development' | 'staging' | 'production';
  includeUnverified: boolean;
  includeDeprecated: boolean;
  verbose: boolean;
  // Query options
  type?: 'runner' | 'connector' | 'all';
  category?: RunnerCategory;
  connectorType?: ConnectorType;
  status?: 'active' | 'deprecated' | 'pending_review' | 'all';
  trustLevel?: 'verified' | 'community' | 'all';
  search?: string;
  author?: string;
  keywords?: string[];
  sortBy?: 'relevance' | 'name' | 'published' | 'updated' | 'rating' | 'downloads';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
  // Server options
  port?: number;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);

  const command = (args[0] as CLIOptions['command']) || 'build';
  const formatArg = args.find((arg) => arg.startsWith('--format='));
  const outputArg = args.find((arg) => arg.startsWith('--output='));
  const envArg = args.find((arg) => arg.startsWith('--env='));
  const typeArg = args.find((arg) => arg.startsWith('--type='));
  const categoryArg = args.find((arg) => arg.startsWith('--category='));
  const connectorTypeArg = args.find((arg) => arg.startsWith('--connector-type='));
  const statusArg = args.find((arg) => arg.startsWith('--status='));
  const trustArg = args.find((arg) => arg.startsWith('--trust='));
  const searchArg = args.find((arg) => arg.startsWith('--search='));
  const authorArg = args.find((arg) => arg.startsWith('--author='));
  const keywordsArg = args.find((arg) => arg.startsWith('--keywords='));
  const sortByArg = args.find((arg) => arg.startsWith('--sort-by='));
  const sortOrderArg = args.find((arg) => arg.startsWith('--sort-order='));
  const limitArg = args.find((arg) => arg.startsWith('--limit='));
  const offsetArg = args.find((arg) => arg.startsWith('--offset='));
  const portArg = args.find((arg) => arg.startsWith('--port='));

  return {
    command,
    format: (formatArg?.split('=')[1] as CLIOptions['format']) || 'json',
    output: outputArg?.split('=')[1],
    environment: (envArg?.split('=')[1] as CLIOptions['environment']) || 'development',
    includeUnverified: args.includes('--include-unverified'),
    includeDeprecated: args.includes('--include-deprecated'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    type: typeArg?.split('=')[1] as CLIOptions['type'],
    category: categoryArg?.split('=')[1] as RunnerCategory,
    connectorType: connectorTypeArg?.split('=')[1] as ConnectorType,
    status: (statusArg?.split('=')[1] as CLIOptions['status']) || 'active',
    trustLevel: (trustArg?.split('=')[1] as CLIOptions['trustLevel']) || 'all',
    search: searchArg?.split('=')[1],
    author: authorArg?.split('=')[1],
    keywords: keywordsArg?.split('=')[1]?.split(','),
    sortBy: (sortByArg?.split('=')[1] as CLIOptions['sortBy']) || 'relevance',
    sortOrder: (sortOrderArg?.split('=')[1] as CLIOptions['sortOrder']) || 'desc',
    limit: limitArg ? parseInt(limitArg.split('=')[1], 10) : 20,
    offset: offsetArg ? parseInt(offsetArg.split('=')[1], 10) : 0,
    port: portArg ? parseInt(portArg.split('=')[1], 10) : 3000,
  };
}

function formatPrettyMarketplace(
  index: Awaited<ReturnType<typeof buildMarketplaceIndex>>['index']
): string {
  let output = '\n';
  output += chalk.bold.blue('╔══════════════════════════════════════════════════════════╗\n');
  output += chalk.bold.blue('║      ControlPlane Marketplace                           ║\n');
  output += chalk.bold.blue('╚══════════════════════════════════════════════════════════╝\n\n');

  output += chalk.bold('System:\n');
  output += `  Name: ${chalk.cyan(index.system.name)}\n`;
  output += `  Version: ${chalk.cyan(index.system.version)}\n`;
  output += `  Environment: ${chalk.cyan(index.system.environment)}\n\n`;

  output += chalk.bold('Statistics:\n');
  output += `  Total Runners: ${chalk.cyan(index.stats.totalRunners)}\n`;
  output += `  Total Connectors: ${chalk.cyan(index.stats.totalConnectors)}\n`;
  output += `  Total Capabilities: ${chalk.cyan(index.stats.totalCapabilities)}\n`;
  output += `  Verified Items: ${chalk.green(index.stats.verifiedCount)}\n`;
  output += `  Pending Review: ${chalk.yellow(index.stats.pendingReviewCount)}\n`;
  output += `  Deprecated: ${chalk.red(index.stats.deprecatedCount)}\n\n`;

  if (Object.keys(index.stats.categories).length > 0) {
    output += chalk.bold('Categories:\n');
    for (const [category, count] of Object.entries(index.stats.categories)) {
      const trustColor = count > 0 ? chalk.cyan : chalk.gray;
      output += `  ${trustColor(category)}: ${trustColor(count)}\n`;
    }
    output += '\n';
  }

  if (index.runners.length > 0) {
    output += chalk.bold('Runners:\n');
    for (const runner of index.runners) {
      const trustColor =
        runner.trustSignals.overallTrust === 'verified'
          ? chalk.green
          : runner.trustSignals.overallTrust === 'pending'
            ? chalk.yellow
            : chalk.gray;

      output += `  ${trustColor('●')} ${chalk.bold(runner.metadata.name)} ${chalk.gray(`v${runner.metadata.version}`)}\n`;
      output += `    Category: ${chalk.cyan(runner.category)}\n`;
      output += `    Trust: ${trustColor(runner.trustSignals.overallTrust)}\n`;
      output += `    Capabilities: ${chalk.gray(runner.capabilities.length)}\n`;
      output += `    Description: ${chalk.gray(runner.description.substring(0, 60))}${runner.description.length > 60 ? '...' : ''}\n`;

      // Trust signals
      if (runner.trustSignals.contractTestStatus !== 'not_tested') {
        const testColor =
          runner.trustSignals.contractTestStatus === 'passing' ? chalk.green : chalk.red;
        output += `    Contract Tests: ${testColor(runner.trustSignals.contractTestStatus)}\n`;
      }
      if (runner.trustSignals.securityScanStatus !== 'not_scanned') {
        const scanColor =
          runner.trustSignals.securityScanStatus === 'passed' ? chalk.green : chalk.red;
        output += `    Security: ${scanColor(runner.trustSignals.securityScanStatus)}\n`;
      }
      if (runner.trustSignals.downloadCount > 0) {
        output += `    Downloads: ${chalk.gray(runner.trustSignals.downloadCount.toLocaleString())}\n`;
      }
      output += '\n';
    }
  }

  if (index.connectors.length > 0) {
    output += chalk.bold('Connectors:\n');
    for (const connector of index.connectors) {
      const trustColor =
        connector.trustSignals.overallTrust === 'verified'
          ? chalk.green
          : connector.trustSignals.overallTrust === 'pending'
            ? chalk.yellow
            : chalk.gray;

      output += `  ${trustColor('●')} ${chalk.bold(connector.config.name)} ${chalk.gray(`v${connector.config.version}`)}\n`;
      output += `    Type: ${chalk.cyan(connector.config.type)}\n`;
      output += `    Trust: ${trustColor(connector.trustSignals.overallTrust)}\n`;
      output += `    Description: ${chalk.gray(connector.description.substring(0, 60))}${connector.description.length > 60 ? '...' : ''}\n`;

      if (connector.trustSignals.contractTestStatus !== 'not_tested') {
        const testColor =
          connector.trustSignals.contractTestStatus === 'passing' ? chalk.green : chalk.red;
        output += `    Contract Tests: ${testColor(connector.trustSignals.contractTestStatus)}\n`;
      }
      output += '\n';
    }
  }

  output += chalk.gray(`Generated at: ${index.generatedAt}\n`);

  return output;
}

function formatPrettyQueryResult(result: Awaited<ReturnType<typeof queryMarketplace>>): string {
  let output = '\n';
  output += chalk.bold.blue('╔══════════════════════════════════════════════════════════╗\n');
  output += chalk.bold.blue('║      Marketplace Search Results                           ║\n');
  output += chalk.bold.blue('╚══════════════════════════════════════════════════════════╝\n\n');

  output += chalk.bold(`Total: ${result.total} items`);
  if (result.hasMore) {
    output += chalk.gray(` (showing ${result.items.length})`);
  }
  output += '\n\n';

  // Facets
  if (Object.keys(result.facets.categories).length > 0) {
    output += chalk.bold('Categories:\n');
    for (const [cat, count] of Object.entries(result.facets.categories)) {
      output += `  ${chalk.cyan(cat)}: ${count}\n`;
    }
    output += '\n';
  }

  if (Object.keys(result.facets.trustLevels).length > 0) {
    output += chalk.bold('Trust Levels:\n');
    for (const [level, count] of Object.entries(result.facets.trustLevels)) {
      const color =
        level === 'verified' ? chalk.green : level === 'pending' ? chalk.yellow : chalk.gray;
      output += `  ${color(level)}: ${count}\n`;
    }
    output += '\n';
  }

  // Items
  if (result.items.length === 0) {
    output += chalk.gray('No results found.\n');
  } else {
    output += chalk.bold('Results:\n\n');

    for (let i = 0; i < result.items.length; i++) {
      const item = result.items[i];
      const num = chalk.gray(`${(result.query.offset || 0) + i + 1}.`);

      if ('category' in item) {
        // Runner
        const trustColor =
          item.trustSignals.overallTrust === 'verified'
            ? chalk.green
            : item.trustSignals.overallTrust === 'pending'
              ? chalk.yellow
              : chalk.gray;

        output += `${num} ${chalk.bold(item.metadata.name)} ${chalk.gray(`v${item.metadata.version}`)} ${trustColor('●')}\n`;
        output += `   Type: ${chalk.cyan('Runner')} | Category: ${chalk.cyan(item.category)}\n`;
        output += `   ${chalk.gray(item.description.substring(0, 80))}${item.description.length > 80 ? '...' : ''}\n`;
        output += `   Trust: ${trustColor(item.trustSignals.overallTrust)}`;
        if (item.trustSignals.contractTestStatus !== 'not_tested') {
          output += ` | Tests: ${item.trustSignals.contractTestStatus === 'passing' ? chalk.green('✓') : chalk.red('✗')}`;
        }
        output += '\n\n';
      } else {
        // Connector
        const trustColor =
          item.trustSignals.overallTrust === 'verified'
            ? chalk.green
            : item.trustSignals.overallTrust === 'pending'
              ? chalk.yellow
              : chalk.gray;

        output += `${num} ${chalk.bold(item.config.name)} ${chalk.gray(`v${item.config.version}`)} ${trustColor('●')}\n`;
        output += `   Type: ${chalk.cyan('Connector')} | Category: ${chalk.cyan(item.config.type)}\n`;
        output += `   ${chalk.gray(item.description.substring(0, 80))}${item.description.length > 80 ? '...' : ''}\n`;
        output += `   Trust: ${trustColor(item.trustSignals.overallTrust)}\n\n`;
      }
    }
  }

  return output;
}

async function handleBuild(options: CLIOptions): Promise<void> {
  if (options.verbose) {
    console.error(chalk.gray('Building capability registry...\n'));
  }

  // Build the capability registry
  const { registry, errors } = await buildCapabilityRegistry({
    workspaceRoot: process.cwd(),
    environment: options.environment,
    includeOffline: options.includeUnverified,
  });

  if (errors.length > 0 && options.verbose) {
    console.error(chalk.yellow('\nRegistry Warnings:'));
    for (const error of errors) {
      console.error(chalk.yellow(`  ⚠ ${error}`));
    }
  }

  const buildTimestamp = new Date().toISOString();

  // Mock trust signals for now (in real implementation, these would come from a database or scan results)
  const trustSources = new Map<string, TrustSignalSource>();

  // Add mock trust signals for runners (would be populated from actual test results)
  for (const runner of registry.runners) {
    trustSources.set(
      runner.metadata.id,
      createDeterministicTrustSignal(runner.metadata.id, runner.metadata.version, buildTimestamp)
    );
  }

  if (options.verbose) {
    console.error(chalk.gray('Building marketplace index...\n'));
  }

  // Build the marketplace index
  const {
    index,
    errors: marketplaceErrors,
    warnings: marketplaceWarnings,
    stats,
  } = await buildMarketplaceIndex(registry, trustSources, {
    workspaceRoot: process.cwd(),
    environment: options.environment,
    includeUnverified: options.includeUnverified,
    includeDeprecated: options.includeDeprecated,
    includePending: false,
  });

  if (marketplaceErrors.length > 0) {
    console.error(chalk.red('\nMarketplace Errors:'));
    for (const error of marketplaceErrors) {
      console.error(chalk.red(`  ✗ ${error}`));
    }
  }

  if (marketplaceWarnings.length > 0 && options.verbose) {
    console.error(chalk.yellow('\nMarketplace Warnings:'));
    for (const warning of marketplaceWarnings) {
      console.error(chalk.yellow(`  ⚠ ${warning}`));
    }
  }

  if (options.verbose) {
    console.error(
      chalk.gray(
        `\nProcessed: ${stats.runnersProcessed} runners, ${stats.connectorsProcessed} connectors`
      )
    );
    console.error(chalk.gray(`Trust signals applied: ${stats.trustSignalsApplied}\n`));
  }

  // Format output
  let output: string;
  if (options.format === 'table') {
    output = formatPrettyMarketplace(index);
  } else {
    output = formatMarketplaceOutput(index, options.format);
  }

  // Write or print output
  if (options.output) {
    const { writeFileSync } = await import('fs');
    writeFileSync(options.output, output);
    console.log(chalk.green(`Marketplace index written to ${options.output}`));
  } else {
    console.log(output);
  }
}

async function handleQuery(options: CLIOptions): Promise<void> {
  if (options.verbose) {
    console.error(chalk.gray('Loading marketplace index...\n'));
  }

  // Load existing index or build new one
  const { readFileSync, existsSync } = await import('fs');
  const indexPath = './marketplace-index.json';

  let index;
  if (existsSync(indexPath)) {
    index = JSON.parse(readFileSync(indexPath, 'utf-8'));
  } else {
    console.error(chalk.yellow('No marketplace index found. Run `marketplace build` first.\n'));
    process.exit(1);
  }

  // Build query
  const query: MarketplaceQuery = {
    type: options.type || 'all',
    category: options.category,
    connectorType: options.connectorType,
    status: options.status || 'active',
    trustLevel: options.trustLevel || 'all',
    search: options.search,
    author: options.author,
    keywords: options.keywords || [],
    sortBy: options.sortBy || 'relevance',
    sortOrder: options.sortOrder || 'desc',
    limit: options.limit || 20,
    offset: options.offset || 0,
  };

  if (options.verbose) {
    console.error(chalk.gray('Executing query...\n'));
  }

  const result = queryMarketplace(index, query);

  // Format output
  let output: string;
  if (options.format === 'table') {
    output = formatPrettyQueryResult(result);
  } else {
    output = JSON.stringify(result, null, 2);
  }

  console.log(output);
}

async function handleServe(options: CLIOptions): Promise<void> {
  console.log(chalk.blue(`Starting marketplace API server on port ${options.port}...\n`));

  // Simple HTTP server (no external deps)
  const { createServer } = await import('http');
  const { readFileSync, existsSync } = await import('fs');

  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    // Load index
    const indexPath = './marketplace-index.json';
    if (!existsSync(indexPath)) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Marketplace index not available' }));
      return;
    }

    const index = JSON.parse(readFileSync(indexPath, 'utf-8'));

    const url = new URL(req.url || '/', `http://localhost:${options.port}`);

    // Routes
    if (url.pathname === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
      return;
    }

    if (url.pathname === '/api/v1/marketplace' || url.pathname === '/') {
      // Build query from URL params
      const query: MarketplaceQuery = {
        type: (url.searchParams.get('type') as MarketplaceQuery['type']) || 'all',
        category: url.searchParams.get('category') || undefined,
        connectorType: url.searchParams.get('connectorType') || undefined,
        status: (url.searchParams.get('status') as MarketplaceQuery['status']) || 'active',
        trustLevel: (url.searchParams.get('trustLevel') as MarketplaceQuery['trustLevel']) || 'all',
        search: url.searchParams.get('search') || undefined,
        author: url.searchParams.get('author') || undefined,
        keywords: url.searchParams.get('keywords')?.split(',') || [],
        sortBy: (url.searchParams.get('sortBy') as MarketplaceQuery['sortBy']) || 'relevance',
        sortOrder: (url.searchParams.get('sortOrder') as MarketplaceQuery['sortOrder']) || 'desc',
        limit: parseInt(url.searchParams.get('limit') || '20', 10),
        offset: parseInt(url.searchParams.get('offset') || '0', 10),
      };

      const result = queryMarketplace(index, query);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/v1/stats') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          stats: index.stats,
          filters: index.filters,
          generatedAt: index.generatedAt,
        })
      );
      return;
    }

    if (url.pathname === '/api/v1/runners') {
      const result = queryMarketplace(index, {
        type: 'runner',
        status: 'all',
        trustLevel: 'all',
        limit: 100,
        offset: 0,
        sortBy: 'name',
        sortOrder: 'asc',
        keywords: [],
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === '/api/v1/connectors') {
      const result = queryMarketplace(index, {
        type: 'connector',
        status: 'all',
        trustLevel: 'all',
        limit: 100,
        offset: 0,
        sortBy: 'name',
        sortOrder: 'asc',
        keywords: [],
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
      return;
    }

    // 404
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  });

  server.listen(options.port, () => {
    console.log(
      chalk.green(`✓ Marketplace API server running on http://localhost:${options.port}`)
    );
    console.log(chalk.gray(`\nEndpoints:`));
    console.log(chalk.gray(`  GET /health              - Health check`));
    console.log(chalk.gray(`  GET /api/v1/marketplace  - Query marketplace (read-only)`));
    console.log(chalk.gray(`  GET /api/v1/stats        - Marketplace statistics`));
    console.log(chalk.gray(`  GET /api/v1/runners      - List all runners`));
    console.log(chalk.gray(`  GET /api/v1/connectors   - List all connectors\n`));
    console.log(chalk.gray(`Query parameters:`));
    console.log(chalk.gray(`  type, category, status, trustLevel, search, author, keywords`));
    console.log(chalk.gray(`  sortBy, sortOrder, limit, offset\n`));
  });

  // Keep process alive
  process.on('SIGINT', () => {
    console.log(chalk.gray('\nShutting down server...'));
    server.close(() => {
      console.log(chalk.gray('Server stopped.'));
      process.exit(0);
    });
  });
}

async function main() {
  const options = parseArgs();

  try {
    switch (options.command) {
      case 'build':
        await handleBuild(options);
        break;
      case 'query':
        await handleQuery(options);
        break;
      case 'serve':
        await handleServe(options);
        break;
      default:
        console.error(chalk.red(`Unknown command: ${options.command}`));
        console.error(chalk.gray('Usage: marketplace <build|query|serve> [options]'));
        process.exit(1);
    }
  } catch (error) {
    console.error(
      chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`)
    );
    if (options.verbose) {
      console.error(error);
    }
    process.exit(1);
  }
}

main();
