import type { BenchmarkConfig, BenchmarkResult, BenchmarkMetric } from '../contracts/index.js';
import { BenchmarkRunner } from './base-runner.js';

interface TruthQueryMetrics {
  queryId: string;
  submitTime: number;
  responseTime: number;
  resultCount: number;
  error?: Error;
}

export class TruthCoreQueryRunner extends BenchmarkRunner {
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    this.log(`Starting TruthCore query benchmark: ${config.name}`);
    this.log(`Duration: ${config.durationMs}ms, Concurrency: ${config.concurrency}`);

    const warmupEnd = startTimestamp + config.warmupMs;
    const testEnd = startTimestamp + config.durationMs;

    await this.seedTestData(100);

    const assertMetrics: TruthQueryMetrics[] = [];
    const queryMetrics: TruthQueryMetrics[] = [];

    const assertWorkers: Promise<void>[] = [];
    const queryWorkers: Promise<void>[] = [];

    const assertConcurrency = Math.max(1, Math.floor(config.concurrency / 3));
    const queryConcurrency = config.concurrency - assertConcurrency;

    for (let i = 0; i < assertConcurrency; i++) {
      assertWorkers.push(this.assertWorker(i, warmupEnd, testEnd, assertMetrics));
    }

    for (let i = 0; i < queryConcurrency; i++) {
      queryWorkers.push(this.queryWorker(i, warmupEnd, testEnd, queryMetrics));
    }

    await Promise.all([...assertWorkers, ...queryWorkers]);

    const endTimestamp = Date.now();
    const endTime = new Date().toISOString();
    const duration = endTimestamp - startTimestamp;

    const successfulAsserts = assertMetrics.filter((m) => !m.error);
    const failedAsserts = assertMetrics.filter((m) => m.error);
    const successfulQueries = queryMetrics.filter((m) => !m.error);
    const failedQueries = queryMetrics.filter((m) => m.error);

    const assertLatencyMetrics = this.calculateQueryMetrics(successfulAsserts, 'assert');
    const queryLatencyMetrics = this.calculateQueryMetrics(successfulQueries, 'query');

    const assertThroughput = successfulAsserts.length / (duration / 1000);
    const queryThroughput = successfulQueries.length / (duration / 1000);

    const metrics: BenchmarkMetric[] = [
      {
        name: 'total_assertions',
        value: assertMetrics.length,
        unit: 'count',
        description: 'Total number of assertions submitted',
      },
      {
        name: 'successful_assertions',
        value: successfulAsserts.length,
        unit: 'count',
        description: 'Number of successful assertions',
      },
      {
        name: 'failed_assertions',
        value: failedAsserts.length,
        unit: 'count',
        description: 'Number of failed assertions',
      },
      {
        name: 'assertion_throughput',
        value: Number(assertThroughput.toFixed(2)),
        unit: 'req/s',
        description: 'Assertions per second',
      },
      {
        name: 'total_queries',
        value: queryMetrics.length,
        unit: 'count',
        description: 'Total number of queries executed',
      },
      {
        name: 'successful_queries',
        value: successfulQueries.length,
        unit: 'count',
        description: 'Number of successful queries',
      },
      {
        name: 'failed_queries',
        value: failedQueries.length,
        unit: 'count',
        description: 'Number of failed queries',
      },
      {
        name: 'query_throughput',
        value: Number(queryThroughput.toFixed(2)),
        unit: 'req/s',
        description: 'Queries per second',
      },
      {
        name: 'avg_results_per_query',
        value:
          successfulQueries.length > 0
            ? Number(
                (
                  successfulQueries.reduce((sum, q) => sum + q.resultCount, 0) /
                  successfulQueries.length
                ).toFixed(2)
              )
            : 0,
        unit: 'count',
        description: 'Average number of results returned per query',
      },
      ...assertLatencyMetrics,
      ...queryLatencyMetrics,
    ];

    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    const totalOps = successfulAsserts.length + successfulQueries.length;
    const totalFailed = failedAsserts.length + failedQueries.length;
    const errorRate = totalOps > 0 ? totalFailed / (totalOps + totalFailed) : 0;

    if (config.thresholds.maxErrorRate && errorRate > config.thresholds.maxErrorRate) {
      status = 'failed';
    }

    const result = this.createBaseResult(config, startTime, endTime, duration, status);
    result.metrics = metrics;
    result.metadata = {
      totalAssertions: assertMetrics.length,
      successfulAssertions: successfulAsserts.length,
      totalQueries: queryMetrics.length,
      successfulQueries: successfulQueries.length,
    };

    this.log(
      `TruthCore benchmark complete: ${successfulAsserts.length} asserts, ${successfulQueries.length} queries`
    );

    return result;
  }

  private async seedTestData(count: number): Promise<void> {
    this.log(`Seeding ${count} test assertions...`);

    const promises: Promise<void>[] = [];

    for (let i = 0; i < count; i++) {
      promises.push(
        fetch(`${this.context.truthcoreUrl}/assert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            subject: `benchmark-subject-${i % 10}`,
            predicate: 'benchmark.test',
            object: { index: i, data: 'test-data' },
            confidence: 1.0,
            timestamp: new Date().toISOString(),
            source: 'benchmark-seed',
            metadata: { benchmark: true },
          }),
        }).then(() => {})
      );
    }

    await Promise.all(promises);
    this.log('Test data seeded');
  }

  private async assertWorker(
    workerId: number,
    warmupEnd: number,
    testEnd: number,
    metrics: TruthQueryMetrics[]
  ): Promise<void> {
    let counter = 0;

    while (Date.now() < testEnd) {
      const isWarmup = Date.now() < warmupEnd;
      const queryId = crypto.randomUUID();
      const submitTime = Date.now();

      try {
        const response = await fetch(`${this.context.truthcoreUrl}/assert`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: queryId,
            subject: `benchmark-worker-${workerId}`,
            predicate: 'benchmark.assert',
            object: { counter, timestamp: submitTime },
            confidence: 1.0,
            timestamp: new Date().toISOString(),
            source: 'benchmark',
            metadata: { workerId, counter },
          }),
        });

        const responseTime = Date.now();

        if (!isWarmup) {
          metrics.push({
            queryId,
            submitTime,
            responseTime,
            resultCount: response.ok ? 1 : 0,
            error: response.ok ? undefined : new Error(`HTTP ${response.status}`),
          });
        }
      } catch (error) {
        if (!isWarmup) {
          metrics.push({
            queryId,
            submitTime,
            responseTime: Date.now(),
            resultCount: 0,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }

      counter++;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  private async queryWorker(
    workerId: number,
    warmupEnd: number,
    testEnd: number,
    metrics: TruthQueryMetrics[]
  ): Promise<void> {
    let counter = 0;

    while (Date.now() < testEnd) {
      const isWarmup = Date.now() < warmupEnd;
      const queryId = crypto.randomUUID();
      const submitTime = Date.now();

      try {
        const response = await fetch(`${this.context.truthcoreUrl}/query`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: queryId,
            pattern: {
              subject: `benchmark-subject-${counter % 10}`,
              predicate: 'benchmark.test',
            },
            limit: 10,
          }),
        });

        const responseTime = Date.now();
        let resultCount = 0;

        if (response.ok) {
          const data = (await response.json()) as { assertions?: unknown[] };
          resultCount = data.assertions?.length || 0;
        }

        if (!isWarmup) {
          metrics.push({
            queryId,
            submitTime,
            responseTime,
            resultCount,
            error: response.ok ? undefined : new Error(`HTTP ${response.status}`),
          });
        }
      } catch (error) {
        if (!isWarmup) {
          metrics.push({
            queryId,
            submitTime,
            responseTime: Date.now(),
            resultCount: 0,
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }

      counter++;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  private calculateQueryMetrics(metrics: TruthQueryMetrics[], prefix: string): BenchmarkMetric[] {
    if (metrics.length === 0) return [];

    const latencies = metrics.map((m) => m.responseTime - m.submitTime);
    const sorted = [...latencies].sort((a, b) => a - b);

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || max;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || max;

    return [
      {
        name: `${prefix}_min_latency`,
        value: min,
        unit: 'ms',
        description: `Minimum ${prefix} latency`,
      },
      {
        name: `${prefix}_max_latency`,
        value: max,
        unit: 'ms',
        description: `Maximum ${prefix} latency`,
      },
      {
        name: `${prefix}_avg_latency`,
        value: Number(mean.toFixed(2)),
        unit: 'ms',
        description: `Average ${prefix} latency`,
      },
      {
        name: `${prefix}_p50_latency`,
        value: p50,
        unit: 'ms',
        description: `50th percentile ${prefix} latency`,
      },
      {
        name: `${prefix}_p95_latency`,
        value: p95,
        unit: 'ms',
        description: `95th percentile ${prefix} latency`,
      },
      {
        name: `${prefix}_p99_latency`,
        value: p99,
        unit: 'ms',
        description: `99th percentile ${prefix} latency`,
      },
    ];
  }
}
