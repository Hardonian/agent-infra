#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { BenchmarkEngine } from '../benchmark-engine.js';
import { BenchmarkReporter } from '../reporter.js';
import type { BenchmarkSuite, BenchmarkConfig } from '../contracts/index.js';
import { writeFileSync } from 'fs';
import { createLogger, CorrelationManager } from '@controlplane/observability';
import { createErrorEnvelope } from '@controlplane/contracts';

const program = new Command();

// Initialize observability
const correlation = new CorrelationManager();
const logger = createLogger({
  service: 'cp-benchmark',
  version: '1.0.0',
  level: 'info',
});

const SUITE_OPTIONS: BenchmarkConfig['suite'][] = [
  'throughput',
  'latency',
  'truthcore',
  'runner',
  'contract',
  'queue',
  'health',
  'all',
];
const FORMAT_OPTIONS = ['json', 'table', 'markdown'] as const;

type BenchmarkCliOptions = {
  suite: string;
  duration: string;
  concurrency: string;
  warmup: string;
  truthcore: string;
  jobforge: string;
  runner: string;
  format: string;
  output?: string;
  verbose: boolean;
  targetRps?: string;
  iterations?: string;
  percentileMode?: string;
  percentileThreshold?: string;
  percentileBins?: string;
  httpConcurrency?: string;
  httpBatchSize?: string;
  thresholdErrorRate?: string;
  thresholdMaxLatency?: string;
  thresholdMinThroughput?: string;
};

program
  .name('cp-benchmark')
  .description('ControlPlane Performance Benchmark Suite')
  .version('1.0.0');

program
  .option(
    '-s, --suite <type>',
    'Benchmark suite to run (throughput|latency|truthcore|runner|contract|queue|health|all)',
    'all'
  )
  .option('-d, --duration <ms>', 'Benchmark duration in milliseconds', '30000')
  .option('-c, --concurrency <n>', 'Number of concurrent workers', '10')
  .option('-w, --warmup <ms>', 'Warmup duration in milliseconds', '5000')
  .option('--truthcore <url>', 'TruthCore URL', 'http://localhost:3001')
  .option('--jobforge <url>', 'JobForge URL', 'http://localhost:3002')
  .option('--runner <url>', 'Runner URL', 'http://localhost:3003')
  .option('-f, --format <format>', 'Output format (json|table|markdown)', 'table')
  .option('-o, --output <path>', 'Output file path (optional)')
  .option('-v, --verbose', 'Verbose output', false)
  .option('--target-rps <rps>', 'Target requests per second (optional)')
  .option('--iterations <n>', 'Number of iterations for contract validation', '10000')
  .option('--percentile-mode <mode>', 'Percentile calculation mode (exact|histogram)', 'exact')
  .option(
    '--percentile-threshold <n>',
    'Sample threshold for approximate percentiles (default 10000)'
  )
  .option('--percentile-bins <n>', 'Histogram bin count for approximate percentiles (default 200)')
  .option(
    '--http-concurrency <n>',
    'Maximum in-flight HTTP requests for health/queue runners (default: concurrency)'
  )
  .option('--http-batch-size <n>', 'HTTP request batch size for health/queue runners', '1')
  .option('--threshold-error-rate <rate>', 'Maximum acceptable error rate (0-1)', '0.05')
  .option('--threshold-max-latency <ms>', 'Maximum acceptable latency in ms')
  .option('--threshold-min-throughput <rps>', 'Minimum acceptable throughput')
  .action(async (options: BenchmarkCliOptions) => {
    // Run with correlation context for tracing
    correlation.runWithNew(async () => {
      const runId = correlation.getId();
      const childLogger = logger.child({ correlationId: runId });

      const startTime = Date.now();

      try {
        childLogger.info('Benchmark suite started', {
          suite: options.suite,
          duration: options.duration,
          concurrency: options.concurrency,
          runId,
        });

        // Only print visual header in non-JSON mode
        if (options.format !== 'json') {
          console.log(chalk.bold.blue('\n🏃 ControlPlane Benchmark Suite\n'));
        }

        const suite = SUITE_OPTIONS.includes(options.suite as BenchmarkConfig['suite'])
          ? (options.suite as BenchmarkConfig['suite'])
          : 'all';
        const format = FORMAT_OPTIONS.includes(options.format as (typeof FORMAT_OPTIONS)[number])
          ? (options.format as (typeof FORMAT_OPTIONS)[number])
          : 'table';

        const config = createBenchmarkConfig(options);
        const suiteConfig = createBenchmarkSuite(suite, config, {
          truthcore: options.truthcore,
          jobforge: options.jobforge,
          runner: options.runner,
        });

        childLogger.debug('Benchmark configuration created', {
          suite,
          configCount: suiteConfig.configs.length,
        });

        const engine = new BenchmarkEngine({
          truthcoreUrl: options.truthcore,
          jobforgeUrl: options.jobforge,
          runnerUrl: options.runner,
          verbose: options.verbose,
        });

        const report = await engine.runSuite(suiteConfig);

        const duration = Date.now() - startTime;

        childLogger.info('Benchmark suite completed', {
          suite,
          duration,
          totalTests: report.summary.total,
          passedTests: report.summary.passed,
          failedTests: report.summary.failed,
        });

        const reporter = new BenchmarkReporter(format);
        const output = reporter.report(report);

        console.log(output);

        if (options.output) {
          writeFileSync(options.output, JSON.stringify(report, null, 2));
          childLogger.info('Report saved to file', { outputPath: options.output });

          if (format !== 'json') {
            console.log(chalk.green(`\n✅ Report saved to: ${options.output}\n`));
          }
        }

        const exitCode = report.summary.failed > 0 ? 1 : 0;

        childLogger.info('Benchmark exiting', { exitCode, duration });
        process.exit(exitCode);
      } catch (error) {
        const duration = Date.now() - startTime;

        // Create structured error envelope
        const errorEnvelope = createErrorEnvelope({
          category: 'RUNTIME_ERROR',
          severity: 'error',
          code: 'BENCHMARK_FAILED',
          message: error instanceof Error ? error.message : 'Unknown benchmark error',
          service: 'cp-benchmark',
          retryable: false,
          details: [
            { message: 'Benchmark execution failed', code: 'EXECUTION_ERROR' },
            { message: `Duration: ${duration}ms`, code: 'DURATION' },
            { message: `Run ID: ${runId}`, code: 'RUN_ID' },
            { message: `Suite: ${options.suite}`, code: 'SUITE' },
            ...(error instanceof Error && error.stack
              ? [{ message: error.stack, code: 'STACK_TRACE' }]
              : []),
          ],
        });

        childLogger.error('Benchmark suite failed', {
          error: errorEnvelope,
          duration,
          runId,
        });

        // Print user-friendly error in non-JSON mode
        if (options.format !== 'json') {
          console.error(chalk.red('\n❌ Benchmark failed:'), errorEnvelope.message);
          if (options.verbose && error instanceof Error && error.stack) {
            console.error(chalk.gray(error.stack));
          }
        } else {
          // Output structured error in JSON mode
          console.error(JSON.stringify(errorEnvelope, null, 2));
        }

        process.exit(1);
      }
    });
  });

function createBenchmarkConfig(options: BenchmarkCliOptions): BenchmarkConfig {
  const thresholds: BenchmarkConfig['thresholds'] = {};

  if (options.thresholdErrorRate !== undefined) {
    thresholds.maxErrorRate = parseFloat(options.thresholdErrorRate);
  }

  if (options.thresholdMaxLatency !== undefined) {
    thresholds.maxLatencyMs = parseInt(options.thresholdMaxLatency);
  }

  if (options.thresholdMinThroughput !== undefined) {
    thresholds.minThroughput = parseFloat(options.thresholdMinThroughput);
  }

  return {
    name: 'benchmark',
    description: 'ControlPlane performance benchmark',
    suite: SUITE_OPTIONS.includes(options.suite as BenchmarkConfig['suite'])
      ? (options.suite as BenchmarkConfig['suite'])
      : 'all',
    durationMs: parseInt(options.duration),
    warmupMs: parseInt(options.warmup),
    concurrency: parseInt(options.concurrency),
    targetRps: options.targetRps ? parseFloat(options.targetRps) : undefined,
    iterations: options.iterations ? parseInt(options.iterations) : undefined,
    percentiles: {
      mode: options.percentileMode === 'histogram' ? 'histogram' : 'exact',
      sampleThreshold: options.percentileThreshold ? parseInt(options.percentileThreshold) : 10_000,
      histogramBins: options.percentileBins ? parseInt(options.percentileBins) : 200,
    },
    http: {
      concurrencyLimit: options.httpConcurrency ? parseInt(options.httpConcurrency) : undefined,
      batchSize: options.httpBatchSize ? parseInt(options.httpBatchSize) : 1,
    },
    thresholds,
  };
}

function createBenchmarkSuite(
  suiteType: string,
  baseConfig: BenchmarkConfig,
  urls: { truthcore: string; jobforge: string; runner: string }
): BenchmarkSuite {
  const configs: BenchmarkConfig[] = [];

  const suiteDescriptions: Record<string, { name: string; desc: string }> = {
    throughput: {
      name: 'Job Throughput Benchmark',
      desc: 'Measures job submission and acceptance rate',
    },
    latency: {
      name: 'End-to-End Latency Benchmark',
      desc: 'Measures complete job lifecycle latency',
    },
    truthcore: {
      name: 'TruthCore Query Benchmark',
      desc: 'Measures assertion and query performance',
    },
    runner: {
      name: 'Runner Scaling Benchmark',
      desc: 'Measures runner performance at different concurrency levels',
    },
    contract: {
      name: 'Contract Validation Benchmark',
      desc: 'Measures Zod schema validation performance',
    },
    queue: {
      name: 'Queue Performance Benchmark',
      desc: 'Measures message queue enqueue/dequeue rates',
    },
    health: {
      name: 'Health Check Performance Benchmark',
      desc: 'Measures health endpoint response times',
    },
    all: {
      name: 'Complete Benchmark Suite',
      desc: 'Runs all benchmark suites',
    },
  };

  const desc = suiteDescriptions[suiteType] || suiteDescriptions.all;

  if (suiteType === 'all') {
    const suiteTypes: Array<BenchmarkConfig['suite']> = [
      'throughput',
      'latency',
      'truthcore',
      'runner',
      'contract',
      'queue',
      'health',
    ];

    for (const type of suiteTypes) {
      const typeDesc = suiteDescriptions[type];
      configs.push({
        ...baseConfig,
        suite: type,
        name: typeDesc.name,
        description: typeDesc.desc,
        durationMs: Math.floor(baseConfig.durationMs / suiteTypes.length),
      });
    }
  } else {
    configs.push({
      ...baseConfig,
      suite: suiteType as BenchmarkConfig['suite'],
      name: desc.name,
      description: desc.desc,
    });
  }

  return {
    id: crypto.randomUUID(),
    name: desc.name,
    description: desc.desc,
    configs,
    globalConfig: {
      truthcoreUrl: urls.truthcore,
      jobforgeUrl: urls.jobforge,
      runnerUrl: urls.runner,
      outputFormat: 'table',
      verbose: false,
    },
  };
}

program.parse();
