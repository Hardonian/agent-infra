import { BenchmarkScenario, LatencyConfig } from '../scenarios.js';
import { config } from '../config.js';
import { createScenarioLogger } from '../logger.js';
import { BenchmarkResult, LatencyMetrics } from '../results.js';

interface JobTiming {
  submitTime: number;
  completeTime: number;
  status: 'completed' | 'failed' | 'timeout';
}

/**
 * Latency benchmark implementation.
 * Measures end-to-end job orchestration latency.
 */
export class LatencyBenchmark {
  constructor(private scenario: BenchmarkScenario) {}

  async run(iteration: number): Promise<BenchmarkResult> {
    const logger = createScenarioLogger(this.scenario.id, iteration);
    const startTime = Date.now();
    const config_data = this.scenario.config as LatencyConfig;

    logger.info(`Starting latency benchmark with ${config_data.concurrentJobs} concurrent jobs`);

    const timings: JobTiming[] = [];
    const jobs: Promise<void>[] = [];

    // Submit jobs concurrently
    for (let i = 0; i < config_data.concurrentJobs; i++) {
      jobs.push(this.submitAndTrackJob(i, timings, logger));
    }

    // Wait for all jobs to complete
    await Promise.all(jobs);

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Calculate metrics
    const completedJobs = timings.filter((t) => t.status === 'completed');
    const failedJobs = timings.filter((t) => t.status === 'failed');
    const timeouts = timings.filter((t) => t.status === 'timeout');

    const latencies = completedJobs.map((t) => t.completeTime - t.submitTime);

    const metrics: LatencyMetrics = {
      totalJobs: config_data.concurrentJobs,
      completedJobs: completedJobs.length,
      failedJobs: failedJobs.length,
      timeouts: timeouts.length,
      totalDurationMs: durationMs,
      minLatencyMs: latencies.length > 0 ? Math.min(...latencies) : 0,
      maxLatencyMs: latencies.length > 0 ? Math.max(...latencies) : 0,
      avgLatencyMs:
        latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0,
      p50LatencyMs: this.calculatePercentile(latencies, 0.5),
      p95LatencyMs: this.calculatePercentile(latencies, 0.95),
      p99LatencyMs: this.calculatePercentile(latencies, 0.99),
      throughputJobsPerSec: completedJobs.length / (durationMs / 1000),
      errorRate: (failedJobs.length + timeouts.length) / config_data.concurrentJobs,
    };

    const success = failedJobs.length === 0 && timeouts.length === 0;

    logger.info(`Completed ${completedJobs.length}/${config_data.concurrentJobs} jobs`);
    logger.info(
      `Avg latency: ${metrics.avgLatencyMs.toFixed(2)}ms, P95: ${metrics.p95LatencyMs.toFixed(2)}ms`
    );

    return {
      scenarioId: this.scenario.id,
      scenarioName: this.scenario.name,
      iteration,
      timestamp: new Date().toISOString(),
      durationMs,
      success,
      error: success ? undefined : `${failedJobs.length} failed, ${timeouts.length} timeouts`,
      metrics,
    };
  }

  private async submitAndTrackJob(
    index: number,
    timings: JobTiming[],
    logger: ReturnType<typeof createScenarioLogger>
  ): Promise<void> {
    const config_data = this.scenario.config as LatencyConfig;
    const jobId = crypto.randomUUID();

    const jobPayload = {
      id: jobId,
      type: config_data.jobType,
      priority: 50,
      payload: config_data.jobPayload,
      metadata: {
        source: 'benchmark',
        tags: ['benchmark', 'latency', `iteration-${index}`],
        createdAt: new Date().toISOString(),
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
        backoffMultiplier: 2,
        retryableCategories: [],
        nonRetryableCategories: [],
      },
      timeoutMs: 60000,
    };

    const submitTime = Date.now();

    try {
      const response = await fetch(`${config.jobforgeUrl}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobPayload),
      });

      if (!response.ok) {
        timings.push({ submitTime, completeTime: Date.now(), status: 'failed' });
        return;
      }

      // Poll for completion
      const completeTime = await this.pollForCompletion(jobId, config_data, logger);

      if (completeTime) {
        timings.push({ submitTime, completeTime, status: 'completed' });
      } else {
        timings.push({ submitTime, completeTime: Date.now(), status: 'timeout' });
      }
    } catch (error) {
      timings.push({ submitTime, completeTime: Date.now(), status: 'failed' });
    }
  }

  private async pollForCompletion(
    jobId: string,
    config_data: LatencyConfig,
    logger: ReturnType<typeof createScenarioLogger>
  ): Promise<number | null> {
    for (let attempt = 0; attempt < config_data.maxPollAttempts; attempt++) {
      try {
        const response = await fetch(`${config.jobforgeUrl}/jobs/${jobId}`, {
          headers: { Accept: 'application/json' },
        });

        if (!response.ok) continue;

        const result = (await response.json()) as { status: string };

        if (result.status === 'completed') {
          return Date.now();
        } else if (result.status === 'failed') {
          return null;
        }

        // Exponential backoff with jitter
        const delay = config_data.pollingInterval * Math.pow(1.5, attempt) + Math.random() * 50;
        await new Promise((r) => setTimeout(r, Math.min(delay, 2000)));
      } catch (error) {
        // Continue polling on error
      }
    }

    return null;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }
}
