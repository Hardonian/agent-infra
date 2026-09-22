import type { BenchmarkConfig, BenchmarkResult, BenchmarkMetric } from '../contracts/index.js';
import { BenchmarkRunner } from './base-runner.js';

interface EndToEndMetrics {
  jobId: string;
  submitTime: number;
  completionTime: number;
  totalLatency: number;
  status: 'completed' | 'failed' | 'timeout';
}

export class EndToEndLatencyRunner extends BenchmarkRunner {
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    this.log(`Starting end-to-end latency benchmark: ${config.name}`);
    this.log(`Duration: ${config.durationMs}ms, Concurrency: ${config.concurrency}`);

    const results: EndToEndMetrics[] = [];
    const errors: Map<string, number> = new Map();

    const warmupEnd = startTimestamp + config.warmupMs;
    const testEnd = startTimestamp + config.durationMs;

    const workers: Promise<void>[] = [];

    for (let i = 0; i < config.concurrency; i++) {
      workers.push(this.executeJobsWorker(i, warmupEnd, testEnd, results, errors));
    }

    await Promise.all(workers);

    const endTimestamp = Date.now();
    const endTime = new Date().toISOString();
    const duration = endTimestamp - startTimestamp;

    const successfulJobs = results.filter((r) => r.status === 'completed');
    const failedJobs = results.filter((r) => r.status === 'failed');
    const timeoutJobs = results.filter((r) => r.status === 'timeout');

    const latencyMetrics = this.calculateLatencyMetrics(successfulJobs);
    const pipelineMetrics = this.calculatePipelineMetrics(results);

    const avgLatency =
      successfulJobs.length > 0
        ? successfulJobs.reduce((sum, j) => sum + j.totalLatency, 0) / successfulJobs.length
        : 0;

    const successRate = results.length > 0 ? successfulJobs.length / results.length : 0;

    const metrics: BenchmarkMetric[] = [
      {
        name: 'total_jobs_executed',
        value: results.length,
        unit: 'count',
        description: 'Total number of jobs executed end-to-end',
      },
      {
        name: 'successful_jobs',
        value: successfulJobs.length,
        unit: 'count',
        description: 'Number of jobs that completed successfully',
      },
      {
        name: 'failed_jobs',
        value: failedJobs.length,
        unit: 'count',
        description: 'Number of jobs that failed',
      },
      {
        name: 'timeout_jobs',
        value: timeoutJobs.length,
        unit: 'count',
        description: 'Number of jobs that timed out',
      },
      {
        name: 'success_rate',
        value: Number((successRate * 100).toFixed(2)),
        unit: 'percent',
        description: 'Percentage of jobs that completed successfully',
      },
      {
        name: 'avg_total_latency',
        value: Number(avgLatency.toFixed(2)),
        unit: 'ms',
        description: 'Average end-to-end latency from submission to completion',
      },
      ...latencyMetrics,
      ...pipelineMetrics,
    ];

    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    if (config.thresholds.maxLatencyMs && avgLatency > config.thresholds.maxLatencyMs) {
      status = 'failed';
    }
    if (config.thresholds.maxErrorRate && 1 - successRate > config.thresholds.maxErrorRate) {
      status = 'failed';
    }

    const result = this.createBaseResult(config, startTime, endTime, duration, status);
    result.metrics = metrics;
    result.metadata = {
      totalJobs: results.length,
      successfulJobs: successfulJobs.length,
      failedJobs: failedJobs.length,
      timeoutJobs: timeoutJobs.length,
      errorBreakdown: Object.fromEntries(errors),
    };

    this.log(
      `End-to-end latency benchmark complete: ${successfulJobs.length}/${results.length} jobs successful, avg latency ${avgLatency.toFixed(2)}ms`
    );

    return result;
  }

  private async executeJobsWorker(
    workerId: number,
    warmupEnd: number,
    testEnd: number,
    results: EndToEndMetrics[],
    errors: Map<string, number>
  ): Promise<void> {
    let jobCounter = 0;

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
            type: 'benchmark.latency',
            priority: 50,
            payload: {
              type: 'benchmark',
              version: '1.0.0',
              data: {
                workerId,
                jobIndex: jobCounter,
                timestamp: submitTime,
              },
              options: {},
            },
            metadata: {
              source: 'benchmark',
              tags: ['latency', `worker-${workerId}`],
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
              completionTime: Date.now(),
              totalLatency: Date.now() - submitTime,
              status: 'failed',
            });
            errors.set(`HTTP_${response.status}`, (errors.get(`HTTP_${response.status}`) || 0) + 1);
          }
          jobCounter++;
          continue;
        }

        const submitResult = (await response.json()) as { status: string; error?: unknown };

        if (submitResult.status === 'failed' || submitResult.error) {
          if (!isWarmup) {
            results.push({
              jobId,
              submitTime,
              completionTime: Date.now(),
              totalLatency: Date.now() - submitTime,
              status: 'failed',
            });
          }
          jobCounter++;
          continue;
        }

        const completionResult = await this.pollForCompletion(jobId, submitTime + 60000);

        if (!isWarmup) {
          results.push(completionResult);

          if (completionResult.status === 'timeout') {
            errors.set('timeout', (errors.get('timeout') || 0) + 1);
          } else if (completionResult.status === 'failed') {
            errors.set('completion_failed', (errors.get('completion_failed') || 0) + 1);
          }
        }
      } catch (error) {
        if (!isWarmup) {
          results.push({
            jobId,
            submitTime,
            completionTime: Date.now(),
            totalLatency: Date.now() - submitTime,
            status: 'failed',
          });

          const errorKey = error instanceof Error ? error.message : 'unknown';
          errors.set(errorKey, (errors.get(errorKey) || 0) + 1);
        }
      }

      jobCounter++;

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private async pollForCompletion(
    jobId: string,
    deadline: number,
    maxAttempts: number = 60
  ): Promise<EndToEndMetrics> {
    const submitTime = Date.now();

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (Date.now() > deadline) {
        return {
          jobId,
          submitTime,
          completionTime: Date.now(),
          totalLatency: Date.now() - submitTime,
          status: 'timeout',
        };
      }

      try {
        const response = await fetch(`${this.context.jobforgeUrl}/jobs/${jobId}`, {
          method: 'GET',
        });

        if (response.ok) {
          const result = (await response.json()) as { status: string };

          if (result.status === 'completed') {
            return {
              jobId,
              submitTime,
              completionTime: Date.now(),
              totalLatency: Date.now() - submitTime,
              status: 'completed',
            };
          }

          if (result.status === 'failed') {
            return {
              jobId,
              submitTime,
              completionTime: Date.now(),
              totalLatency: Date.now() - submitTime,
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
      completionTime: Date.now(),
      totalLatency: Date.now() - submitTime,
      status: 'timeout',
    };
  }

  private calculateLatencyMetrics(jobs: EndToEndMetrics[]): BenchmarkMetric[] {
    if (jobs.length === 0) return [];

    const latencies = jobs.map((j) => j.totalLatency);
    const sorted = [...latencies].sort((a, b) => a - b);

    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const p50 = median;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || max;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || max;
    const stdDev = Math.sqrt(
      latencies.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / latencies.length
    );

    return [
      { name: 'min_latency', value: min, unit: 'ms', description: 'Minimum end-to-end latency' },
      { name: 'max_latency', value: max, unit: 'ms', description: 'Maximum end-to-end latency' },
      {
        name: 'median_latency',
        value: median,
        unit: 'ms',
        description: 'Median end-to-end latency',
      },
      { name: 'p50_latency', value: p50, unit: 'ms', description: '50th percentile latency' },
      { name: 'p95_latency', value: p95, unit: 'ms', description: '95th percentile latency' },
      { name: 'p99_latency', value: p99, unit: 'ms', description: '99th percentile latency' },
      {
        name: 'std_dev_latency',
        value: Number(stdDev.toFixed(2)),
        unit: 'ms',
        description: 'Standard deviation of latency',
      },
    ];
  }

  private calculatePipelineMetrics(jobs: EndToEndMetrics[]): BenchmarkMetric[] {
    const completedJobs = jobs.filter((j) => j.status === 'completed');

    if (completedJobs.length < 2) return [];

    const sortedByTime = [...completedJobs].sort((a, b) => a.completionTime - b.completionTime);
    const timeRange =
      sortedByTime[sortedByTime.length - 1].completionTime - sortedByTime[0].completionTime;

    const throughput = timeRange > 0 ? completedJobs.length / (timeRange / 1000) : 0;

    return [
      {
        name: 'pipeline_throughput',
        value: Number(throughput.toFixed(2)),
        unit: 'req/s',
        description: 'Effective throughput of completed jobs',
      },
    ];
  }
}
