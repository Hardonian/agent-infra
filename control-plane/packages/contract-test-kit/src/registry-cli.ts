#!/usr/bin/env node

import { buildCapabilityRegistry, formatRegistryOutput, filterRegistry } from './index.js';
import type { RunnerCategory } from '@controlplane/contracts';
import chalk from 'chalk';

interface CLIOptions {
  format: 'json' | 'yaml' | 'table';
  output?: string;
  category?: RunnerCategory;
  healthStatus?: 'healthy' | 'degraded' | 'unhealthy' | 'offline' | 'any';
  environment: 'development' | 'staging' | 'production';
  includeOffline: boolean;
  verbose: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);

  const formatArg = args.find((arg) => arg.startsWith('--format='));
  const outputArg = args.find((arg) => arg.startsWith('--output='));
  const categoryArg = args.find((arg) => arg.startsWith('--category='));
  const healthArg = args.find((arg) => arg.startsWith('--health='));
  const envArg = args.find((arg) => arg.startsWith('--env='));

  return {
    format: (formatArg?.split('=')[1] as CLIOptions['format']) || 'json',
    output: outputArg?.split('=')[1],
    category: categoryArg?.split('=')[1] as RunnerCategory,
    healthStatus: (healthArg?.split('=')[1] as CLIOptions['healthStatus']) || 'any',
    environment: (envArg?.split('=')[1] as CLIOptions['environment']) || 'development',
    includeOffline: args.includes('--include-offline'),
    verbose: args.includes('--verbose') || args.includes('-v'),
  };
}

function formatPretty(
  registry: Awaited<ReturnType<typeof buildCapabilityRegistry>>['registry']
): string {
  let output = '\n';
  output += chalk.bold.blue('╔══════════════════════════════════════════════════════════╗\n');
  output += chalk.bold.blue('║      ControlPlane Capability Registry                   ║\n');
  output += chalk.bold.blue('╚══════════════════════════════════════════════════════════╝\n\n');

  output += chalk.bold('System:\n');
  output += `  Name: ${chalk.cyan(registry.system.name)}\n`;
  output += `  Version: ${chalk.cyan(registry.system.version)}\n`;
  output += `  Environment: ${chalk.cyan(registry.system.environment)}\n\n`;

  output += chalk.bold('TruthCore Compatibility:\n');
  output += `  Contract Version: ${chalk.cyan(
    `${registry.truthcore.contractVersion.major}.${registry.truthcore.contractVersion.minor}.${registry.truthcore.contractVersion.patch}`
  )}\n`;
  output += `  Supported Range: ${chalk.cyan(
    `${registry.truthcore.supportedVersions.min.major}.${registry.truthcore.supportedVersions.min.minor}.${registry.truthcore.supportedVersions.min.patch}` +
      (registry.truthcore.supportedVersions.max
        ? ` - ${registry.truthcore.supportedVersions.max.major}.${registry.truthcore.supportedVersions.max.minor}.${registry.truthcore.supportedVersions.max.patch}`
        : '+')
  )}\n`;
  output += `  Features: ${chalk.cyan(registry.truthcore.features.join(', '))}\n\n`;

  output += chalk.bold('Runners:\n');
  if (registry.runners.length === 0) {
    output += chalk.gray('  No runners registered\n');
  } else {
    for (const runner of registry.runners) {
      const statusColor =
        runner.health.status === 'healthy'
          ? chalk.green
          : runner.health.status === 'degraded'
            ? chalk.yellow
            : chalk.red;
      output += `  ${statusColor('●')} ${chalk.bold(runner.metadata.name)}\n`;
      output += `    Category: ${chalk.cyan(runner.category)}\n`;
      output += `    Status: ${statusColor(runner.health.status)}\n`;
      output += `    Version: ${chalk.gray(runner.metadata.version)}\n`;
      if (runner.connectors.length > 0) {
        output += `    Connectors: ${chalk.gray(runner.connectors.join(', '))}\n`;
      }
      output += `    Capabilities: ${chalk.gray(runner.capabilities.length)}\n`;
    }
  }
  output += '\n';

  output += chalk.bold('Connectors:\n');
  if (registry.connectors.length === 0) {
    output += chalk.gray('  No connectors configured\n');
  } else {
    for (const connector of registry.connectors) {
      const statusColor =
        connector.status === 'connected'
          ? chalk.green
          : connector.status === 'disconnected'
            ? chalk.gray
            : connector.status === 'error'
              ? chalk.red
              : chalk.yellow;
      output += `  ${statusColor('●')} ${chalk.bold(connector.config.name)}\n`;
      output += `    Type: ${chalk.cyan(connector.config.type)}\n`;
      output += `    Status: ${statusColor(connector.status)}\n`;
      output += `    Required: ${connector.config.required ? chalk.yellow('Yes') : chalk.gray('No')}\n`;
    }
  }
  output += '\n';

  output += chalk.bold('Summary:\n');
  output += `  Total Runners: ${chalk.cyan(registry.summary.totalRunners)}\n`;
  output += `  Total Capabilities: ${chalk.cyan(registry.summary.totalCapabilities)}\n`;
  output += `  Total Connectors: ${chalk.cyan(registry.summary.totalConnectors)}\n`;
  output += `  Healthy Runners: ${chalk.green(registry.summary.healthyRunners)}\n`;
  output += `  Healthy Connectors: ${chalk.green(registry.summary.healthyConnectors)}\n`;

  if (Object.keys(registry.summary.categories).length > 0) {
    output += `\n  Categories:\n`;
    for (const [category, count] of Object.entries(registry.summary.categories)) {
      output += `    ${chalk.cyan(category)}: ${count}\n`;
    }
  }

  output += '\n';
  output += chalk.gray(`Generated at: ${registry.generatedAt}\n`);

  return output;
}

async function main() {
  const options = parseArgs();
  const args = process.argv.slice(2);
  const isPretty = !args.includes('--json') && options.format === 'json';

  try {
    if (options.verbose && isPretty) {
      console.error(chalk.gray('Discovering capabilities...\n'));
    }

    // Build the registry
    const { registry, errors, warnings } = await buildCapabilityRegistry({
      workspaceRoot: process.cwd(),
      environment: options.environment,
      includeOffline: options.includeOffline,
    });

    // Apply filters if specified
    let filteredRegistry = registry;
    if (options.category || (options.healthStatus && options.healthStatus !== 'any')) {
      filteredRegistry = filterRegistry(registry, {
        category: options.category,
        healthStatus: options.healthStatus,
      });
    }

    // Format output
    let output: string;
    if (isPretty) {
      output = formatPretty(filteredRegistry);
    } else {
      output = formatRegistryOutput(filteredRegistry, options.format);
    }

    // Write or print output
    if (options.output) {
      const { writeFileSync } = await import('fs');
      writeFileSync(options.output, output);
      if (isPretty) {
        console.log(chalk.green(`Registry written to ${options.output}`));
      }
    } else {
      console.log(output);
    }

    // Print errors and warnings
    if (errors.length > 0 && isPretty) {
      console.error(chalk.yellow('\nWarnings/Errors:'));
      for (const error of errors) {
        console.error(chalk.yellow(`  ⚠ ${error}`));
      }
    }

    if (warnings.length > 0 && options.verbose && isPretty) {
      console.error(chalk.gray('\nWarnings:'));
      for (const warning of warnings) {
        console.error(chalk.gray(`  • ${warning}`));
      }
    }

    process.exit(0);
  } catch (error) {
    if (isPretty) {
      console.error(
        chalk.red(`\nError: ${error instanceof Error ? error.message : 'Unknown error'}`)
      );
    } else {
      console.log(
        JSON.stringify(
          {
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          },
          null,
          2
        )
      );
    }
    process.exit(1);
  }
}

main();
