/**
 * Benchmark scenario definitions for ControlPlane orchestration system.
 *
 * Each scenario defines:
 * - What to measure
 * - How long to run
 * - Expected resource requirements
 * - Success criteria
 */

export interface BenchmarkScenario {
  id: string;
  name: string;
  description: string;
  duration: number; // seconds
  warmupDuration: number; // seconds
  iterations: number;
  metrics: string[];
  config: Record<string, unknown>;
}

export interface LatencyConfig extends Record<string, unknown> {
  concurrentJobs: number;
  jobType: string;
  jobPayload: Record<string, unknown>;
  pollingInterval: number;
  maxPollAttempts: number;
}

export interface DegradedConfig extends Record<string, unknown> {
  failureType: 'runner-down' | 'truthcore-down' | 'network-partition' | 'slow-runner';
  failureDuration: number; // seconds
  jobRate: number; // jobs per second
  expectedBehavior: string;
}

export interface ScaleConfig extends Record<string, unknown> {
  runnerCounts: number[];
  jobTypes: string[];
  jobsPerRunner: number;
  jobComplexity: 'light' | 'medium' | 'heavy' | 'mixed';
}

// Orchestration Latency Scenarios
export const latencyScenarios: BenchmarkScenario[] = [
  {
    id: 'latency-light',
    name: 'Light Load - 10 Concurrent Jobs',
    description: 'Baseline latency measurement with minimal concurrency',
    duration: 60,
    warmupDuration: 10,
    iterations: 3, // 3 runs for reproducibility
    metrics: ['submitLatency', 'queueLatency', 'executionLatency', 'totalLatency'],
    config: {
      concurrentJobs: 10,
      jobType: 'test.echo',
      jobPayload: { type: 'echo', data: { message: 'benchmark' } },
      pollingInterval: 100,
      maxPollAttempts: 100,
    } as LatencyConfig,
  },
  {
    id: 'latency-medium',
    name: 'Medium Load - 100 Concurrent Jobs',
    description: 'Typical production load simulation',
    duration: 120,
    warmupDuration: 15,
    iterations: 3,
    metrics: ['submitLatency', 'queueLatency', 'executionLatency', 'totalLatency', 'queueDepth'],
    config: {
      concurrentJobs: 100,
      jobType: 'test.compute',
      jobPayload: { type: 'compute', data: { iterations: 1000 } },
      pollingInterval: 100,
      maxPollAttempts: 150,
    } as LatencyConfig,
  },
  {
    id: 'latency-heavy',
    name: 'Heavy Load - 500 Concurrent Jobs',
    description: 'Stress test approaching system limits',
    duration: 180,
    warmupDuration: 20,
    iterations: 3,
    metrics: [
      'submitLatency',
      'queueLatency',
      'executionLatency',
      'totalLatency',
      'queueDepth',
      'errorRate',
    ],
    config: {
      concurrentJobs: 500,
      jobType: 'test.io',
      jobPayload: { type: 'io', data: { operations: 100 } },
      pollingInterval: 100,
      maxPollAttempts: 200,
    } as LatencyConfig,
  },
];

// Degraded Mode Scenarios
export const degradedScenarios: BenchmarkScenario[] = [
  {
    id: 'degraded-runner',
    name: 'Runner Unavailable',
    description: 'All runners offline - jobs should queue and retry',
    duration: 90,
    warmupDuration: 5,
    iterations: 3,
    metrics: ['queueDepth', 'retryAttempts', 'errorRate', 'recoveryTime', 'circuitBreakerTrips'],
    config: {
      failureType: 'runner-down',
      failureDuration: 30,
      jobRate: 10, // 10 jobs/sec
      expectedBehavior: 'Jobs queue with exponential backoff, no hard failures',
    } as DegradedConfig,
  },
  {
    id: 'degraded-truthcore',
    name: 'TruthCore Unavailable',
    description: 'Source of truth offline - graceful degradation',
    duration: 90,
    warmupDuration: 5,
    iterations: 3,
    metrics: ['circuitBreakerTrips', 'fallbackRate', 'errorRate', 'recoveryTime'],
    config: {
      failureType: 'truthcore-down',
      failureDuration: 30,
      jobRate: 10,
      expectedBehavior: 'Circuit breaker opens, jobs continue with reduced guarantees',
    } as DegradedConfig,
  },
  {
    id: 'degraded-slow-runner',
    name: 'Slow Runner Response',
    description: 'Runner takes 5x normal time - timeout handling',
    duration: 120,
    warmupDuration: 10,
    iterations: 3,
    metrics: ['timeoutRate', 'retryAttempts', 'queueDepth', 'avgCompletionTime'],
    config: {
      failureType: 'slow-runner',
      failureDuration: 60,
      jobRate: 5,
      expectedBehavior: 'Jobs timeout and retry, circuit breaker may trip',
    } as DegradedConfig,
  },
];

// Scale-Out Scenarios
export const scaleScenarios: BenchmarkScenario[] = [
  {
    id: 'scale-1-runner',
    name: 'Baseline - Single Runner',
    description: 'Single runner throughput baseline',
    duration: 60,
    warmupDuration: 10,
    iterations: 3,
    metrics: ['throughput', 'latencyP50', 'latencyP95', 'cpuUtilization', 'memoryUtilization'],
    config: {
      runnerCounts: [1],
      jobTypes: ['test.compute', 'test.io', 'test.echo'],
      jobsPerRunner: 50,
      jobComplexity: 'medium',
    } as ScaleConfig,
  },
  {
    id: 'scale-3-runners',
    name: 'Scale Out - 3 Runners',
    description: 'Throughput with 3 concurrent runners',
    duration: 90,
    warmupDuration: 15,
    iterations: 3,
    metrics: ['throughput', 'latencyP50', 'latencyP95', 'scalingEfficiency', 'resourceUtilization'],
    config: {
      runnerCounts: [3],
      jobTypes: ['test.compute', 'test.io', 'test.echo'],
      jobsPerRunner: 50,
      jobComplexity: 'medium',
    } as ScaleConfig,
  },
  {
    id: 'scale-5-runners',
    name: 'Scale Out - 5 Runners',
    description: 'Maximum tested runner count',
    duration: 120,
    warmupDuration: 20,
    iterations: 3,
    metrics: [
      'throughput',
      'latencyP50',
      'latencyP95',
      'scalingEfficiency',
      'coordinationOverhead',
    ],
    config: {
      runnerCounts: [5],
      jobTypes: ['test.compute', 'test.io', 'test.echo'],
      jobsPerRunner: 50,
      jobComplexity: 'medium',
    } as ScaleConfig,
  },
  {
    id: 'scale-mixed',
    name: 'Mixed Workload Scaling',
    description: 'Different job types with varying complexity',
    duration: 180,
    warmupDuration: 20,
    iterations: 3,
    metrics: ['throughputByType', 'latencyByType', 'resourceUtilization', 'fairnessIndex'],
    config: {
      runnerCounts: [1, 3, 5],
      jobTypes: ['test.light', 'test.medium', 'test.heavy'],
      jobsPerRunner: 30,
      jobComplexity: 'mixed',
    } as ScaleConfig,
  },
];

export const allScenarios = [...latencyScenarios, ...degradedScenarios, ...scaleScenarios];

export function getScenarioById(id: string): BenchmarkScenario | undefined {
  return allScenarios.find((s) => s.id === id);
}

export function getScenariosByCategory(
  category: 'latency' | 'degraded' | 'scale'
): BenchmarkScenario[] {
  switch (category) {
    case 'latency':
      return latencyScenarios;
    case 'degraded':
      return degradedScenarios;
    case 'scale':
      return scaleScenarios;
    default:
      return [];
  }
}
