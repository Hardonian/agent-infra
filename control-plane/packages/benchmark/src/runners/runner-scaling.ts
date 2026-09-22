import type { BenchmarkConfig, BenchmarkResult, BenchmarkMetric } from '../contracts/index.js';
import { BenchmarkRunner } from './base-runner.js';

interface RunnerMetrics {
  jobId: string;
  runnerId?: string;
  submitTime: number;
  startTime?: number;
  completeTime?: number;
  status: 'completed' | 'failed' | 'timeout';
  error?: Error;
}

export class RunnerScalingRunner extends BenchmarkRunner {
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    this.log(`Starting runner scaling benchmark: ${config.name}`);
    this.log(`Duration: ${config.durationMs}ms, Concurrency: ${config.concurrency}`);

    const warmupEnd = startTimestamp + config.warmupMs;
    const testEnd = startTimestamp + config.durationMs;

    const results: RunnerMetrics[] = [];
    const concurrencyLevels = [1, 5, 10, 25, 50];
    const concurrencyResults: Map<number, RunnerMetrics[]> = new Map();

    for (const concurrency of concurrencyLevels) {
      if (Date.now() >= testEnd) break;

      this.log(`Testing with concurrency level: ${concurrency}`);

      const levelResults: RunnerMetrics[] = [];
      const workers: Promise<void>[] = [];

      for (let i = 0; i < concurrency; i++) {
        workers.push(this.executeWorker(i, warmupEnd, testEnd, levelResults, concurrency));
      }

      await Promise.all(workers);

      concurrencyResults.set(concurrency, levelResults);
      results.push(...levelResults);

      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    const endTimestamp = Date.now();
    const endTime = new Date().toISOString();
    const duration = endTimestamp - startTimestamp;

    const metrics: BenchmarkMetric[] = [];

    for (const [concurrency, levelResults] of concurrencyResults) {
      const successful = levelResults.filter((r) => r.status === 'completed');
      const successRate = levelResults.length > 0 ? successful.length / levelResults.length : 0;

      const latencies = successful
        .filter((r) => r.startTime && r.completeTime)
        .map((r) => r.completeTime! - r.startTime!);

      const avgLatency =
        latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;

      const throughput = successful.length / (config.durationMs / 1000);

      metrics.push(
        {
          name: `concurrency_${concurrency}_jobs`,
          value: levelResults.length,
          unit: 'count',
          description: `Total jobs at concurrency ${concurrency}`,
        },
        {
          name: `concurrency_${concurrency}_success_rate`,
          value: Number((successRate * 100).toFixed(2)),
          unit: 'percent',
          description: `Success rate at concurrency ${concurrency}`,
        },
        {
          name: `concurrency_${concurrency}_avg_latency`,
          value: Number(avgLatency.toFixed(2)),
          unit: 'ms',
          description: `Average execution latency at concurrency ${concurrency}`,
        },
        {
          name: `concurrency_${concurrency}_throughput`,
          value: Number(throughput.toFixed(2)),
          unit: 'req/s',
          description: `Throughput at concurrency ${concurrency}`,
        }
      );
    }

    const totalSuccessful = results.filter((r) => r.status === 'completed').length;
    const totalFailed = results.filter((r) => r.status !== 'completed').length;
    const overallSuccessRate = results.length > 0 ? totalSuccessful / results.length : 0;

    metrics.push(
      {
        name: 'total_jobs',
        value: results.length,
        unit: 'count',
        description: 'Total number of jobs executed across all concurrency levels',
      },
      {
        name: 'total_successful',
        value: totalSuccessful,
        unit: 'count',
        description: 'Total successful jobs',
      },
      {
        name: 'total_failed',
        value: totalFailed,
        unit: 'count',
        description: 'Total failed jobs',
      },
      {
        name: 'overall_success_rate',
        value: Number((overallSuccessRate * 100).toFixed(2)),
        unit: 'percent',
        description: 'Overall success rate',
      }
    );

    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    if (config.thresholds.maxErrorRate && 1 - overallSuccessRate > config.thresholds.maxErrorRate) {
      status = 'failed';
    }

    const result = this.createBaseResult(config, startTime, endTime, duration, status);
    result.metrics = metrics;
    result.metadata = {
      concurrencyLevels,
      totalJobs: results.length,
      successfulJobs: totalSuccessful,
      failedJobs: totalFailed,
    };

    this.log(
      `Runner scaling benchmark complete: ${totalSuccessful}/${results.length} jobs successful`
    );

    return result;
  }

  private async executeWorker(
    workerId: number,
    warmupEnd: number,
    testEnd: number,
    results: RunnerMetrics[],
    concurrencyLevel: number
  ): Promise<void> {
    let counter = 0;

    while (Date.now() < testEnd) {
      const isWarmup = Date.now() < warmupEnd;
      const jobId = crypto.randomUUID();
      const submitTime = Date.now();

      try {
        const response = await fetch(`${this.context.jobforgeUrl}/jobs`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: jobId,
            type: 'benchmark.scaling',
            priority: 50,
            payload: {
              type: 'benchmark',
              version: '1.0.0',
              data: {
                workerId,
                concurrencyLevel,
                jobIndex: counter,
                timestamp: submitTime,
              },
              options: {},
            },
            metadata: {
              source: 'benchmark',
              tags: ['scaling', `concurrency-${concurrencyLevel}`, `worker-${workerId}`],
              createdAt: new Date().toISOString(),
            },
            timeoutMs: 60000,
          }),
        });

        if (!response.ok) {
          if (!isWarmup) {
            results.push({
              jobId,
              submitTime,
              status: 'failed',
              error: new Error(`HTTP ${response.status}`),
            });
          }
          counter++;
          continue;
        }

        const completion = await this.pollForCompletion(jobId, submitTime + 60000);

        if (!isWarmup) {
          results.push(completion);
        }
      } catch (error) {
        if (!isWarmup) {
          results.push({
            jobId,
            submitTime,
            status: 'failed',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }

      counter++;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private async pollForCompletion(
    jobId: string,
    deadline: number,
    maxAttempts: number = 60
  ): Promise<RunnerMetrics> {
    const submitTime = Date.now();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() > deadline) {
        return {
          jobId,
          submitTime,
          status: 'timeout',
        };
      }

      try {
        const response = await fetch(`${this.context.jobforgeUrl}/jobs/${jobId}`);

        if (response.ok) {
          const result = (await response.json()) as {
            status?: string;
            result?: { runnerId?: string; metadata?: { startedAt?: string } };
          };

          if (result.status === 'completed') {
            return {
              jobId,
              runnerId: result.result?.runnerId,
              submitTime,
              startTime: result.result?.metadata?.startedAt
                ? new Date(result.result.metadata.startedAt).getTime()
                : undefined,
              completeTime: Date.now(),
              status: 'completed',
            };
          }

          if (result.status === 'failed') {
            return {
              jobId,
              submitTime,
              status: 'failed',
            };
          }
        }

        const waitMs = Math.min(500 + attempt * 50, 3000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      } catch {
        const waitMs = Math.min(500 + attempt * 50, 3000);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }

    return {
      jobId,
      submitTime,
      status: 'timeout',
    };
  }
}
