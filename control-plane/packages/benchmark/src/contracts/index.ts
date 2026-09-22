import { z } from 'zod';

export const BenchmarkMetric = z.object({
  name: z.string(),
  value: z.number(),
  unit: z.enum(['ms', 'ops', 'req/s', 'bytes', 'percent', 'count']),
  description: z.string(),
});
export type BenchmarkMetric = z.infer<typeof BenchmarkMetric>;

export const BenchmarkStatistics = z.object({
  min: z.number(),
  max: z.number(),
  mean: z.number(),
  median: z.number(),
  p50: z.number(),
  p95: z.number(),
  p99: z.number(),
  stdDev: z.number(),
  sampleCount: z.number().int().positive(),
});
export type BenchmarkStatistics = z.infer<typeof BenchmarkStatistics>;

export const BenchmarkResult = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  suite: z.enum([
    'throughput',
    'latency',
    'truthcore',
    'runner',
    'contract',
    'queue',
    'health',
    'all',
  ]),
  status: z.enum(['passed', 'failed', 'skipped']),
  durationMs: z.number().nonnegative(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  metrics: z.array(BenchmarkMetric),
  statistics: BenchmarkStatistics.optional(),
  error: z.string().optional(),
  metadata: z.record(z.unknown()).default({}),
});
export type BenchmarkResult = z.infer<typeof BenchmarkResult>;

export const BenchmarkConfig = z.object({
  name: z.string(),
  description: z.string(),
  suite: z.enum([
    'throughput',
    'latency',
    'truthcore',
    'runner',
    'contract',
    'queue',
    'health',
    'all',
  ]),
  durationMs: z.number().positive().default(30000),
  warmupMs: z.number().nonnegative().default(5000),
  concurrency: z.number().int().positive().default(10),
  targetRps: z.number().positive().optional(),
  iterations: z.number().int().positive().optional(),
  percentiles: z
    .object({
      mode: z.enum(['exact', 'histogram']).default('exact'),
      sampleThreshold: z.number().int().positive().default(10_000),
      histogramBins: z.number().int().positive().default(200),
    })
    .default({}),
  http: z
    .object({
      concurrencyLimit: z.number().int().positive().optional(),
      batchSize: z.number().int().positive().default(1),
    })
    .default({}),
  thresholds: z
    .object({
      minThroughput: z.number().optional(),
      maxLatencyMs: z.number().optional(),
      maxErrorRate: z.number().min(0).max(1).optional(),
    })
    .default({}),
});
export type BenchmarkConfig = z.infer<typeof BenchmarkConfig>;

export const BenchmarkSuite = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string(),
  configs: z.array(BenchmarkConfig),
  globalConfig: z.object({
    truthcoreUrl: z.string().url().default('http://localhost:3001'),
    jobforgeUrl: z.string().url().default('http://localhost:3002'),
    runnerUrl: z.string().url().default('http://localhost:3003'),
    outputFormat: z.enum(['json', 'table', 'markdown']).default('table'),
    outputPath: z.string().optional(),
    verbose: z.boolean().default(false),
  }),
});
export type BenchmarkSuite = z.infer<typeof BenchmarkSuite>;

export const BenchmarkReport = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  environment: z.object({
    nodeVersion: z.string(),
    platform: z.string(),
    arch: z.string(),
    cpus: z.number().int(),
    totalMemoryMb: z.number().int(),
  }),
  suite: BenchmarkSuite,
  results: z.array(BenchmarkResult),
  summary: z.object({
    total: z.number().int(),
    passed: z.number().int(),
    failed: z.number().int(),
    skipped: z.number().int(),
    totalDurationMs: z.number().nonnegative(),
  }),
});
export type BenchmarkReport = z.infer<typeof BenchmarkReport>;

export const LoadTestConfig = z.object({
  targetUrl: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).default('GET'),
  headers: z.record(z.string()).default({}),
  body: z.unknown().optional(),
  concurrency: z.number().int().positive().default(10),
  durationMs: z.number().positive().default(30000),
  rampUpMs: z.number().nonnegative().default(5000),
  cooldownMs: z.number().nonnegative().default(5000),
});
export type LoadTestConfig = z.infer<typeof LoadTestConfig>;

export const LoadTestResult = z.object({
  config: LoadTestConfig,
  totalRequests: z.number().int().nonnegative(),
  successfulRequests: z.number().int().nonnegative(),
  failedRequests: z.number().int().nonnegative(),
  errorRate: z.number().min(0).max(1),
  requestsPerSecond: z.number().nonnegative(),
  latencies: z.object({
    min: z.number(),
    max: z.number(),
    mean: z.number(),
    p50: z.number(),
    p95: z.number(),
    p99: z.number(),
    stdDev: z.number(),
  }),
  statusCodes: z.record(z.number().int()),
  errors: z.array(
    z.object({
      message: z.string(),
      count: z.number().int(),
      category: z.string(),
    })
  ),
});
export type LoadTestResult = z.infer<typeof LoadTestResult>;
