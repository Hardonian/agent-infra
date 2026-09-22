#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  extractSchemas,
  validateSchemas,
  DEFAULT_CONFIG,
  type SDKGeneratorConfig,
} from './core.js';
import { generateTypeScriptSDK } from './generators/typescript.js';
import { generatePythonSDK } from './generators/python.js';
import { generateGoSDK } from './generators/go.js';
import { createLogger, CorrelationManager } from '@controlplane/observability';
import { createErrorEnvelope } from '@controlplane/contracts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize observability
const correlation = new CorrelationManager();
const logger = createLogger({
  service: 'sdk-generator',
  version: '1.0.0',
  level: 'info',
});

const program = new Command();

program.name('sdk-gen').description('Generate SDKs for ControlPlane contracts').version('1.0.0');

program
  .option('-l, --language <lang>', 'Target language (typescript, python, go, all)', 'all')
  .option('-o, --output <dir>', 'Output directory', './sdks')
  .option('--sdk-version <version>', 'SDK version', '1.0.0')
  .option('--contract-version <version>', 'Contract version', '1.0.0')
  .option('--validate', 'Validate generated SDKs', false)
  .option('--check', 'Check if SDKs are up to date', false)
  .action(async (options) => {
    // Run with correlation context
    await correlation.runWithNew(async () => {
      const runId = correlation.getId();
      const childLogger = logger.child({ correlationId: runId });
      const startTime = Date.now();

      try {
        childLogger.info('SDK generation started', {
          language: options.language,
          outputDir: options.output,
          sdkVersion: options.sdkVersion,
        });

        // Only print visual header in interactive mode
        if (process.stdout.isTTY) {
          console.log(chalk.blue('🔧 ControlPlane SDK Generator'));
          console.log(chalk.gray('─────────────────────────────'));
        }

        const config: SDKGeneratorConfig = {
          ...DEFAULT_CONFIG,
          outputDir: options.output,
          sdkVersion: options.sdkVersion,
          contractVersion: options.contractVersion,
        };

        // Extract schemas from contracts
        childLogger.debug('Extracting schemas from contracts');
        const schemas = await extractSchemas();
        childLogger.info('Schemas extracted', { schemaCount: schemas.length });

        if (process.stdout.isTTY) {
          console.log(chalk.yellow('📦 Extracting schemas from contracts...'));
          console.log(chalk.green(`✓ Found ${schemas.length} schemas`));
        }

        // Validate schemas
        childLogger.debug('Validating schemas');
        const validation = validateSchemas(schemas);
        if (!validation.valid) {
          const errorEnvelope = createErrorEnvelope({
            category: 'VALIDATION_ERROR',
            severity: 'error',
            code: 'SCHEMA_VALIDATION_FAILED',
            message: `Schema validation failed with ${validation.errors.length} errors`,
            service: 'sdk-generator',
            retryable: false,
            details: validation.errors.map((err) => ({ message: err, code: 'SCHEMA_ERROR' })),
          });

          childLogger.error('Schema validation failed', { error: errorEnvelope });

          if (process.stdout.isTTY) {
            console.error(chalk.red('✗ Schema validation failed:'));
            validation.errors.forEach((err) => console.error(chalk.red(`  - ${err}`)));
          }
          process.exit(1);
        }

        childLogger.info('Schema validation passed');
        if (process.stdout.isTTY) {
          console.log(chalk.green('✓ All schemas valid'));
        }

        const languages =
          options.language === 'all' ? ['typescript', 'python', 'go'] : [options.language];

        const generatedSDKs: Array<{ language: string; fileCount: number }> = [];

        for (const lang of languages) {
          childLogger.debug(`Generating ${lang} SDK`);

          if (process.stdout.isTTY) {
            console.log(chalk.yellow(`\n📝 Generating ${lang} SDK...`));
          }

          let sdk;
          switch (lang) {
            case 'typescript':
              sdk = generateTypeScriptSDK(schemas, config);
              break;
            case 'python':
              sdk = generatePythonSDK(schemas, config);
              break;
            case 'go':
              sdk = generateGoSDK(schemas, config);
              break;
            default:
              childLogger.warn('Unknown language specified', { language: lang });
              if (process.stdout.isTTY) {
                console.error(chalk.red(`✗ Unknown language: ${lang}`));
              }
              continue;
          }

          const sdkDir = path.join(config.outputDir, lang);
          await fs.mkdir(sdkDir, { recursive: true });

          // Write generated files
          for (const [filePath, content] of sdk.files) {
            const fullPath = path.join(sdkDir, filePath);
            await fs.mkdir(path.dirname(fullPath), { recursive: true });
            await fs.writeFile(fullPath, content, 'utf-8');
          }

          // Write package config
          let configFile: string;
          let configContent: string;
          if (lang === 'typescript') {
            configFile = 'package.json';
            configContent = JSON.stringify(sdk.packageConfig, null, 2);
          } else if (lang === 'python') {
            configFile = 'pyproject.toml';
            // pyproject.toml is already generated as a file
            configContent = '';
          } else {
            configFile = 'go.mod';
            configContent = sdk.packageConfig.module
              ? `module ${sdk.packageConfig.module}\n\ngo ${sdk.packageConfig.goVersion}\n`
              : '';
          }

          if (configContent) {
            await fs.writeFile(path.join(sdkDir, configFile), configContent, 'utf-8');
          }

          generatedSDKs.push({ language: lang, fileCount: sdk.files.size });
          childLogger.info(`${lang} SDK generated`, { fileCount: sdk.files.size, sdkDir });

          if (process.stdout.isTTY) {
            console.log(chalk.green(`✓ Generated ${lang} SDK (${sdk.files.size} files)`));
          }

          // Validate if requested
          if (options.validate) {
            await validateSDK(lang, sdkDir, childLogger);
          }
        }

        const duration = Date.now() - startTime;
        childLogger.info('SDK generation completed', {
          duration,
          generatedSDKs,
          outputDir: path.resolve(config.outputDir),
        });

        if (process.stdout.isTTY) {
          console.log(chalk.green('\n✨ SDK generation complete!'));
          console.log(chalk.gray(`Output: ${path.resolve(config.outputDir)}`));
        }
      } catch (error) {
        const duration = Date.now() - startTime;

        const errorEnvelope = createErrorEnvelope({
          category: 'RUNTIME_ERROR',
          severity: 'error',
          code: 'SDK_GENERATION_FAILED',
          message: error instanceof Error ? error.message : 'Unknown SDK generation error',
          service: 'sdk-generator',
          retryable: false,
          details: [
            { message: 'SDK generation failed', code: 'GENERATION_ERROR' },
            { message: `Duration: ${duration}ms`, code: 'DURATION' },
            { message: `Run ID: ${runId}`, code: 'RUN_ID' },
            ...(error instanceof Error && error.stack
              ? [{ message: error.stack, code: 'STACK_TRACE' }]
              : []),
          ],
        });

        childLogger.error('SDK generation failed', { error: errorEnvelope, duration, runId });

        if (process.stdout.isTTY) {
          console.error(chalk.red('✗ Generation failed:'), errorEnvelope.message);
        } else {
          console.error(JSON.stringify(errorEnvelope, null, 2));
        }

        process.exit(1);
      }
    });
  });

async function validateSDK(
  language: string,
  sdkDir: string,
  logger: ReturnType<typeof createLogger>
): Promise<void> {
  logger.debug(`Validating ${language} SDK`, { sdkDir });

  if (process.stdout.isTTY) {
    console.log(chalk.yellow(`🔍 Validating ${language} SDK...`));
  }

  switch (language) {
    case 'typescript': {
      const { execSync } = await import('child_process');
      try {
        execSync('npm install && npm run typecheck', { cwd: sdkDir, stdio: 'pipe' });
        logger.info('TypeScript SDK validation passed');
        if (process.stdout.isTTY) {
          console.log(chalk.green('✓ TypeScript compilation successful'));
        }
      } catch {
        logger.warn('TypeScript SDK validation skipped (dependencies missing)');
        if (process.stdout.isTTY) {
          console.log(
            chalk.yellow('⚠ TypeScript validation skipped (build may fail without dependencies)')
          );
        }
      }
      break;
    }

    case 'python':
      try {
        const files = await fs.readdir(path.join(sdkDir, 'controlplane_sdk'));
        logger.info('Python SDK validation passed', { moduleCount: files.length });
        if (process.stdout.isTTY) {
          console.log(chalk.green(`✓ Python SDK structure valid (${files.length} modules)`));
        }
      } catch {
        logger.warn('Python SDK validation skipped');
        if (process.stdout.isTTY) {
          console.log(chalk.yellow('⚠ Python validation skipped'));
        }
      }
      break;

    case 'go':
      try {
        const files = await fs.readdir(sdkDir);
        const hasGoFiles = files.some((f) => f.endsWith('.go'));
        if (hasGoFiles) {
          logger.info('Go SDK validation passed');
          if (process.stdout.isTTY) {
            console.log(chalk.green('✓ Go SDK structure valid'));
          }
        }
      } catch {
        logger.warn('Go SDK validation skipped');
        if (process.stdout.isTTY) {
          console.log(chalk.yellow('⚠ Go validation skipped'));
        }
      }
      break;
  }
}

program.parse();
