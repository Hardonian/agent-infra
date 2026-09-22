/**
 * Benchmark result types and persistence.
 */

export interface LatencyMetrics {
  totalJobs: number;
  completedJobs: number;
  failedJobs: number;
  timeouts: number;
  totalDurationMs: number;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  throughputJobsPerSec: number;
  errorRate: number;
}

export interface DegradedMetrics {
  jobsSubmitted: number;
  jobsCompleted: number;
  jobsFailed: number;
  jobsTimedOut: number;
  queueDepth: number;
  retryAttempts: number;
  circuitBreakerTrips: number;
  errorRate: number;
  recoveryTimeMs: number;
  degradedPeriodMs: number;
}

export interface ScaleMetrics {
  runnerCount: number;
  totalJobs: number;
  completedJobs: number;
  totalDurationMs: number;
  throughputJobsPerSec: number;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  scalingEfficiency: number;
  cpuUtilization: number;
  memoryUtilization: number;
}

export interface BenchmarkResult {
  scenarioId: string;
  scenarioName: string;
  iteration: number;
  timestamp: string;
  durationMs: number;
  success: boolean;
  error?: string;
  metrics: LatencyMetrics | DegradedMetrics | ScaleMetrics | Record<string, number>;
}

import fs from 'fs/promises';
import path from 'path';

/**
 * Save benchmark results to disk.
 */
export async function saveResults(
  results: BenchmarkResult[],
  runDir: string,
  systemInfo: Record<string, unknown>
): Promise<void> {
  const data = {
    timestamp: new Date().toISOString(),
    systemInfo,
    results,
  };

  await fs.writeFile(path.join(runDir, 'results.json'), JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Generate a markdown report from benchmark results.
 */
export async function generateReport(
  results: BenchmarkResult[],
  runDir: string,
  systemInfo: Record<string, unknown>
): Promise<string> {
  const reportPath = path.join(runDir, 'report.md');

  const sections: string[] = [];

  // Header
  sections.push(`# ControlPlane Performance Benchmark Report`);
  sections.push(`**Generated:** ${new Date().toISOString()}`);
  sections.push('');

  // System Info
  sections.push(`## System Information`);
  sections.push(`- **Node Version:** ${systemInfo.nodeVersion}`);
  sections.push(`- **Platform:** ${systemInfo.platform} (${systemInfo.arch})`);
  sections.push(`- **CPUs:** ${systemInfo.cpus}`);
  sections.push(`- **Memory:** ${systemInfo.totalMemory}`);
  sections.push(
    `- **Load Average:** ${(systemInfo.loadAverage as number[]).map((l) => l.toFixed(2)).join(', ')}`
  );
  sections.push('');

  // Summary
  const total = results.length;
  const passed = results.filter((r) => r.success).length;
  const failed = total - passed;

  sections.push(`## Summary`);
  sections.push(`- **Total Runs:** ${total}`);
  sections.push(`- **Passed:** ${passed} ✓`);
  sections.push(`- **Failed:** ${failed} ${failed > 0 ? '✗' : ''}`);
  sections.push('');

  // Results by scenario
  const scenarios = [...new Set(results.map((r) => r.scenarioId))];

  for (const scenarioId of scenarios) {
    const scenarioResults = results.filter((r) => r.scenarioId === scenarioId);
    const first = scenarioResults[0];

    sections.push(`## ${first.scenarioName} (${scenarioId})`);
    sections.push('');

    for (const result of scenarioResults) {
      sections.push(`### Iteration ${result.iteration}`);
      sections.push(`- **Status:** ${result.success ? '✓ Passed' : '✗ Failed'}`);
      sections.push(`- **Duration:** ${result.durationMs}ms`);

      if (!result.success && result.error) {
        sections.push(`- **Error:** ${result.error}`);
      }

      // Metrics
      if (Object.keys(result.metrics).length > 0) {
        sections.push('');
        sections.push('**Metrics:**');
        sections.push('');
        sections.push('| Metric | Value |');
        sections.push('|--------|-------|');

        for (const [key, value] of Object.entries(result.metrics)) {
          const formattedValue =
            typeof value === 'number'
              ? Number.isInteger(value)
                ? value
                : value.toFixed(2)
              : String(value);
          sections.push(`| ${key} | ${formattedValue} |`);
        }
      }

      sections.push('');
    }

    // Aggregate stats
    if (scenarioResults.length > 1) {
      const durations = scenarioResults.map((r) => r.durationMs);
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const minDuration = Math.min(...durations);
      const maxDuration = Math.max(...durations);

      sections.push(`### Aggregate Statistics (${scenarioResults.length} runs)`);
      sections.push(`- **Average Duration:** ${avgDuration.toFixed(2)}ms`);
      sections.push(`- **Min Duration:** ${minDuration}ms`);
      sections.push(`- **Max Duration:** ${maxDuration}ms`);
      sections.push(
        `- **Variance:** ${(((maxDuration - minDuration) / avgDuration) * 100).toFixed(1)}%`
      );
      sections.push('');
    }
  }

  // Methodology
  sections.push(`## Methodology`);
  sections.push('');
  sections.push('### Latency Benchmarks');
  sections.push('- **Measurement:** Time from job submission to completion');
  sections.push('- **Concurrency:** Jobs submitted in parallel batches');
  sections.push('- **Polling:** Exponential backoff (100ms initial, max 2s)');
  sections.push('- **Iterations:** 3 runs per scenario (no cherry-picking)');
  sections.push('- **Warmup:** 10-20 seconds before measurement');
  sections.push('');

  sections.push('### Degraded Mode Benchmarks');
  sections.push('- **Failure Simulation:** Service stopped for defined duration');
  sections.push('- **Recovery Time:** Measured from service restart to full throughput');
  sections.push('- **Metrics:** Queue depth, retry attempts, circuit breaker state');
  sections.push('');

  sections.push('### Scale-Out Benchmarks');
  sections.push('- **Runner Counts:** 1, 3, 5 runners tested independently');
  sections.push('- **Job Mix:** Compute-bound, I/O-bound, and fast jobs');
  sections.push('- **Measurement:** Throughput (jobs/sec) and latency distribution');
  sections.push('');

  // Limitations
  sections.push(`## Limitations`);
  sections.push('- Results are from local development environment, not production');
  sections.push('- No cross-region latency (single machine)');
  sections.push('- Redis running locally, not distributed');
  sections.push('- Network is localhost (0.01ms), not realistic WAN latency');
  sections.push('- Tolerance: ±15% for latency, ±10% for throughput');
  sections.push('');

  const report = sections.join('\n');
  await fs.writeFile(reportPath, report, 'utf-8');

  return reportPath;
}
