#!/usr/bin/env node
/**
 * Create Runner CLI
 *
 * Scaffold a new ControlPlane runner in 15 minutes.
 * Usage: npx @controlplane/create-runner <name> [options]
 */

import { program } from 'commander';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { mkdirSync, readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import { join, resolve } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const TEMPLATES_DIR = resolve(__dirname, '..', 'templates');
const PACKAGE_VERSION = JSON.parse(
  readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8')
).version;

program
  .name('create-runner')
  .description('Scaffold a new ControlPlane runner')
  .version(PACKAGE_VERSION)
  .argument('<name>', 'Name of the runner (e.g., my-runner)')
  .option('-t, --template <type>', 'Template type: queue-worker, http-connector', 'queue-worker')
  .option('-d, --directory <path>', 'Target directory', '.')
  .option('-i, --interactive', 'Interactive mode', false)
  .option('--skip-install', 'Skip dependency installation', false)
  .option('--skip-git', 'Skip git initialization', false)
  .action(async (name: string, options: RunnerOptions) => {
    try {
      await createRunner(name, options);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(chalk.red('Error:'), message);
      process.exit(1);
    }
  });

program.parse();

interface RunnerConfig {
  name: string;
  description: string;
  version: string;
  author: string;
  contractVersion: string;
  capabilities: string[];
}

interface RunnerOptions {
  template: string;
  directory: string;
  interactive: boolean;
  skipInstall: boolean;
  skipGit: boolean;
}

interface RunnerPromptAnswers {
  template: string;
  description: string;
  author: string;
  capabilities: string[];
}

interface TemplateContext {
  name: string;
  description: string;
  version: string;
  author: string;
  contractVersion: string;
  capabilities: string[];
}

async function createRunner(name: string, options: RunnerOptions) {
  console.log(chalk.bold.blue('\n🚀 ControlPlane Create Runner\n'));

  // Validate name
  if (!/^[a-z0-9-]+$/.test(name)) {
    throw new Error('Runner name must be lowercase alphanumeric with hyphens only');
  }

  let template = options.template;
  const targetDir = resolve(options.directory, name);
  let runnerConfig: RunnerConfig = {
    name,
    description: `${name} - A ControlPlane runner`,
    version: '1.0.0',
    author: '',
    contractVersion: '1.0.0',
    capabilities: ['execute'],
  };

  // Interactive mode
  if (options.interactive) {
    const answers = await inquirer.prompt<RunnerPromptAnswers>([
      {
        type: 'list',
        name: 'template',
        message: 'Choose a template:',
        choices: [
          { name: 'Queue Worker Runner (processes jobs from queue)', value: 'queue-worker' },
          { name: 'HTTP Connector Runner (external API integration)', value: 'http-connector' },
        ],
        default: template,
      },
      {
        type: 'input',
        name: 'description',
        message: 'Description:',
        default: runnerConfig.description,
      },
      {
        type: 'input',
        name: 'author',
        message: 'Author:',
        default: runnerConfig.author,
      },
      {
        type: 'checkbox',
        name: 'capabilities',
        message: 'Capabilities:',
        choices: [
          { name: 'execute (can execute jobs)', value: 'execute', checked: true },
          { name: 'query (can query TruthCore)', value: 'query' },
          { name: 'stream (can stream results)', value: 'stream' },
        ],
      },
    ]);

    template = answers.template;
    runnerConfig = { ...runnerConfig, ...answers };
  }

  // Validate template
  const templateDir = join(TEMPLATES_DIR, template);
  if (!existsSync(templateDir)) {
    throw new Error(`Template "${template}" not found. Available: queue-worker, http-connector`);
  }

  // Check if directory exists
  if (existsSync(targetDir)) {
    const { overwrite } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'overwrite',
        message: `Directory ${targetDir} exists. Overwrite?`,
        default: false,
      },
    ]);

    if (!overwrite) {
      console.log(chalk.yellow('Aborted.'));
      return;
    }
  }

  // Scaffold
  console.log(chalk.blue(`\n📦 Scaffolding ${template} runner: ${name}`));
  console.log(chalk.gray(`Target: ${targetDir}\n`));

  mkdirSync(targetDir, { recursive: true });

  // Copy template files
  copyTemplate(templateDir, targetDir, runnerConfig);

  // Generate additional files
  generateCapabilityMetadata(targetDir, runnerConfig);
  generateContractTests(targetDir, runnerConfig);
  generateCIWorkflow(targetDir, runnerConfig);
  generateDocs(targetDir, runnerConfig);

  console.log(chalk.green('\n✅ Runner scaffolded successfully!\n'));

  console.log(chalk.bold('Next steps:'));
  console.log(chalk.gray('  cd ') + name);

  if (!options.skipInstall) {
    console.log(chalk.gray('  pnpm install'));
  }

  console.log(chalk.gray('  pnpm run dev'));
  console.log(chalk.gray('  pnpm run test'));
  console.log(chalk.gray('  pnpm run contract:test'));

  console.log(chalk.bold('\n📚 Documentation:'));
  console.log(chalk.gray('  - README.md         Project overview and setup'));
  console.log(chalk.gray('  - docs/RUNNER.md    Detailed runner guide'));
  console.log(chalk.gray('  - CAPABILITY.md     Capability metadata'));

  console.log(chalk.bold('\n🔗 Contracts:'));
  console.log(chalk.gray('  - npm install @controlplane/contracts'));
  console.log(chalk.gray('  - npm install @controlplane/contract-test-kit'));

  console.log('');
}

function copyTemplate(src: string, dest: string, config: TemplateContext) {
  const entries = readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);

    if (entry.isDirectory()) {
      mkdirSync(destPath, { recursive: true });
      copyTemplate(srcPath, destPath, config);
    } else {
      let content = readFileSync(srcPath, 'utf8');

      // Replace placeholders
      content = content.replace(/{{name}}/g, config.name);
      content = content.replace(/{{description}}/g, config.description);
      content = content.replace(/{{version}}/g, config.version);
      content = content.replace(/{{author}}/g, config.author);
      content = content.replace(/{{contractVersion}}/g, config.contractVersion);
      content = content.replace(/{{capabilities}}/g, JSON.stringify(config.capabilities));

      // Handle special files
      if (entry.name === 'gitignore') {
        writeFileSync(join(dest, '.gitignore'), content);
      } else {
        writeFileSync(destPath, content);
      }
    }
  }
}

function generateCapabilityMetadata(targetDir: string, config: RunnerConfig) {
  const metadata = {
    name: config.name,
    version: config.version,
    description: config.description,
    capabilities: config.capabilities,
    contract: {
      version: config.contractVersion,
      min: '1.0.0',
      max: '<2.0.0',
    },
    interfaces: {
      jobExecution: true,
      healthCheck: true,
      heartbeat: true,
    },
    schemas: {
      input: './schemas/input.json',
      output: './schemas/output.json',
    },
    generatedAt: new Date().toISOString(),
  };

  writeFileSync(
    join(targetDir, 'CAPABILITY.md'),
    `# Capability Metadata: ${config.name}\n\n\`\`\`json\n${JSON.stringify(metadata, null, 2)}\n\`\`\`\n\n## Contract Compatibility\n\nThis runner is compatible with ControlPlane contracts version \`${config.contractVersion}\`.\n\n## Capabilities\n\n${config.capabilities.map((c) => `- **${c}**: ${getCapabilityDescription(c)}`).join('\n')}\n\n## Schemas\n\n- Input: [schemas/input.json](./schemas/input.json)\n- Output: [schemas/output.json](./schemas/output.json)\n\n---\n*Generated by create-runner v${PACKAGE_VERSION}*\n`
  );

  // Generate schema files
  const schemasDir = join(targetDir, 'schemas');
  mkdirSync(schemasDir, { recursive: true });

  writeFileSync(
    join(schemasDir, 'input.json'),
    JSON.stringify(
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: `${config.name} Input`,
        type: 'object',
        properties: {
          jobId: { type: 'string', format: 'uuid' },
          payload: { type: 'object' },
        },
        required: ['jobId'],
      },
      null,
      2
    )
  );

  writeFileSync(
    join(schemasDir, 'output.json'),
    JSON.stringify(
      {
        $schema: 'http://json-schema.org/draft-07/schema#',
        title: `${config.name} Output`,
        type: 'object',
        properties: {
          jobId: { type: 'string', format: 'uuid' },
          status: { type: 'string', enum: ['success', 'failure'] },
          result: { type: 'object' },
          error: { type: 'object' },
        },
        required: ['jobId', 'status'],
      },
      null,
      2
    )
  );
}

function generateContractTests(targetDir: string, config: RunnerConfig) {
  const testsDir = join(targetDir, 'test');
  mkdirSync(testsDir, { recursive: true });

  const testContent = `import { describe, it, expect } from 'vitest';
import { 
  JobRequest, 
  RunnerCapability, 
  HealthCheck,
  CONTRACT_VERSION_CURRENT 
} from '@controlplane/contracts';

describe('${config.name} Contract Tests', () => {
  describe('JobRequest Schema', () => {
    it('validates valid job request', () => {
      const valid = {
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        type: 'test-job',
        payload: { test: true },
        priority: 1,
        maxRetries: 3,
        timeout: 60000,
        createdAt: new Date().toISOString(),
        contractVersion: CONTRACT_VERSION_CURRENT,
      };
      
      const result = JobRequest.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('RunnerCapability Schema', () => {
    it('validates runner capability metadata', () => {
      const capability = {
        id: '550e8400-e29b-41d4-a716-446655440000',
        name: '${config.name}',
        version: '${config.version}',
        supportedJobTypes: ['test-job'],
        maxConcurrentJobs: 10,
        features: ${JSON.stringify(config.capabilities)},
        contractVersion: CONTRACT_VERSION_CURRENT,
      };
      
      const result = RunnerCapability.safeParse(capability);
      expect(result.success).toBe(true);
    });
  });

  describe('HealthCheck Schema', () => {
    it('validates health check response', () => {
      const health = {
        service: '${config.name}',
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '${config.version}',
        uptime: 12345,
        checks: [
          {
            name: 'queue-connection',
            status: 'healthy',
            responseTimeMs: 50,
          },
        ],
      };
      
      const result = HealthCheck.safeParse(health);
      expect(result.success).toBe(true);
    });
  });
});
`;

  writeFileSync(join(testsDir, 'contract.test.ts'), testContent);
}

function generateCIWorkflow(targetDir: string, _config: RunnerConfig) {
  const workflowsDir = join(targetDir, '.github', 'workflows');
  mkdirSync(workflowsDir, { recursive: true });

  const workflow = `name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  test:
    name: Test
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup pnpm
        uses: pnpm/action-setup@d882d12c64e032187b2edb46d3a0d003b7a43598 # v2.4.0
        with:
          version: 8.12.0

      - name: Setup Node.js
        uses: actions/setup-node@b357bbe22bb6e5c4766654a3233a9d348ebeb38a # v4.0.0
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Run linter
        run: pnpm run lint

      - name: Run type check
        run: pnpm run typecheck

      - name: Run tests
        run: pnpm run test

      - name: Run contract tests
        run: pnpm run contract:test

  compatibility:
    name: Contract Compatibility
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1

      - name: Setup pnpm
        uses: pnpm/action-setup@d882d12c64e032187b2edb46d3a0d003b7a43598 # v2.4.0
        with:
          version: 8.12.0

      - name: Setup Node.js
        uses: actions/setup-node@b357bbe22bb6e5c4766654a3233a9d348ebeb38a # v4.0.0
        with:
          node-version: '20'
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Check contract compatibility
        run: pnpm exec contract-test --strict
`;

  writeFileSync(join(workflowsDir, 'ci.yml'), workflow);
}

function generateDocs(targetDir: string, config: RunnerConfig) {
  const docsDir = join(targetDir, 'docs');
  mkdirSync(docsDir, { recursive: true });

  const runnerDoc = `# ${config.name} Runner Guide

## Overview

${config.description}

## Quick Start

### 1. Install Dependencies

\`\`\`bash
pnpm install
\`\`\`

### 2. Configure Environment

Copy \`.env.example\` to \`.env\` and configure:

\`\`\`bash
cp .env.example .env
# Edit .env with your settings
\`\`\`

### 3. Run Development Server

\`\`\`bash
pnpm run dev
\`\`\`

### 4. Run Tests

\`\`\`bash
pnpm run test
pnpm run contract:test
\`\`\`

## Contract Testing

This runner uses the ControlPlane contract test kit. Run contract tests:

\`\`\`bash
pnpm run contract:test
\`\`\`

For CI integration, see [Contract Test Kit Documentation](https://github.com/Hardonian/ControlPlane/tree/main/packages/contract-test-kit).

## Integration with ControlPlane

### Register with JobForge

\`\`\`typescript
import { RunnerRegistrationRequest } from '@controlplane/contracts';

const registration = RunnerRegistrationRequest.parse({
  id: 'your-runner-id',
  name: '${config.name}',
  version: '${config.version}',
  supportedJobTypes: ['your-job-type'],
  maxConcurrentJobs: 5,
  endpoint: 'http://localhost:3000',
  features: ${JSON.stringify(config.capabilities)},
});
\`\`\`

### Health Checks

The runner exposes a health endpoint at \`GET /health\`:

\`\`\`bash
curl http://localhost:3000/health
\`\`\`

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| \`PORT\` | HTTP server port | 3000 |
| \`JOBFORGE_URL\` | JobForge API URL | http://localhost:8080 |
| \`TRUTHCORE_URL\` | TruthCore API URL | http://localhost:8081 |
| \`LOG_LEVEL\` | Logging level | info |

## Deployment

See [Deployment Guide](https://github.com/Hardonian/ControlPlane/blob/main/docs/DEPLOYMENT.md)

## Support

- [ControlPlane Documentation](https://github.com/Hardonian/ControlPlane/tree/main/docs)
- [Contract Test Kit](https://github.com/Hardonian/ControlPlane/tree/main/packages/contract-test-kit)
- [Issue Tracker](https://github.com/Hardonian/ControlPlane/issues)
`;

  writeFileSync(join(docsDir, 'RUNNER.md'), runnerDoc);
}

function getCapabilityDescription(capability: string) {
  const descriptions = {
    execute: 'Can execute jobs from the queue',
    query: 'Can query TruthCore for data',
    stream: 'Can stream real-time results',
  };
  return descriptions[capability as keyof typeof descriptions] || capability;
}
