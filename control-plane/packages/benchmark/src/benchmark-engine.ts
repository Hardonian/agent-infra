import type {
  BenchmarkSuite,
  BenchmarkConfig,
  BenchmarkResult,
  BenchmarkReport,
} from './contracts/index.js';
import {
  JobThroughputRunner,
  EndToEndLatencyRunner,
  TruthCoreQueryRunner,
  RunnerScalingRunner,
  ContractValidationRunner,
  QueuePerformanceRunner,
  HealthCheckPerformanceRunner,
  type BenchmarkContext,
} from './runners/index.js';
import os from 'os';

export class BenchmarkEngine {
  private context: BenchmarkContext;

  constructor(context: Partial<BenchmarkContext> = {}) {
    this.context = {
      truthcoreUrl: context.truthcoreUrl || 'http://localhost:3001',
      jobforgeUrl: context.jobforgeUrl || 'http://localhost:3002',
      runnerUrl: context.runnerUrl || 'http://localhost:3003',
      verbose: context.verbose || false,
    };
  }

  async runSuite(suite: BenchmarkSuite): Promise<BenchmarkReport> {
    const startTime = Date.now();

    console.log(`\n🏃 Starting Benchmark Suite: ${suite.name}`);
    console.log(`Description: ${suite.description}`);
    console.log(
      `Environment: JobForge=${this.context.jobforgeUrl}, TruthCore=${this.context.truthcoreUrl}, Runner=${this.context.runnerUrl}`
    );
    console.log(`Configs: ${suite.configs.length} benchmark(s)\n`);

    const results: BenchmarkResult[] = [];

    for (const config of suite.configs) {
      const result = await this.runBenchmark(config);
      results.push(result);

      if (result.status === 'failed') {
        console.log(`❌ Benchmark "${config.name}" FAILED`);
      } else if (result.status === 'skipped') {
        console.log(`⏭️ Benchmark "${config.name}" SKIPPED`);
      } else {
        console.log(`✅ Benchmark "${config.name}" PASSED`);
      }

      console.log();
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    const report: BenchmarkReport = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      environment: {
        nodeVersion: process.version,
        platform: process.platform,
        arch: process.arch,
        cpus: os.cpus().length,
        totalMemoryMb: Math.floor(os.totalmem() / 1024 / 1024),
      },
      suite,
      results,
      summary: {
        total: results.length,
        passed: results.filter((r) => r.status === 'passed').length,
        failed: results.filter((r) => r.status === 'failed').length,
        skipped: results.filter((r) => r.status === 'skipped').length,
        totalDurationMs: totalDuration,
      },
    };

    return report;
  }

  private async runBenchmark(config: BenchmarkConfig): Promise<BenchmarkResult> {
    try {
      switch (config.suite) {
        case 'throughput': {
          const runner = new JobThroughputRunner(this.context);
          return await runner.run(config);
        }
        case 'latency': {
          const runner = new EndToEndLatencyRunner(this.context);
          return await runner.run(config);
        }
        case 'truthcore': {
          const runner = new TruthCoreQueryRunner(this.context);
          return await runner.run(config);
        }
        case 'runner': {
          const runner = new RunnerScalingRunner(this.context);
          return await runner.run(config);
        }
        case 'contract': {
          const runner = new ContractValidationRunner(this.context);
          return await runner.run(config);
        }
        case 'queue': {
          const runner = new QueuePerformanceRunner(this.context);
          return await runner.run(config);
        }
        case 'health': {
          const runner = new HealthCheckPerformanceRunner(this.context);
          return await runner.run(config);
        }
        case 'all': {
          return await this.runAllBenchmarks(config);
        }
        default: {
          return this.createErrorResult(config, `Unknown benchmark suite: ${config.suite}`);
        }
      }
    } catch (error) {
      return this.createErrorResult(config, error instanceof Error ? error.message : String(error));
    }
  }

  private async runAllBenchmarks(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    const suites: Array<BenchmarkConfig['suite']> = [
      'throughput',
      'latency',
      'truthcore',
      'runner',
      'contract',
      'queue',
      'health',
    ];

    const allResults: BenchmarkResult[] = [];

    for (const suite of suites) {
      if (suite === 'all') continue;

      const suiteConfig: BenchmarkConfig = {
        ...config,
        suite,
        name: `${config.name}-${suite}`,
        durationMs: Math.floor(config.durationMs / suites.length),
      };

      const result = await this.runBenchmark(suiteConfig);
      allResults.push(result);
    }

    const endTimestamp = Date.now();
    const endTime = new Date().toISOString();
    const duration = endTimestamp - startTimestamp;

    const allMetrics: BenchmarkResult['metrics'] = [];
    for (const result of allResults) {
      allMetrics.push(...result.metrics);
    }

    const failedCount = allResults.filter((r) => r.status === 'failed').length;
    const status: 'passed' | 'failed' | 'skipped' = failedCount > 0 ? 'failed' : 'passed';

    return {
      id: crypto.randomUUID(),
      name: config.name,
      description: config.description,
      suite: 'all',
      status,
      durationMs: duration,
      startTime,
      endTime,
      metrics: allMetrics,
      metadata: {
        subBenchmarks: allResults.map((r) => ({
          name: r.name,
          status: r.status,
          durationMs: r.durationMs,
        })),
      },
    };
  }

  private createErrorResult(config: BenchmarkConfig, error: string): BenchmarkResult {
    const now = new Date().toISOString();
    return {
      id: crypto.randomUUID(),
      name: config.name,
      description: config.description,
      suite: config.suite,
      status: 'failed',
      durationMs: 0,
      startTime: now,
      endTime: now,
      metrics: [],
      error,
      metadata: {},
    };
  }
}
