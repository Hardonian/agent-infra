import type { LoadTestConfig, LoadTestResult } from './contracts/index.js';

interface RequestMetrics {
  startTime: number;
  endTime: number;
  statusCode: number;
  error?: Error;
}

export class LoadGenerator {
  private abortController: AbortController | null = null;

  async runLoadTest(config: LoadTestConfig): Promise<LoadTestResult> {
    this.abortController = new AbortController();
    const metrics: RequestMetrics[] = [];
    const errors: Map<string, { message: string; count: number; category: string }> = new Map();
    const statusCodes: Map<number, number> = new Map();

    const startTime = Date.now();
    const endTime = startTime + config.durationMs;
    const rampUpEnd = startTime + config.rampUpMs;

    const workers: Promise<void>[] = [];
    const maxWorkers = config.concurrency;

    for (let i = 0; i < maxWorkers; i++) {
      workers.push(
        this.workerLoop(i, config, startTime, rampUpEnd, endTime, metrics, errors, statusCodes)
      );
    }

    await Promise.all(workers);

    const totalDuration = Date.now() - startTime;
    const successfulRequests = metrics.filter(
      (m) => m.statusCode >= 200 && m.statusCode < 300
    ).length;
    const failedRequests = metrics.length - successfulRequests;

    const latencies = metrics.map((m) => m.endTime - m.startTime);
    const sortedLatencies = [...latencies].sort((a, b) => a - b);

    const mean = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
    const stdDev = Math.sqrt(
      latencies.reduce((sq, n) => sq + Math.pow(n - mean, 2), 0) / latencies.length || 0
    );

    return {
      config,
      totalRequests: metrics.length,
      successfulRequests,
      failedRequests,
      errorRate: metrics.length > 0 ? failedRequests / metrics.length : 0,
      requestsPerSecond: totalDuration > 0 ? (metrics.length / totalDuration) * 1000 : 0,
      latencies: {
        min: sortedLatencies[0] || 0,
        max: sortedLatencies[sortedLatencies.length - 1] || 0,
        mean,
        p50: this.percentile(sortedLatencies, 50),
        p95: this.percentile(sortedLatencies, 95),
        p99: this.percentile(sortedLatencies, 99),
        stdDev,
      },
      statusCodes: Object.fromEntries(statusCodes),
      errors: Array.from(errors.values()),
    };
  }

  stop(): void {
    this.abortController?.abort();
  }

  private async workerLoop(
    workerId: number,
    config: LoadTestConfig,
    startTime: number,
    rampUpEnd: number,
    endTime: number,
    metrics: RequestMetrics[],
    errors: Map<string, { message: string; count: number; category: string }>,
    statusCodes: Map<number, number>
  ): Promise<void> {
    const signal = this.abortController?.signal;

    while (Date.now() < endTime && !signal?.aborted) {
      if (Date.now() < rampUpEnd) {
        const rampUpProgress = (Date.now() - startTime) / config.rampUpMs;
        const staggerDelay =
          (workerId / config.concurrency) * config.rampUpMs * (1 - rampUpProgress);
        await this.delay(staggerDelay);
      }

      const metric = await this.executeRequest(config, signal);

      metrics.push(metric);

      const currentCount = statusCodes.get(metric.statusCode) || 0;
      statusCodes.set(metric.statusCode, currentCount + 1);

      if (metric.error) {
        const errorKey = metric.error.message;
        const existing = errors.get(errorKey);
        if (existing) {
          existing.count++;
        } else {
          errors.set(errorKey, {
            message: metric.error.message,
            count: 1,
            category: this.categorizeError(metric.error),
          });
        }
      }

      await this.delay(0);
    }
  }

  private async executeRequest(
    config: LoadTestConfig,
    signal?: AbortSignal
  ): Promise<RequestMetrics> {
    const startTime = Date.now();

    try {
      const response = await fetch(config.targetUrl, {
        method: config.method,
        headers: config.headers,
        body: config.body ? JSON.stringify(config.body) : undefined,
        signal,
      });

      const endTime = Date.now();

      return {
        startTime,
        endTime,
        statusCode: response.status,
      };
    } catch (error) {
      const endTime = Date.now();

      return {
        startTime,
        endTime,
        statusCode: 0,
        error: error instanceof Error ? error : new Error(String(error)),
      };
    }
  }

  private categorizeError(error: Error): string {
    const message = error.message.toLowerCase();
    if (message.includes('timeout') || message.includes('abort')) return 'TIMEOUT';
    if (message.includes('network') || message.includes('fetch')) return 'NETWORK_ERROR';
    if (message.includes('connection')) return 'CONNECTION_ERROR';
    return 'UNKNOWN_ERROR';
  }

  private percentile(sortedArray: number[], p: number): number {
    if (sortedArray.length === 0) return 0;
    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, index)];
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
