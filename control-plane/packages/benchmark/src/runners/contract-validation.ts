import type { BenchmarkConfig, BenchmarkResult, BenchmarkMetric } from '../contracts/index.js';
import { BenchmarkRunner } from './base-runner.js';
import {
  JobRequest,
  JobResponse,
  TruthAssertion,
  TruthQuery,
  ErrorEnvelope,
} from '@controlplane/contracts';

interface ValidationMetrics {
  schema: string;
  iterations: number;
  totalTimeMs: number;
  successCount: number;
  failureCount: number;
  errors: Error[];
}

interface ValidationDataPool {
  jobRequests: unknown[];
  jobResponses: unknown[];
  truthAssertions: unknown[];
  truthQueries: unknown[];
  errorEnvelopes: unknown[];
  complexNested: unknown[];
}

export class ContractValidationRunner extends BenchmarkRunner {
  async run(config: BenchmarkConfig): Promise<BenchmarkResult> {
    const startTime = new Date().toISOString();
    const startTimestamp = Date.now();

    this.log(`Starting contract validation benchmark: ${config.name}`);

    const iterationCount = config.iterations || 10000;
    const warmupIterations = Math.floor(iterationCount * 0.1);

    this.log(`Warmup: ${warmupIterations} iterations, Test: ${iterationCount} iterations`);

    const poolSize = Math.max(1, Math.min(iterationCount, 100));
    const dataPool = this.createValidationDataPool(poolSize);

    await this.warmup(warmupIterations, dataPool.jobRequests);

    const metrics: ValidationMetrics[] = [];

    metrics.push(await this.benchmarkJobRequestValidation(iterationCount, dataPool.jobRequests));
    metrics.push(await this.benchmarkJobResponseValidation(iterationCount, dataPool.jobResponses));
    metrics.push(
      await this.benchmarkTruthAssertionValidation(iterationCount, dataPool.truthAssertions)
    );
    metrics.push(await this.benchmarkTruthQueryValidation(iterationCount, dataPool.truthQueries));
    metrics.push(
      await this.benchmarkErrorEnvelopeValidation(iterationCount, dataPool.errorEnvelopes)
    );
    metrics.push(
      await this.benchmarkComplexNestedValidation(iterationCount, dataPool.complexNested)
    );

    const endTimestamp = Date.now();
    const endTime = new Date().toISOString();
    const duration = endTimestamp - startTimestamp;

    const benchmarkMetrics: BenchmarkMetric[] = [];

    for (const metric of metrics) {
      const avgTime = metric.totalTimeMs / metric.iterations;
      const throughput = metric.iterations / (metric.totalTimeMs / 1000);
      const successRate = metric.iterations > 0 ? metric.successCount / metric.iterations : 0;

      benchmarkMetrics.push(
        {
          name: `${metric.schema}_avg_time`,
          value: Number(avgTime.toFixed(4)),
          unit: 'ms',
          description: `Average validation time for ${metric.schema}`,
        },
        {
          name: `${metric.schema}_throughput`,
          value: Number(throughput.toFixed(2)),
          unit: 'ops',
          description: `Validations per second for ${metric.schema}`,
        },
        {
          name: `${metric.schema}_total_time`,
          value: Number(metric.totalTimeMs.toFixed(2)),
          unit: 'ms',
          description: `Total validation time for ${metric.schema}`,
        },
        {
          name: `${metric.schema}_success_rate`,
          value: Number((successRate * 100).toFixed(2)),
          unit: 'percent',
          description: `Validation success rate for ${metric.schema}`,
        }
      );
    }

    const totalValidations = metrics.reduce((sum, m) => sum + m.iterations, 0);
    const totalTime = metrics.reduce((sum, m) => sum + m.totalTimeMs, 0);
    const overallThroughput = totalValidations / (totalTime / 1000);

    benchmarkMetrics.push(
      {
        name: 'total_validations',
        value: totalValidations,
        unit: 'count',
        description: 'Total number of schema validations performed',
      },
      {
        name: 'overall_throughput',
        value: Number(overallThroughput.toFixed(2)),
        unit: 'ops',
        description: 'Overall validations per second across all schemas',
      },
      {
        name: 'schemas_tested',
        value: metrics.length,
        unit: 'count',
        description: 'Number of different schemas tested',
      }
    );

    let status: 'passed' | 'failed' | 'skipped' = 'passed';
    const allSuccess = metrics.every((m) => m.failureCount === 0);
    if (!allSuccess) {
      status = 'failed';
    }

    const result = this.createBaseResult(config, startTime, endTime, duration, status);
    result.metrics = benchmarkMetrics;
    result.metadata = {
      iterationCount,
      warmupIterations,
      schemas: metrics.map((m) => m.schema),
    };

    this.log(
      `Contract validation benchmark complete: ${totalValidations} validations at ${overallThroughput.toFixed(2)} ops/sec`
    );

    return result;
  }

  private async warmup(iterations: number, dataPool: unknown[]): Promise<void> {
    const poolSize = dataPool.length;
    for (let i = 0; i < iterations; i++) {
      JobRequest.safeParse(dataPool[i % poolSize]);
    }
  }

  private async benchmarkJobRequestValidation(
    iterations: number,
    dataPool: unknown[]
  ): Promise<ValidationMetrics> {
    const metrics: ValidationMetrics = {
      schema: 'JobRequest',
      iterations: 0,
      totalTimeMs: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    const start = Date.now();

    const poolSize = dataPool.length;

    for (let i = 0; i < iterations; i++) {
      const result = JobRequest.safeParse(dataPool[i % poolSize]);

      metrics.iterations++;
      if (result.success) {
        metrics.successCount++;
      } else {
        metrics.failureCount++;
      }
    }

    metrics.totalTimeMs = Date.now() - start;
    return metrics;
  }

  private async benchmarkJobResponseValidation(
    iterations: number,
    dataPool: unknown[]
  ): Promise<ValidationMetrics> {
    const metrics: ValidationMetrics = {
      schema: 'JobResponse',
      iterations: 0,
      totalTimeMs: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    const start = Date.now();

    const poolSize = dataPool.length;

    for (let i = 0; i < iterations; i++) {
      const result = JobResponse.safeParse(dataPool[i % poolSize]);

      metrics.iterations++;
      if (result.success) {
        metrics.successCount++;
      } else {
        metrics.failureCount++;
      }
    }

    metrics.totalTimeMs = Date.now() - start;
    return metrics;
  }

  private async benchmarkTruthAssertionValidation(
    iterations: number,
    dataPool: unknown[]
  ): Promise<ValidationMetrics> {
    const metrics: ValidationMetrics = {
      schema: 'TruthAssertion',
      iterations: 0,
      totalTimeMs: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    const start = Date.now();

    const poolSize = dataPool.length;

    for (let i = 0; i < iterations; i++) {
      const result = TruthAssertion.safeParse(dataPool[i % poolSize]);

      metrics.iterations++;
      if (result.success) {
        metrics.successCount++;
      } else {
        metrics.failureCount++;
      }
    }

    metrics.totalTimeMs = Date.now() - start;
    return metrics;
  }

  private async benchmarkTruthQueryValidation(
    iterations: number,
    dataPool: unknown[]
  ): Promise<ValidationMetrics> {
    const metrics: ValidationMetrics = {
      schema: 'TruthQuery',
      iterations: 0,
      totalTimeMs: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    const start = Date.now();

    const poolSize = dataPool.length;

    for (let i = 0; i < iterations; i++) {
      const result = TruthQuery.safeParse(dataPool[i % poolSize]);

      metrics.iterations++;
      if (result.success) {
        metrics.successCount++;
      } else {
        metrics.failureCount++;
      }
    }

    metrics.totalTimeMs = Date.now() - start;
    return metrics;
  }

  private async benchmarkErrorEnvelopeValidation(
    iterations: number,
    dataPool: unknown[]
  ): Promise<ValidationMetrics> {
    const metrics: ValidationMetrics = {
      schema: 'ErrorEnvelope',
      iterations: 0,
      totalTimeMs: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    const start = Date.now();

    const poolSize = dataPool.length;

    for (let i = 0; i < iterations; i++) {
      const result = ErrorEnvelope.safeParse(dataPool[i % poolSize]);

      metrics.iterations++;
      if (result.success) {
        metrics.successCount++;
      } else {
        metrics.failureCount++;
      }
    }

    metrics.totalTimeMs = Date.now() - start;
    return metrics;
  }

  private async benchmarkComplexNestedValidation(
    iterations: number,
    dataPool: unknown[]
  ): Promise<ValidationMetrics> {
    const metrics: ValidationMetrics = {
      schema: 'ComplexNested',
      iterations: 0,
      totalTimeMs: 0,
      successCount: 0,
      failureCount: 0,
      errors: [],
    };

    const start = Date.now();

    const poolSize = dataPool.length;

    for (let i = 0; i < iterations; i++) {
      const result = JobRequest.safeParse(dataPool[i % poolSize]);

      metrics.iterations++;
      if (result.success) {
        metrics.successCount++;
      } else {
        metrics.failureCount++;
      }
    }

    metrics.totalTimeMs = Date.now() - start;
    return metrics;
  }

  private createValidationDataPool(poolSize: number): ValidationDataPool {
    const baseTimestamp = Date.now();
    const ids = this.buildDataPool(poolSize, () => crypto.randomUUID());
    const timestamps = this.buildDataPool(poolSize, (index) =>
      new Date(baseTimestamp + index * 1000).toISOString()
    );

    const jobRequests = this.buildDataPool(poolSize, (index) =>
      this.generateJobRequest(index, ids[index], timestamps[index])
    );
    const jobResponses = this.buildDataPool(poolSize, (index) =>
      this.generateJobResponse(index, jobRequests[index], ids[index], timestamps[index])
    );
    const truthAssertions = this.buildDataPool(poolSize, (index) =>
      this.generateTruthAssertion(index, ids[index], timestamps[index])
    );
    const truthQueries = this.buildDataPool(poolSize, (index) => this.generateTruthQuery(index));
    const errorEnvelopes = this.buildDataPool(poolSize, (index) =>
      this.generateErrorEnvelope(index, ids[index], timestamps[index])
    );
    const complexNested = this.buildDataPool(poolSize, (index) =>
      this.generateComplexNested(jobRequests[index], timestamps[index], index)
    );

    return {
      jobRequests,
      jobResponses,
      truthAssertions,
      truthQueries,
      errorEnvelopes,
      complexNested,
    };
  }

  private buildDataPool<T>(poolSize: number, factory: (index: number) => T): T[] {
    const pool = new Array<T>(poolSize);
    for (let i = 0; i < poolSize; i++) {
      pool[i] = factory(i);
    }
    return pool;
  }

  private generateJobRequest(index: number, id: string, timestamp: string) {
    return {
      id,
      type: 'benchmark.job',
      priority: 50,
      payload: {
        type: 'benchmark',
        version: '1.0.0',
        data: { test: true, index: index % 1000 },
        options: {},
      },
      metadata: {
        source: 'benchmark',
        tags: ['test', 'benchmark'],
        createdAt: timestamp,
      },
      retryPolicy: {
        maxRetries: 3,
        backoffMs: 1000,
        maxBackoffMs: 30000,
        backoffMultiplier: 2,
        retryableCategories: [],
        nonRetryableCategories: [],
      },
      timeoutMs: 30000,
    };
  }

  private generateJobResponse(
    index: number,
    request: ReturnType<typeof this.generateJobRequest>,
    id: string,
    timestamp: string
  ) {
    return {
      id,
      status: 'completed',
      request,
      result: {
        success: true,
        data: { result: 'success' },
        metadata: {
          completedAt: timestamp,
          durationMs: 1200 + (index % 250),
          attempts: 1 + (index % 2),
        },
      },
      updatedAt: timestamp,
    };
  }

  private generateTruthAssertion(index: number, id: string, timestamp: string) {
    return {
      id,
      subject: `benchmark-${index % 100}`,
      predicate: 'benchmark.test',
      object: { data: 'test', index: index % 1000 },
      confidence: 1.0,
      timestamp,
      source: 'benchmark',
      metadata: {},
    };
  }

  private generateTruthQuery(index: number) {
    return {
      id: `benchmark-query-${index}`,
      pattern: {
        subject: `benchmark-${index % 100}`,
        predicate: 'benchmark.test',
      },
      filters: {},
      limit: 10,
      offset: 0,
    };
  }

  private generateErrorEnvelope(index: number, id: string, timestamp: string) {
    return {
      id,
      timestamp,
      category: 'RUNTIME_ERROR',
      severity: 'error',
      code: 'BENCHMARK_ERROR',
      message: `Benchmark test error ${index}`,
      details: [],
      service: 'benchmark',
      retryable: true,
      contractVersion: { major: 1, minor: 0, patch: 0 },
    };
  }

  private generateComplexNested(
    baseRequest: ReturnType<typeof this.generateJobRequest>,
    timestamp: string,
    index: number
  ) {
    return {
      ...baseRequest,
      payload: {
        type: 'complex',
        version: '1.0.0',
        data: {
          nested: {
            deeply: {
              nested: {
                data: Array.from({ length: 10 }, (_, i) => ({
                  id: i,
                  value: `item-${index}-${i}`,
                  metadata: {
                    created: timestamp,
                    tags: ['tag1', 'tag2', 'tag3'],
                  },
                })),
              },
            },
          },
        },
        options: {
          complex: true,
          retry: 3,
          timeout: 5000,
          nestedOptions: {
            level1: {
              level2: {
                level3: 'deep-value',
              },
            },
          },
        },
      },
    };
  }
}
