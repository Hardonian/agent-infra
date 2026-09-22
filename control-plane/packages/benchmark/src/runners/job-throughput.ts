import type { BenchmarkConfig, BenchmarkResult, BenchmarkMetric } from '../contracts/index.js';
import { BenchmarkRunner } from './base-runner.js';

interface JobSubmissionMetrics {
  jobId: string;
  submitTime: number;
  acceptedTime: number;
  error?: Error;
}

export class JobThroughputRunner extends BenchmarkRunner {
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    this.log(`Starting job throughput benchmark: ${config.name}`);
    this.log(`Duration: ${config.durationMs}ms, Concurrency: ${config.concurrency}`);

    const jobs: JobSubmissionMetrics[] = [];
    const errors: Map<string, number> = new Map();

    const warmupEnd = startTimestamp + config.warmupMs;
    const testEnd = startTimestamp + config.durationMs;

    const workers: Promise<void>[] = [];

    for (let i = 0; i < config.concurrency; i++) {
      workers.push(
        this.submitJobsWorker(
          i,
          warmupEnd,
          testEnd,
          jobs,
          errors,
          config.targetRps ? 1000 / (config.targetRps / config.concurrency) : 0
        )
      );
    }

    await Promise.all(workers);

    const endTimestamp = Date.now();
    const endTime = new Date().toISOString();
    const duration = endTimestamp - startTimestamp;

    const validJobs = jobs.filter((j) => !j.error);
    const failedJobs = jobs.filter((j) => j.error);

    const throughputMetrics = this.calculateThroughputMetrics(validJobs, duration);
    const latencyMetrics = this.calculateLatencyMetrics(validJobs);

    const totalJobsSubmitted = jobs.length;
    const jobsPerSecond = totalJobsSubmitted / (duration / 1000);
    const acceptanceRate = totalJobsSubmitted > 0 ? validJobs.length / totalJobsSubmitted : 0;

    const metrics: BenchmarkMetric[] = [
      {
        name: 'total_jobs_submitted',
        value: totalJobsSubmitted,
        unit: 'count',
        description: 'Total number of jobs submitted during the benchmark',
      },
      {
        name: 'jobs_per_second',
        value: Number(jobsPerSecond.toFixed(2)),
        unit: 'req/s',
        description: 'Average job submission rate (jobs per second)',
      },
      {
        name: 'acceptance_rate',
        value: Number((acceptanceRate * 100).toFixed(2)),
        unit: 'percent',
        description: 'Percentage of jobs successfully accepted',
      },
      {
        name: 'failed_submissions',
        value: failedJobs.length,
        unit: 'count',
        description: 'Number of failed job submissions',
      },
      ...throughputMetrics,
      ...latencyMetrics,
    ];

    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    if (config.thresholds.minThroughput && jobsPerSecond < config.thresholds.minThroughput) {
      status = 'failed';
    }
    if (config.thresholds.maxErrorRate && 1 - acceptanceRate > config.thresholds.maxErrorRate) {
      status = 'failed';
    }

    const result = this.createBaseResult(config, startTime, endTime, duration, status);
    result.metrics = metrics;
    result.metadata = {
      totalJobs: totalJobsSubmitted,
      validJobs: validJobs.length,
      failedJobs: failedJobs.length,
      errorBreakdown: Object.fromEntries(errors),
    };

    this.log(
      `Job throughput benchmark complete: ${validJobs.length} jobs, ${jobsPerSecond.toFixed(2)} jobs/sec`
    );

    return result;
  }

  private async submitJobsWorker(
    workerId: number,
    warmupEnd: number,
    testEnd: number,
    jobs: JobSubmissionMetrics[],
    errors: Map<string, number>,
    targetInterval: number
  ): Promise<void> {
    let jobCounter = 0;

    while (Date.now() < testEnd) {
      const isWarmup = Date.now() < warmupEnd;

      const jobId = crypto.randomUUID();
      const submitTime = Date.now();

      try {
        const response = await fetch(`${this.context.jobforgeUrl}/jobs`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            id: jobId,
            type: 'benchmark.throughput',
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
              tags: ['throughput', `worker-${workerId}`],
              createdAt: new Date().toISOString(),
            },
            timeoutMs: 30000,
          }),
        });

        const acceptedTime = Date.now();

        if (!isWarmup) {
          jobs.push({
            jobId,
            submitTime,
            acceptedTime,
            error: !response.ok ? new Error(`HTTP ${response.status}`) : undefined,
          });

          if (!response.ok) {
            const errorKey = `HTTP_${response.status}`;
            errors.set(errorKey, (errors.get(errorKey) || 0) + 1);
          }
        }
      } catch (error) {
        if (!isWarmup) {
          jobs.push({
            jobId,
            submitTime,
            acceptedTime: Date.now(),
            error: error instanceof Error ? error : new Error(String(error)),
          });

          const errorKey = error instanceof Error ? error.message : 'unknown';
          errors.set(errorKey, (errors.get(errorKey) || 0) + 1);
        }
      }

      jobCounter++;

      if (targetInterval > 0) {
        const elapsed = Date.now() - submitTime;
        const delay = Math.max(0, targetInterval - elapsed);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  private calculateThroughputMetrics(
    jobs: JobSubmissionMetrics[],
    totalDurationMs: number
  ): BenchmarkMetric[] {
    if (jobs.length === 0) return [];

    const buckets: number[] = [];
    const bucketSizeMs = 1000;
    const bucketCount = Math.ceil(totalDurationMs / bucketSizeMs);

    for (let i = 0; i < bucketCount; i++) {
      buckets.push(0);
    }

    for (const job of jobs) {
      const bucketIndex = Math.floor(job.submitTime / bucketSizeMs) % bucketCount;
      if (bucketIndex >= 0 && bucketIndex < bucketCount) {
        buckets[bucketIndex]++;
      }
    }

    const throughputValues = buckets.filter((v) => v > 0);
    const avgThroughput =
      throughputValues.reduce((a, b) => a + b, 0) / throughputValues.length || 0;
    const maxThroughput = Math.max(...throughputValues, 0);
    const minThroughput = Math.min(...throughputValues) || 0;

    return [
      {
        name: 'avg_throughput',
        value: Number(avgThroughput.toFixed(2)),
        unit: 'req/s',
        description: 'Average throughput per second',
      },
      {
        name: 'max_throughput',
        value: maxThroughput,
        unit: 'req/s',
        description: 'Maximum throughput in a single second',
      },
      {
        name: 'min_throughput',
        value: minThroughput,
        unit: 'req/s',
        description: 'Minimum throughput in a single second',
      },
    ];
  }

  private calculateLatencyMetrics(jobs: JobSubmissionMetrics[]): BenchmarkMetric[] {
    if (jobs.length === 0) return [];

    const latencies = jobs.map((j) => j.acceptedTime - j.submitTime);
    const sorted = [...latencies].sort((a, b) => a - b);

    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
    const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
    const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

    return [
      {
        name: 'avg_acceptance_latency',
        value: Number(mean.toFixed(2)),
        unit: 'ms',
        description: 'Average time from submission to acceptance',
      },
      {
        name: 'p50_acceptance_latency',
        value: p50,
        unit: 'ms',
        description: '50th percentile acceptance latency',
      },
      {
        name: 'p95_acceptance_latency',
        value: p95,
        unit: 'ms',
        description: '95th percentile acceptance latency',
      },
      {
        name: 'p99_acceptance_latency',
        value: p99,
        unit: 'ms',
        description: '99th percentile acceptance latency',
      },
    ];
  }
}
