import { test, expect } from '@playwright/test';
import { BenchmarkEngine } from '@controlplane/benchmark';
import type { BenchmarkSuite, BenchmarkConfig } from '@controlplane/benchmark';

const TRUTHCORE_URL = process.env.TRUTHCORE_URL || 'http://localhost:3001';
const JOBFORGE_URL = process.env.JOBFORGE_URL || 'http://localhost:3002';
const RUNNER_URL = process.env.RUNNER_URL || 'http://localhost:3003';

test.describe('Performance Benchmarks', () => {
  test('job throughput benchmark', async () => {
    const config: BenchmarkConfig = {
      name: 'Job Throughput Test',
      description: 'Test job submission throughput',
      suite: 'throughput',
      durationMs: 10000,
      warmupMs: 2000,
      concurrency: 5,
      thresholds: {
        minThroughput: 10,
        maxErrorRate: 0.05,
      },
    };

    const suite: BenchmarkSuite = {
      id: crypto.randomUUID(),
      name: 'Throughput Suite',
      description: 'Job throughput test suite',
      configs: [config],
      globalConfig: {
        truthcoreUrl: TRUTHCORE_URL,
        jobforgeUrl: JOBFORGE_URL,
        runnerUrl: RUNNER_URL,
        outputFormat: 'table',
        verbose: false,
      },
    };

    const engine = new BenchmarkEngine({
      truthcoreUrl: TRUTHCORE_URL,
      jobforgeUrl: JOBFORGE_URL,
      runnerUrl: RUNNER_URL,
    });

    const report = await engine.runSuite(suite);

    expect(report.summary.failed).toBe(0);
    expect(report.results[0].metrics.some((m) => m.name === 'jobs_per_second')).toBe(true);

    const jobsPerSecond = report.results[0].metrics.find((m) => m.name === 'jobs_per_second');
    if (jobsPerSecond) {
      expect(jobsPerSecond.value).toBeGreaterThan(0);
    }
  });

  test('end-to-end latency benchmark', async () => {
    const config: BenchmarkConfig = {
      name: 'E2E Latency Test',
      description: 'Test end-to-end job execution latency',
      suite: 'latency',
      durationMs: 15000,
      warmupMs: 3000,
      concurrency: 3,
      thresholds: {
        maxLatencyMs: 5000,
        maxErrorRate: 0.1,
      },
    };

    const suite: BenchmarkSuite = {
      id: crypto.randomUUID(),
      name: 'Latency Suite',
      description: 'End-to-end latency test suite',
      configs: [config],
      globalConfig: {
        truthcoreUrl: TRUTHCORE_URL,
        jobforgeUrl: JOBFORGE_URL,
        runnerUrl: RUNNER_URL,
        outputFormat: 'table',
        verbose: false,
      },
    };

    const engine = new BenchmarkEngine({
      truthcoreUrl: TRUTHCORE_URL,
      jobforgeUrl: JOBFORGE_URL,
      runnerUrl: RUNNER_URL,
    });

    const report = await engine.runSuite(suite);

    expect(report.summary.failed).toBe(0);

    const avgLatency = report.results[0].metrics.find((m) => m.name === 'avg_total_latency');
    if (avgLatency) {
      expect(avgLatency.value).toBeGreaterThan(0);
    }
  });

  test('health check performance benchmark', async () => {
    const config: BenchmarkConfig = {
      name: 'Health Check Performance Test',
      description: 'Test health endpoint response times',
      suite: 'health',
      durationMs: 5000,
      warmupMs: 1000,
      concurrency: 5,
      thresholds: {
        maxLatencyMs: 100,
        maxErrorRate: 0.01,
      },
    };

    const suite: BenchmarkSuite = {
      id: crypto.randomUUID(),
      name: 'Health Suite',
      description: 'Health check performance test suite',
      configs: [config],
      globalConfig: {
        truthcoreUrl: TRUTHCORE_URL,
        jobforgeUrl: JOBFORGE_URL,
        runnerUrl: RUNNER_URL,
        outputFormat: 'table',
        verbose: false,
      },
    };

    const engine = new BenchmarkEngine({
      truthcoreUrl: TRUTHCORE_URL,
      jobforgeUrl: JOBFORGE_URL,
      runnerUrl: RUNNER_URL,
    });

    const report = await engine.runSuite(suite);

    expect(report.summary.failed).toBe(0);
    expect(report.results[0].metrics.some((m) => m.name.includes('avg_latency'))).toBe(true);

    const overallHealthRate = report.results[0].metrics.find(
      (m) => m.name === 'overall_health_rate'
    );
    if (overallHealthRate) {
      expect(overallHealthRate.value).toBeGreaterThan(95);
    }
  });

  test('contract validation performance', async () => {
    const config: BenchmarkConfig = {
      name: 'Contract Validation Test',
      description: 'Test Zod schema validation performance',
      suite: 'contract',
      durationMs: 5000,
      warmupMs: 1000,
      concurrency: 1,
      iterations: 5000,
    };

    const suite: BenchmarkSuite = {
      id: crypto.randomUUID(),
      name: 'Contract Suite',
      description: 'Contract validation performance test',
      configs: [config],
      globalConfig: {
        truthcoreUrl: TRUTHCORE_URL,
        jobforgeUrl: JOBFORGE_URL,
        runnerUrl: RUNNER_URL,
        outputFormat: 'table',
        verbose: false,
      },
    };

    const engine = new BenchmarkEngine({
      truthcoreUrl: TRUTHCORE_URL,
      jobforgeUrl: JOBFORGE_URL,
      runnerUrl: RUNNER_URL,
    });

    const report = await engine.runSuite(suite);

    expect(report.summary.failed).toBe(0);

    const throughput = report.results[0].metrics.find((m) => m.name === 'overall_throughput');
    if (throughput) {
      expect(throughput.value).toBeGreaterThan(1000);
    }
  });
});
