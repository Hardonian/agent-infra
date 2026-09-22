import { BenchmarkScenario, ScaleConfig } from '../scenarios.js';
import { config } from '../config.js';
import { createScenarioLogger } from '../logger.js';
import { BenchmarkResult, ScaleMetrics } from '../results.js';

interface JobTiming {
  jobId: string;
  type: string;
  submitTime: number;
  completeTime?: number;
  status: 'completed' | 'failed' | 'pending';
}

/**
 * Scale-out benchmark implementation.
 * Tests performance with multiple concurrent runners.
 */
export class ScaleBenchmark {
  constructor(private scenario: BenchmarkScenario) {}

  async run(iteration: number): Promise<BenchmarkResult> {
    const logger = createScenarioLogger(this.scenario.id, iteration);
    const startTime = Date.now();
    const cfg = this.scenario.config as ScaleConfig;

    logger.info(`Starting scale benchmark with ${cfg.runnerCounts.join(', ')} runners`);

    const results: { runnerCount: number; metrics: ScaleMetrics }[] = [];

    // Run for each runner count
    for (const runnerCount of cfg.runnerCounts) {
      logger.info(`Testing with ${runnerCount} runner(s)...`);

      const metrics = await this.testWithRunners(runnerCount, cfg, logger);
      results.push({ runnerCount, metrics });

      // Cooldown between tests
      await new Promise((r) => setTimeout(r, 2000));
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Calculate scaling efficiency
    if (results.length >= 2) {
      const baseline = results[0];
      for (let i = 1; i < results.length; i++) {
        const scaled = results[i];
        const idealSpeedup = scaled.runnerCount / baseline.runnerCount;
        const actualSpeedup =
          scaled.metrics.throughputJobsPerSec / baseline.metrics.throughputJobsPerSec;
        scaled.metrics.scalingEfficiency = (actualSpeedup / idealSpeedup) * 100;
      }
    }

    // Return aggregated metrics
    const finalMetrics = results[results.length - 1].metrics;

    logger.info(`Scale benchmark complete`);
    logger.info(`Throughput: ${finalMetrics.throughputJobsPerSec.toFixed(2)} jobs/sec`);
    logger.info(`P50 latency: ${finalMetrics.latencyP50.toFixed(2)}ms`);

    return {
      scenarioId: this.scenario.id,
      scenarioName: this.scenario.name,
      iteration,
      timestamp: new Date().toISOString(),
      durationMs,
      success: true,
      metrics: finalMetrics,
    };
  }

  private async testWithRunners(
    runnerCount: number,
    cfg: ScaleConfig,
    logger: ReturnType<typeof createScenarioLogger>
  ): Promise<ScaleMetrics> {
    const totalJobs = cfg.jobsPerRunner * runnerCount;
    const timings: JobTiming[] = [];

    // Submit all jobs
    const submitStart = Date.now();
    const submitPromises: Promise<void>[] = [];

    for (let i = 0; i < totalJobs; i++) {
      const type = cfg.jobTypes[i % cfg.jobTypes.length];
      submitPromises.push(this.submitJob(type, timings, logger));
    }

    await Promise.all(submitPromises);
    const submitEnd = Date.now();

    // Wait for completion with timeout
    const maxWait = 120000; // 2 minutes
    const waitStart = Date.now();

    while (timings.filter((t) => t.status === 'pending').length > 0) {
      if (Date.now() - waitStart > maxWait) {
        logger.warn('Timeout waiting for job completion');
        break;
      }

      // Update pending jobs
      const pending = timings.filter((t) => t.status === 'pending');
      await Promise.all(pending.map((t) => this.checkJobStatus(t)));

      await new Promise((r) => setTimeout(r, 500));
    }

    const completeEnd = Date.now();

    // Calculate metrics
    const completed = timings.filter((t) => t.status === 'completed');
    const failed = timings.filter((t) => t.status === 'failed');
    const latencies = completed
      .filter((t) => t.completeTime)
      .map((t) => t.completeTime! - t.submitTime);

    const totalDuration = completeEnd - submitStart;

    return {
      runnerCount,
      totalJobs,
      completedJobs: completed.length,
      totalDurationMs: totalDuration,
      throughputJobsPerSec: completed.length / (totalDuration / 1000),
      latencyP50: this.calculatePercentile(latencies, 0.5),
      latencyP95: this.calculatePercentile(latencies, 0.95),
      latencyP99: this.calculatePercentile(latencies, 0.99),
      scalingEfficiency: 100, // Will be updated by caller
      cpuUtilization: 0, // Placeholder - would need system metrics
      memoryUtilization: 0,
    };
  }

  private async submitJob(
    type: string,
    timings: JobTiming[],
    logger: ReturnType<typeof createScenarioLogger>
  ): Promise<void> {
    const jobId = crypto.randomUUID();
    const submitTime = Date.now();

    const timing: JobTiming = {
      jobId,
      type,
      submitTime,
      status: 'pending',
    };
    timings.push(timing);

    try {
      const jobPayload = {
        id: jobId,
        type,
        priority: 50,
        payload: { type, data: { complexity: 'medium' } },
        metadata: {
          source: 'benchmark',
          tags: ['benchmark', 'scale'],
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

      const response = await fetch(`${config.jobforgeUrl}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobPayload),
      });

      if (!response.ok) {
        timing.status = 'failed';
      }
    } catch (error) {
      timing.status = 'failed';
    }
  }

  private async checkJobStatus(timing: JobTiming): Promise<void> {
    try {
      const response = await fetch(`${config.jobforgeUrl}/jobs/${timing.jobId}`);
      if (response.ok) {
        const status = (await response.json()) as { status: string };
        if (status.status === 'completed') {
          timing.status = 'completed';
          timing.completeTime = Date.now();
        } else if (status.status === 'failed') {
          timing.status = 'failed';
        }
      }
    } catch (error) {
      // Keep as pending, will retry
    }
  }

  private calculatePercentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * percentile) - 1;
    return sorted[Math.max(0, index)];
  }
}
