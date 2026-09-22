import type { BenchmarkConfig, BenchmarkResult, BenchmarkMetric } from '../contracts/index.js';
import { BenchmarkRunner } from './base-runner.js';
import { ConcurrencyLimiter } from '../utils/concurrency.js';
import { textByteLength } from '../utils/bytes.js';
import { computeDistributionStats } from '../utils/percentiles.js';

interface HealthCheckStats {
  latencies: number[];
  total: number;
  healthy: number;
  requestBytesTotal: number;
  responseBytesTotal: number;
  requestBytesMax: number;
  responseBytesMax: number;
}

interface OverallHealthStats {
  latencies: number[];
  total: number;
  healthy: number;
  requestBytesTotal: number;
  responseBytesTotal: number;
  requestBytesMax: number;
  responseBytesMax: number;
}

export class HealthCheckPerformanceRunner extends BenchmarkRunner {
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    this.log(`Starting health check performance benchmark: ${config.name}`);
    this.log(`Duration: ${config.durationMs}ms, Concurrency: ${config.concurrency}`);

    const warmupEnd = startTimestamp + config.warmupMs;
    const testEnd = startTimestamp + config.durationMs;

    const services = [
      { name: 'TruthCore', url: this.context.truthcoreUrl },
      { name: 'JobForge', url: this.context.jobforgeUrl },
      { name: 'Runner', url: this.context.runnerUrl },
    ];

    const perServiceStats = new Map<string, HealthCheckStats>();
    const overallStats: OverallHealthStats = {
      latencies: [],
      total: 0,
      healthy: 0,
      requestBytesTotal: 0,
      responseBytesTotal: 0,
      requestBytesMax: 0,
      responseBytesMax: 0,
    };

    const httpConcurrencyLimit = config.http?.concurrencyLimit ?? config.concurrency;
    const httpBatchSize = Math.max(1, config.http?.batchSize ?? services.length);
    const httpLimiter = new ConcurrencyLimiter(httpConcurrencyLimit);

    for (const service of services) {
      perServiceStats.set(service.name, {
        latencies: [],
        total: 0,
        healthy: 0,
        requestBytesTotal: 0,
        responseBytesTotal: 0,
        requestBytesMax: 0,
        responseBytesMax: 0,
      });
    }

    const workers: Promise<void>[] = [];

    for (let i = 0; i < config.concurrency; i++) {
      workers.push(
        this.healthCheckWorker(
          i,
          warmupEnd,
          testEnd,
          services,
          perServiceStats,
          overallStats,
          httpLimiter,
          httpBatchSize
        )
      );
    }

    await Promise.all(workers);

    const endTimestamp = Date.now();
    const endTime = new Date().toISOString();
    const duration = endTimestamp - startTimestamp;

    const metrics: BenchmarkMetric[] = [];

    for (const service of services) {
      const serviceStats = perServiceStats.get(service.name);

      if (!serviceStats || serviceStats.total === 0) continue;

      const latencies = serviceStats.latencies;
      const latencyStats = computeDistributionStats(latencies, [50, 95, 99], config.percentiles);
      const p50 = latencyStats.percentiles[50] ?? 0;
      const p95 = latencyStats.percentiles[95] ?? 0;
      const p99 = latencyStats.percentiles[99] ?? 0;

      const healthRate = serviceStats.total > 0 ? serviceStats.healthy / serviceStats.total : 0;
      const avgRequestBytes =
        serviceStats.total > 0 ? serviceStats.requestBytesTotal / serviceStats.total : 0;
      const avgResponseBytes =
        serviceStats.total > 0 ? serviceStats.responseBytesTotal / serviceStats.total : 0;

      const throughput = serviceStats.total / (duration / 1000);

      metrics.push(
        {
          name: `${service.name.toLowerCase()}_health_checks`,
          value: serviceStats.total,
          unit: 'count',
          description: `Total health checks for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_health_rate`,
          value: Number((healthRate * 100).toFixed(2)),
          unit: 'percent',
          description: `Health check success rate for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_avg_latency`,
          value: Number(latencyStats.mean.toFixed(2)),
          unit: 'ms',
          description: `Average health check latency for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_min_latency`,
          value: latencyStats.min,
          unit: 'ms',
          description: `Minimum health check latency for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_max_latency`,
          value: latencyStats.max,
          unit: 'ms',
          description: `Maximum health check latency for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_p50_latency`,
          value: p50,
          unit: 'ms',
          description: `50th percentile health check latency for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_p95_latency`,
          value: p95,
          unit: 'ms',
          description: `95th percentile health check latency for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_p99_latency`,
          value: p99,
          unit: 'ms',
          description: `99th percentile health check latency for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_throughput`,
          value: Number(throughput.toFixed(2)),
          unit: 'req/s',
          description: `Health check throughput for ${service.name}`,
        },
        {
          name: `${service.name.toLowerCase()}_avg_request_bytes`,
          value: Number(avgRequestBytes.toFixed(2)),
          unit: 'bytes',
          description: `Average request size for ${service.name} health checks`,
        },
        {
          name: `${service.name.toLowerCase()}_max_request_bytes`,
          value: serviceStats.requestBytesMax,
          unit: 'bytes',
          description: `Maximum request size for ${service.name} health checks`,
        },
        {
          name: `${service.name.toLowerCase()}_avg_response_bytes`,
          value: Number(avgResponseBytes.toFixed(2)),
          unit: 'bytes',
          description: `Average response size for ${service.name} health checks`,
        },
        {
          name: `${service.name.toLowerCase()}_max_response_bytes`,
          value: serviceStats.responseBytesMax,
          unit: 'bytes',
          description: `Maximum response size for ${service.name} health checks`,
        }
      );
    }

    const totalChecks = overallStats.total;
    const healthyChecks = overallStats.healthy;
    const overallHealthRate = totalChecks > 0 ? healthyChecks / totalChecks : 0;

    const overallLatencies = overallStats.latencies;
    const overallAvg =
      overallLatencies.length > 0
        ? overallLatencies.reduce((a, b) => a + b, 0) / overallLatencies.length
        : 0;
    const overallAvgRequestBytes =
      overallStats.total > 0 ? overallStats.requestBytesTotal / overallStats.total : 0;
    const overallAvgResponseBytes =
      overallStats.total > 0 ? overallStats.responseBytesTotal / overallStats.total : 0;

    metrics.push(
      {
        name: 'total_health_checks',
        value: totalChecks,
        unit: 'count',
        description: 'Total health checks across all services',
      },
      {
        name: 'overall_health_rate',
        value: Number((overallHealthRate * 100).toFixed(2)),
        unit: 'percent',
        description: 'Overall health check success rate',
      },
      {
        name: 'overall_avg_latency',
        value: Number(overallAvg.toFixed(2)),
        unit: 'ms',
        description: 'Average health check latency across all services',
      },
      {
        name: 'overall_avg_request_bytes',
        value: Number(overallAvgRequestBytes.toFixed(2)),
        unit: 'bytes',
        description: 'Average request size across all health checks',
      },
      {
        name: 'overall_max_request_bytes',
        value: overallStats.requestBytesMax,
        unit: 'bytes',
        description: 'Maximum request size across all health checks',
      },
      {
        name: 'overall_avg_response_bytes',
        value: Number(overallAvgResponseBytes.toFixed(2)),
        unit: 'bytes',
        description: 'Average response size across all health checks',
      },
      {
        name: 'overall_max_response_bytes',
        value: overallStats.responseBytesMax,
        unit: 'bytes',
        description: 'Maximum response size across all health checks',
      }
    );

    let status: 'passed' | 'failed' | 'skipped' = 'passed';

    if (config.thresholds.maxErrorRate && 1 - overallHealthRate > config.thresholds.maxErrorRate) {
      status = 'failed';
    }

    const result = this.createBaseResult(config, startTime, endTime, duration, status);
    result.metrics = metrics;
    result.metadata = {
      services: services.map((s) => s.name),
      totalChecks,
      healthyChecks,
      failedChecks: totalChecks - healthyChecks,
    };

    this.log(`Health check benchmark complete: ${healthyChecks}/${totalChecks} checks successful`);

    return result;
  }

  private async healthCheckWorker(
    workerId: number,
    warmupEnd: number,
    testEnd: number,
    services: { name: string; url: string }[],
    perServiceStats: Map<string, HealthCheckStats>,
    overallStats: OverallHealthStats,
    httpLimiter: ConcurrencyLimiter,
    httpBatchSize: number
  ): Promise<void> {
    while (Date.now() < testEnd) {
      const isWarmup = Date.now() < warmupEnd;

      for (let offset = 0; offset < services.length; offset += httpBatchSize) {
        const batch = services.slice(offset, offset + httpBatchSize);
        await Promise.all(
          batch.map((service) =>
            this.performHealthCheck(service, isWarmup, perServiceStats, overallStats, httpLimiter)
          )
        );
      }

      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  private async performHealthCheck(
    service: { name: string; url: string },
    isWarmup: boolean,
    perServiceStats: Map<string, HealthCheckStats>,
    overallStats: OverallHealthStats,
    httpLimiter: ConcurrencyLimiter
  ): Promise<void> {
    const timestamp = Date.now();
    const stats = perServiceStats.get(service.name);

    if (!stats) return;

    const requestBytes = 0;

    try {
      const result = await httpLimiter.run(async () => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);

        try {
          const response = await fetch(`${service.url}/health`, {
            method: 'GET',
            signal: controller.signal,
          });

          const bodyText = await response.text();
          const responseBytes = textByteLength(bodyText);
          clearTimeout(timeoutId);

          return { response, bodyText, responseBytes };
        } finally {
          clearTimeout(timeoutId);
        }
      });

      const responseTimeMs = Date.now() - timestamp;

      if (!isWarmup) {
        const isHealthy =
          result.response.ok &&
          (() => {
            try {
              const data = JSON.parse(result.bodyText) as { status?: string };
              return data.status === 'healthy' || data.status === 'ok';
            } catch {
              return false;
            }
          })();

        stats.total++;
        stats.latencies.push(responseTimeMs);
        overallStats.total++;
        overallStats.latencies.push(responseTimeMs);

        stats.requestBytesTotal += requestBytes;
        stats.responseBytesTotal += result.responseBytes;
        stats.requestBytesMax = Math.max(stats.requestBytesMax, requestBytes);
        stats.responseBytesMax = Math.max(stats.responseBytesMax, result.responseBytes);
        overallStats.requestBytesTotal += requestBytes;
        overallStats.responseBytesTotal += result.responseBytes;
        overallStats.requestBytesMax = Math.max(overallStats.requestBytesMax, requestBytes);
        overallStats.responseBytesMax = Math.max(
          overallStats.responseBytesMax,
          result.responseBytes
        );

        if (isHealthy) {
          stats.healthy++;
          overallStats.healthy++;
        }
      }
    } catch {
      if (!isWarmup) {
        const responseTimeMs = Date.now() - timestamp;
        stats.total++;
        stats.latencies.push(responseTimeMs);
        overallStats.total++;
        overallStats.latencies.push(responseTimeMs);

        stats.requestBytesTotal += requestBytes;
        stats.requestBytesMax = Math.max(stats.requestBytesMax, requestBytes);
        overallStats.requestBytesTotal += requestBytes;
        overallStats.requestBytesMax = Math.max(overallStats.requestBytesMax, requestBytes);
      }
    }
  }
}
