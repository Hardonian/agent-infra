#!/usr/bin/env node

import {
  runAllContractTestsDetailed,
  PredefinedTestSuites,
  type ContractTestResultDetail,
} from './index.js';
import chalk from 'chalk';
import { createLogger, CorrelationManager } from '@controlplane/observability';
import { createErrorEnvelope } from '@controlplane/contracts';

// Initialize observability
const correlation = new CorrelationManager();
const logger = createLogger({
  service: 'contract-test-kit',
  version: '1.0.0',
  level: 'info',
});

interface CLIOptions {
  format: 'pretty' | 'json' | 'junit';
  verbose: boolean;
  exitOnFailure: boolean;
}

function parseArgs(): CLIOptions {
  const args = process.argv.slice(2);

  return {
    format: args.includes('--json') ? 'json' : args.includes('--junit') ? 'junit' : 'pretty',
    verbose: args.includes('--verbose') || args.includes('-v'),
    exitOnFailure: !args.includes('--no-exit-code'),
  };
}

function formatPretty(
  result: {
    passed: number;
    failed: number;
    details: string[];
    results: ContractTestResultDetail[];
  },
  verbose: boolean
): string {
  let output = '\n';
  output += chalk.bold.blue('╔══════════════════════════════════════════════════════════╗\n');
  output += chalk.bold.blue('║      ControlPlane Contract Test Results                 ║\n');
  output += chalk.bold.blue('╚══════════════════════════════════════════════════════════╝\n\n');

  const resultsBySuite = new Map<string, Map<string, ContractTestResultDetail>>();
  for (const detail of result.results) {
    if (!resultsBySuite.has(detail.suiteName)) {
      resultsBySuite.set(detail.suiteName, new Map());
    }
    resultsBySuite.get(detail.suiteName)?.set(detail.testName, detail);
  }

  for (const suite of PredefinedTestSuites) {
    output += chalk.bold.white(`${suite.name}\n`);
    output += chalk.gray('─'.repeat(50)) + '\n';

    for (const test of suite.tests) {
      const detail = resultsBySuite.get(suite.name)?.get(test.name);
      const actualValid = detail?.actualValid ?? false;
      const errors = detail?.errors ?? [];
      const success = actualValid === test.expectedValid;

      if (success) {
        output += chalk.green(`  ✓ ${test.name}\n`);
      } else {
        output += chalk.red(`  ✗ ${test.name}\n`);
        output += chalk.red(`    Expected: ${test.expectedValid ? 'valid' : 'invalid'}\n`);
        output += chalk.red(`    Actual: ${actualValid ? 'valid' : 'invalid'}\n`);
      }

      if (verbose && !success && errors.length > 0) {
        for (const error of errors) {
          output += chalk.yellow(`    - ${error.path}: ${error.message}\n`);
        }
      }
    }
    output += '\n';
  }

  output += chalk.gray('─'.repeat(50)) + '\n';
  output += chalk.bold('Summary:\n');
  output += chalk.green(`  ✓ Passed: ${result.passed}\n`);
  output +=
    result.failed > 0
      ? chalk.red(`  ✗ Failed: ${result.failed}\n`)
      : chalk.gray(`  ✗ Failed: ${result.failed}\n`);
  output += '\n';

  if (result.failed === 0) {
    output += chalk.bold.green('All contract tests passed! ✓\n');
  } else {
    output += chalk.bold.red(`${result.failed} contract test(s) failed.\n`);
  }

  return output;
}

function formatJSON(
  result: { passed: number; failed: number; details: string[] },
  runId: string
): string {
  return JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      runId,
      total: result.passed + result.failed,
      passed: result.passed,
      failed: result.failed,
      success: result.failed === 0,
      details: result.details,
    },
    null,
    2
  );
}

function formatJUnit(
  result: { passed: number; failed: number; details: string[] },
  runId: string
): string {
  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += `<testsuite name="Contract Tests" tests="${result.passed + result.failed}" failures="${result.failed}" timestamp="${new Date().toISOString()}" runId="${runId}">\n`;

  for (const detail of result.details) {
    const [name, counts] = detail.split(':');
    xml += `  <testcase name="${name.trim()}" classname="ContractTest">\n`;
    xml += `    <system-out>${counts.trim()}</system-out>\n`;
    xml += `  </testcase>\n`;
  }

  xml += '</testsuite>\n';
  return xml;
}

async function main() {
  // Run with correlation context
  return correlation.runWithNew(async () => {
    const runId = correlation.getId() ?? crypto.randomUUID();
    const childLogger = logger.child({ correlationId: runId });
    const startTime = Date.now();

    try {
      const options = parseArgs();

      childLogger.info('Contract tests started', {
        format: options.format,
        verbose: options.verbose,
      });

      if (process.stdout.isTTY && options.format === 'pretty') {
        console.error(chalk.gray('Running ControlPlane contract tests...\n'));
      }

      const detailedResult = runAllContractTestsDetailed();
      const result = {
        passed: detailedResult.passed,
        failed: detailedResult.failed,
        details: detailedResult.details,
      };

      const duration = Date.now() - startTime;

      childLogger.info('Contract tests completed', {
        total: result.passed + result.failed,
        passed: result.passed,
        failed: result.failed,
        duration,
        success: result.failed === 0,
      });

      let output: string;
      switch (options.format) {
        case 'json':
          output = formatJSON(result, runId);
          break;
        case 'junit':
          output = formatJUnit(result, runId);
          break;
        case 'pretty':
        default:
          output = formatPretty(detailedResult, options.verbose);
          break;
      }

      console.log(output);

      if (options.exitOnFailure && result.failed > 0) {
        process.exit(1);
      }

      process.exit(0);
    } catch (error) {
      const duration = Date.now() - startTime;

      const errorEnvelope = createErrorEnvelope({
        category: 'RUNTIME_ERROR',
        severity: 'error',
        code: 'CONTRACT_TEST_FAILED',
        message: error instanceof Error ? error.message : 'Unknown contract test error',
        service: 'contract-test-kit',
        retryable: false,
        details: [
          { message: 'Contract test execution failed', code: 'EXECUTION_ERROR' },
          { message: `Duration: ${duration}ms`, code: 'DURATION' },
          { message: `Run ID: ${runId}`, code: 'RUN_ID' },
          ...(error instanceof Error && error.stack
            ? [{ message: error.stack, code: 'STACK_TRACE' }]
            : []),
        ],
      });

      childLogger.error('Contract test execution failed', {
        error: errorEnvelope,
        duration,
        runId,
      });

      if (process.stdout.isTTY) {
        console.error(chalk.red(`Error: ${errorEnvelope.message}`));
      } else {
        console.error(JSON.stringify(errorEnvelope, null, 2));
      }

      process.exit(2);
    }
  });
}

main();
