import { BenchmarkScenario, DegradedConfig } from '../scenarios.js';
import { config } from '../config.js';
import { createScenarioLogger } from '../logger.js';
import { BenchmarkResult, DegradedMetrics } from '../results.js';

/**
 * Degraded mode benchmark implementation.
 * Tests system behavior under partial failure.
 */
export class DegradedBenchmark {
  constructor(private scenario: BenchmarkScenario) {}

  async run(iteration: number): Promise<BenchmarkResult> {
    const logger = createScenarioLogger(this.scenario.id, iteration);
    const startTime = Date.now();
    const cfg = this.scenario.config as DegradedConfig;

    logger.info(`Starting degraded mode benchmark: ${cfg.failureType}`);
    logger.info(`Failure duration: ${cfg.failureDuration}s, Job rate: ${cfg.jobRate}/sec`);

    const metrics: Partial<DegradedMetrics> = {
      jobsSubmitted: 0,
      jobsCompleted: 0,
      jobsFailed: 0,
      jobsTimedOut: 0,
      queueDepth: 0,
      retryAttempts: 0,
      circuitBreakerTrips: 0,
      errorRate: 0,
      recoveryTimeMs: 0,
      degradedPeriodMs: cfg.failureDuration * 1000,
    };

    // Submit jobs at constant rate
    const jobSubmitInterval = setInterval(() => {
      this.submitJob(metrics, logger);
    }, 1000 / cfg.jobRate);

    // Wait for failure period
    await new Promise((r) => setTimeout(r, cfg.failureDuration * 1000));

    clearInterval(jobSubmitInterval);

    // Simulate recovery by polling until system is healthy again
    const recoveryStart = Date.now();
    let recovered = false;

    while (!recovered && Date.now() - recoveryStart < 60000) {
      const health = await this.checkSystemHealth();
      if (health) {
        recovered = true;
        metrics.recoveryTimeMs = Date.now() - recoveryStart;
      } else {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const endTime = Date.now();
    const durationMs = endTime - startTime;

    // Calculate error rate
    const totalJobs = metrics.jobsSubmitted || 1;
    metrics.errorRate = ((metrics.jobsFailed || 0) + (metrics.jobsTimedOut || 0)) / totalJobs;

    logger.info(`Submitted: ${metrics.jobsSubmitted}, Completed: ${metrics.jobsCompleted}`);
    logger.info(`Failed: ${metrics.jobsFailed}, Timeouts: ${metrics.jobsTimedOut}`);
    logger.info(`Recovery time: ${metrics.recoveryTimeMs}ms`);

    return {
      scenarioId: this.scenario.id,
      scenarioName: this.scenario.name,
      iteration,
      timestamp: new Date().toISOString(),
      durationMs,
      success: recovered,
      error: recovered ? undefined : 'System did not recover within timeout',
      metrics: metrics as DegradedMetrics,
    };
  }

  private async submitJob(
    metrics: Partial<DegradedMetrics>,
    logger: ReturnType<typeof createScenarioLogger>
  ): Promise<void> {
    const cfg = this.scenario.config as DegradedConfig;
    const jobId = crypto.randomUUID();

    const jobPayload = {
      id: jobId,
      type: cfg.failureType === 'runner-down' ? 'test.echo' : 'test.truth',
      priority: 50,
      payload: { type: 'test', data: {} },
      metadata: {
        source: 'benchmark',
        tags: ['benchmark', 'degraded'],
        createdAt: new Date().toISOString(),
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
        backoffMultiplier: 2,
        retryableCategories: ['RUNTIME_ERROR', 'SERVICE_UNAVAILABLE'],
        nonRetryableCategories: ['VALIDATION_ERROR'],
      },
      timeoutMs: 30000,
    };

    metrics.jobsSubmitted = (metrics.jobsSubmitted || 0) + 1;

    try {
      const response = await fetch(`${config.jobforgeUrl}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobPayload),
      });

      if (!response.ok) {
        metrics.jobsFailed = (metrics.jobsFailed || 0) + 1;
        return;
      }

      // Poll for completion
      const maxAttempts = 30;
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, 1000));

        try {
          const statusRes = await fetch(`${config.jobforgeUrl}/jobs/${jobId}`);
          if (statusRes.ok) {
            const status = (await statusRes.json()) as { status: string };
            if (status.status === 'completed') {
              metrics.jobsCompleted = (metrics.jobsCompleted || 0) + 1;
              return;
            } else if (status.status === 'failed') {
              metrics.jobsFailed = (metrics.jobsFailed || 0) + 1;
              return;
            }
          }
        } catch (e) {
          // Retry polling
        }
      }

      metrics.jobsTimedOut = (metrics.jobsTimedOut || 0) + 1;
    } catch (error) {
      metrics.jobsFailed = (metrics.jobsFailed || 0) + 1;
    }
  }

  private async checkSystemHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${config.jobforgeUrl}/health`, {
        signal: AbortSignal.timeout(5000),
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}
