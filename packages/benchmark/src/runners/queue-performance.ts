import type { BenchmarkConfig, BenchmarkMetric, BenchmarkResult } from '../contracts/index.js';
import { BenchmarkRunner } from './base-runner.js';
import { ConcurrencyLimiter } from '../utils/concurrency.js';
import { textByteLength } from '../utils/bytes.js';
import { computeDistributionStats } from '../utils/percentiles.js';

interface QueueMetrics {
  operation: 'enqueue' | 'dequeue' | 'peek' | 'depth';
  timestamp: number;
  durationMs: number;
  success: boolean;
  queueDepth?: number;
  requestBytes?: number;
  responseBytes?: number;
  error?: Error;
}

export class QueuePerformanceRunner extends BenchmarkRunner {
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    this.log(`Starting queue performance benchmark: ${config.name}`);
    this.log(`Duration: ${config.durationMs}ms, Concurrency: ${config.concurrency}`);

    const warmupEnd = startTimestamp + config.warmupMs;
    const testEnd = startTimestamp + config.durationMs;

    const enqueueMetrics: QueueMetrics[] = [];
    const dequeueMetrics: QueueMetrics[] = [];
    const depthMetrics: QueueMetrics[] = [];

    await this.clearQueues();

    const enqueueWorkers: Promise<void>[] = [];
    const dequeueWorkers: Promise<void>[] = [];
    const monitorWorkers: Promise<void>[] = [];

    const enqueueConcurrency = Math.max(1, Math.floor(config.concurrency * 0.6));
    const dequeueConcurrency = config.concurrency - enqueueConcurrency;
    const httpConcurrencyLimit = config.http?.concurrencyLimit ?? config.concurrency;
    const httpBatchSize = Math.max(1, config.http?.batchSize ?? 1);
    const httpLimiter = new ConcurrencyLimiter(httpConcurrencyLimit);

    for (let i = 0; i < enqueueConcurrency; i++) {
      enqueueWorkers.push(
        this.enqueueWorker(i, warmupEnd, testEnd, enqueueMetrics, httpLimiter, httpBatchSize)
      );
    }

    for (let i = 0; i < dequeueConcurrency; i++) {
      dequeueWorkers.push(
        this.dequeueWorker(i, warmupEnd, testEnd, dequeueMetrics, httpLimiter, httpBatchSize)
      );
    }

    monitorWorkers.push(this.monitorQueueDepth(warmupEnd, testEnd, depthMetrics, httpLimiter));

    await Promise.all([...enqueueWorkers, ...dequeueWorkers, ...monitorWorkers]);

    const endTimestamp = Date.now();
    const endTime = new Date().toISOString();
    const duration = endTimestamp - startTimestamp;

    const successfulEnqueues = enqueueMetrics.filter((m) => m.success);
    const successfulDequeues = dequeueMetrics.filter((m) => m.success);

    const enqueueMetrics_calculated = this.calculateOperationMetrics(
      enqueueMetrics,
      'enqueue',
      config.percentiles
    );
    const dequeueMetrics_calculated = this.calculateOperationMetrics(
      dequeueMetrics,
      'dequeue',
      config.percentiles
    );

    const queueDepthStats = this.calculateQueueDepthStats(depthMetrics, config.percentiles);

    const totalMessages = successfulEnqueues.length;
    const processedMessages = successfulDequeues.length;
    const throughput = totalMessages / (duration / 1000);
    const processingRate = processedMessages / (duration / 1000);

    const metrics: BenchmarkMetric[] = [
      {
        name: 'total_messages_enqueued',
        value: totalMessages,
        unit: 'count',
        description: 'Total messages successfully enqueued',
      },
      {
        name: 'total_messages_dequeued',
        value: processedMessages,
        unit: 'count',
        description: 'Total messages successfully dequeued/processed',
      },
      {
        name: 'enqueue_throughput',
        value: Number(throughput.toFixed(2)),
        unit: 'req/s',
        description: 'Messages enqueued per second',
      },
      {
        name: 'dequeue_throughput',
        value: Number(processingRate.toFixed(2)),
        unit: 'req/s',
        description: 'Messages dequeued per second',
      },
      {
        name: 'processing_lag',
        value: totalMessages - processedMessages,
        unit: 'count',
        description: 'Messages remaining in queue (lag)',
      },
      ...enqueueMetrics_calculated,
      ...dequeueMetrics_calculated,
      ...queueDepthStats,
    ];

    const status: 'passed' | 'failed' | 'skipped' = 'passed';
    const lag = totalMessages - processedMessages;
    const lagRatio = totalMessages > 0 ? lag / totalMessages : 0;

    if (lagRatio > 0.1) {
      this.log(`Warning: Queue lag is ${(lagRatio * 100).toFixed(1)}%`);
    }

    const result = this.createBaseResult(config, startTime, endTime, duration, status);
    result.metrics = metrics;
    result.metadata = {
      totalEnqueued: totalMessages,
      totalDequeued: processedMessages,
      lag: totalMessages - processedMessages,
      enqueueWorkers: enqueueConcurrency,
      dequeueWorkers: dequeueConcurrency,
    };

    this.log(
      `Queue performance benchmark complete: ${totalMessages} enqueued, ${processedMessages} dequeued`
    );

    await this.clearQueues();

    return result;
  }

  private async clearQueues(): Promise<void> {
    this.log('Clearing queues...');
    try {
      await fetch(`${this.context.jobforgeUrl}/admin/queue/clear`, {
        method: 'POST',
      });
    } catch {
      this.log('Queue clear endpoint not available');
    }
  }

  private async enqueueWorker(
    workerId: number,
    warmupEnd: number,
    testEnd: number,
    metrics: QueueMetrics[],
    httpLimiter: ConcurrencyLimiter,
    httpBatchSize: number
  ): Promise<void> {
    let counter = 0;
    const headers = { 'Content-Type': 'application/json' };
    const tags = ['queue-test', `worker-${workerId}`];
    const basePayload = {
      id: '',
      type: 'benchmark.queue',
      priority: 50,
      payload: {
        type: 'benchmark',
        version: '1.0.0',
        data: {
          workerId,
          counter: 0,
          timestamp: 0,
        },
        options: {},
      },
      metadata: {
        source: 'benchmark',
        tags,
        createdAt: '',
      },
      timeoutMs: 30000,
    };

    while (Date.now() < testEnd) {
      const batch: Promise<void>[] = [];

      for (let i = 0; i < httpBatchSize && Date.now() < testEnd; i++) {
        const currentCounter = counter;
        counter += 1;
        batch.push(
          this.enqueueOnce(currentCounter, warmupEnd, metrics, headers, basePayload, httpLimiter)
        );
      }

      await Promise.all(batch);
    }
  }

  private async dequeueWorker(
    workerId: number,
    warmupEnd: number,
    testEnd: number,
    metrics: QueueMetrics[],
    httpLimiter: ConcurrencyLimiter,
    httpBatchSize: number
  ): Promise<void> {
    const headers = { 'Content-Type': 'application/json' };
    const body = JSON.stringify({
      workerId: `benchmark-worker-${workerId}`,
      capabilities: ['benchmark.queue'],
    });

    while (Date.now() < testEnd) {
      const batch: Promise<void>[] = [];

      for (let i = 0; i < httpBatchSize && Date.now() < testEnd; i++) {
        batch.push(this.dequeueOnce(warmupEnd, metrics, headers, body, httpLimiter));
      }

      await Promise.all(batch);
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
  }

  private async monitorQueueDepth(
    warmupEnd: number,
    testEnd: number,
    metrics: QueueMetrics[],
    httpLimiter: ConcurrencyLimiter
  ): Promise<void> {
    while (Date.now() < testEnd) {
      const isWarmup = Date.now() < warmupEnd;
      const timestamp = Date.now();

      try {
        const { response, bodyText, responseBytes } = await httpLimiter.run(async () => {
          const response = await fetch(`${this.context.jobforgeUrl}/admin/queue/stats`);
          const bodyText = await response.text();
          const responseBytes = textByteLength(bodyText);
          return { response, bodyText, responseBytes };
        });

        if (response.ok) {
          const data = JSON.parse(bodyText) as { pending?: number; queued?: number };
          const queueDepth = data.pending || data.queued || 0;

          if (!isWarmup) {
            metrics.push({
              operation: 'depth',
              timestamp,
              durationMs: Date.now() - timestamp,
              success: true,
              queueDepth,
              responseBytes,
            });
          }
        }
      } catch {
        // Ignore monitoring errors
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  private calculateOperationMetrics(
    metrics: QueueMetrics[],
    operation: string,
    percentiles: BenchmarkConfig['percentiles']
  ): BenchmarkMetric[] {
    const latencies: number[] = [];
    const requestBytes: number[] = [];
    const responseBytes: number[] = [];

    for (const metric of metrics) {
      if (metric.operation === operation && metric.success) {
        latencies.push(metric.durationMs);
        if (metric.requestBytes !== undefined) {
          requestBytes.push(metric.requestBytes);
        }
        if (metric.responseBytes !== undefined) {
          responseBytes.push(metric.responseBytes);
        }
      }
    }

    if (latencies.length === 0) return [];

    const latencyStats = computeDistributionStats(latencies, [50, 95, 99], percentiles);
    const p50 = latencyStats.percentiles[50] ?? 0;
    const p95 = latencyStats.percentiles[95] ?? 0;
    const p99 = latencyStats.percentiles[99] ?? 0;
    const sizeStats = this.calculateSizeStats(requestBytes, responseBytes);

    return [
      {
        name: `${operation}_min_latency`,
        value: latencyStats.min,
        unit: 'ms',
        description: `Minimum ${operation} latency`,
      },
      {
        name: `${operation}_max_latency`,
        value: latencyStats.max,
        unit: 'ms',
        description: `Maximum ${operation} latency`,
      },
      {
        name: `${operation}_avg_latency`,
        value: Number(latencyStats.mean.toFixed(2)),
        unit: 'ms',
        description: `Average ${operation} latency`,
      },
      {
        name: `${operation}_p50_latency`,
        value: p50,
        unit: 'ms',
        description: `50th percentile ${operation} latency`,
      },
      {
        name: `${operation}_p95_latency`,
        value: p95,
        unit: 'ms',
        description: `95th percentile ${operation} latency`,
      },
      {
        name: `${operation}_p99_latency`,
        value: p99,
        unit: 'ms',
        description: `99th percentile ${operation} latency`,
      },
      {
        name: `${operation}_avg_request_bytes`,
        value: Number(sizeStats.avgRequestBytes.toFixed(2)),
        unit: 'bytes',
        description: `Average request size for ${operation}`,
      },
      {
        name: `${operation}_max_request_bytes`,
        value: sizeStats.maxRequestBytes,
        unit: 'bytes',
        description: `Maximum request size for ${operation}`,
      },
      {
        name: `${operation}_avg_response_bytes`,
        value: Number(sizeStats.avgResponseBytes.toFixed(2)),
        unit: 'bytes',
        description: `Average response size for ${operation}`,
      },
      {
        name: `${operation}_max_response_bytes`,
        value: sizeStats.maxResponseBytes,
        unit: 'bytes',
        description: `Maximum response size for ${operation}`,
      },
    ];
  }

  private calculateQueueDepthStats(
    metrics: QueueMetrics[],
    percentiles: BenchmarkConfig['percentiles']
  ): BenchmarkMetric[] {
    const depthReadings: number[] = [];
    const responseBytes: number[] = [];

    for (const metric of metrics) {
      if (metric.operation === 'depth' && metric.queueDepth !== undefined) {
        depthReadings.push(metric.queueDepth);
        if (metric.responseBytes !== undefined) {
          responseBytes.push(metric.responseBytes);
        }
      }
    }

    if (depthReadings.length === 0) return [];

    const depthStats = computeDistributionStats(depthReadings, [50, 95], percentiles);
    const p50 = depthStats.percentiles[50] ?? 0;
    const p95 = depthStats.percentiles[95] ?? 0;
    const sizeStats = this.calculateSizeStats([], responseBytes);

    return [
      {
        name: 'queue_depth_min',
        value: depthStats.min,
        unit: 'count',
        description: 'Minimum queue depth observed',
      },
      {
        name: 'queue_depth_max',
        value: depthStats.max,
        unit: 'count',
        description: 'Maximum queue depth observed',
      },
      {
        name: 'queue_depth_avg',
        value: Number(depthStats.mean.toFixed(2)),
        unit: 'count',
        description: 'Average queue depth',
      },
      {
        name: 'queue_depth_p50',
        value: p50,
        unit: 'count',
        description: '50th percentile queue depth',
      },
      {
        name: 'queue_depth_p95',
        value: p95,
        unit: 'count',
        description: '95th percentile queue depth',
      },
      {
        name: 'queue_depth_avg_response_bytes',
        value: Number(sizeStats.avgResponseBytes.toFixed(2)),
        unit: 'bytes',
        description: 'Average response size for queue depth checks',
      },
      {
        name: 'queue_depth_max_response_bytes',
        value: sizeStats.maxResponseBytes,
        unit: 'bytes',
        description: 'Maximum response size for queue depth checks',
      },
    ];
  }

  private calculateSizeStats(
    requestBytes: number[],
    responseBytes: number[]
  ): {
    avgRequestBytes: number;
    maxRequestBytes: number;
    avgResponseBytes: number;
    maxResponseBytes: number;
  } {
    const requestTotal = requestBytes.reduce((sum, value) => sum + value, 0);
    const responseTotal = responseBytes.reduce((sum, value) => sum + value, 0);

    return {
      avgRequestBytes: requestBytes.length > 0 ? requestTotal / requestBytes.length : 0,
      maxRequestBytes: requestBytes.length > 0 ? Math.max(...requestBytes) : 0,
      avgResponseBytes: responseBytes.length > 0 ? responseTotal / responseBytes.length : 0,
      maxResponseBytes: responseBytes.length > 0 ? Math.max(...responseBytes) : 0,
    };
  }

  private async enqueueOnce(
    counter: number,
    warmupEnd: number,
    metrics: QueueMetrics[],
    headers: Record<string, string>,
    basePayload: {
      id: string;
      type: string;
      priority: number;
      payload: {
        type: string;
        version: string;
        data: {
          workerId: number;
          counter: number;
          timestamp: number;
        };
        options: Record<string, unknown>;
      };
      metadata: {
        source: string;
        tags: string[];
        createdAt: string;
      };
      timeoutMs: number;
    },
    httpLimiter: ConcurrencyLimiter
  ): Promise<void> {
    const isWarmup = Date.now() < warmupEnd;
    const timestamp = Date.now();

    const payload = structuredClone(basePayload);
    payload.id = crypto.randomUUID();
    payload.payload.data.counter = counter;
    payload.payload.data.timestamp = timestamp;
    payload.metadata.createdAt = new Date(timestamp).toISOString();

    const body = JSON.stringify(payload);
    const requestBytes = textByteLength(body);

    try {
      const { response, responseBytes } = await httpLimiter.run(async () => {
        const response = await fetch(`${this.context.jobforgeUrl}/jobs`, {
          method: 'POST',
          headers,
          body,
        });
        const responseText = await response.text();
        const responseBytes = textByteLength(responseText);
        return { response, responseBytes };
      });

      const durationMs = Date.now() - timestamp;

      if (!isWarmup) {
        metrics.push({
          operation: 'enqueue',
          timestamp,
          durationMs,
          success: response.ok,
          requestBytes,
          responseBytes,
          error: response.ok ? undefined : new Error(`HTTP ${response.status}`),
        });
      }
    } catch (error) {
      if (!isWarmup) {
        metrics.push({
          operation: 'enqueue',
          timestamp,
          durationMs: Date.now() - timestamp,
          success: false,
          requestBytes,
          responseBytes: 0,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }

  private async dequeueOnce(
    warmupEnd: number,
    metrics: QueueMetrics[],
    headers: Record<string, string>,
    body: string,
    httpLimiter: ConcurrencyLimiter
  ): Promise<void> {
    const isWarmup = Date.now() < warmupEnd;
    const timestamp = Date.now();
    const requestBytes = textByteLength(body);

    try {
      const { response, responseBytes } = await httpLimiter.run(async () => {
        const response = await fetch(`${this.context.jobforgeUrl}/admin/queue/next`, {
          method: 'POST',
          headers,
          body,
        });
        const responseText = await response.text();
        const responseBytes = textByteLength(responseText);
        return { response, responseBytes };
      });

      const durationMs = Date.now() - timestamp;

      if (!isWarmup) {
        if (response.ok) {
          metrics.push({
            operation: 'dequeue',
            timestamp,
            durationMs,
            success: true,
            requestBytes,
            responseBytes,
          });
        } else if (response.status !== 204) {
          metrics.push({
            operation: 'dequeue',
            timestamp,
            durationMs,
            success: false,
            requestBytes,
            responseBytes,
            error: new Error(`HTTP ${response.status}`),
          });
        }
      }
    } catch (error) {
      if (!isWarmup) {
        metrics.push({
          operation: 'dequeue',
          timestamp,
          durationMs: Date.now() - timestamp,
          success: false,
          requestBytes,
          responseBytes: 0,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }
  }
}
