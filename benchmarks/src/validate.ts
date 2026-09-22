#!/usr/bin/env node
/**
 * Benchmark validation script.
 *
 * Validates that benchmark results are within reproducibility tolerances.
 * Used in CI to detect performance regressions.
 */

import fs from 'fs/promises';
import path from 'path';
import { BenchmarkResult } from './results.js';

interface ValidationRule {
  scenarioPattern: RegExp;
  metric: string;
  maxValue?: number;
  minValue?: number;
  varianceThreshold?: number; // max variance between iterations
}

const DEFAULT_RULES: ValidationRule[] = [
  // Latency benchmarks - max 5 second total latency
  { scenarioPattern: /^latency-/, metric: 'avgLatencyMs', maxValue: 5000 },
  { scenarioPattern: /^latency-/, metric: 'p95LatencyMs', maxValue: 10000 },
  { scenarioPattern: /^latency-/, metric: 'errorRate', maxValue: 0.01 }, // < 1% errors

  // Degraded mode - must recover within 60 seconds
  { scenarioPattern: /^degraded-/, metric: 'recoveryTimeMs', maxValue: 60000 },
  { scenarioPattern: /^degraded-/, metric: 'errorRate', maxValue: 0.5 }, // < 50% during degraded

  // Scale benchmarks - must show positive scaling efficiency
  { scenarioPattern: /^scale-/, metric: 'scalingEfficiency', minValue: 50 }, // > 50% efficiency
  { scenarioPattern: /^scale-/, metric: 'throughputJobsPerSec', minValue: 1 },
];

async function main() {
  const resultsDir = process.argv[2] || './results';

  // Find most recent results
  const entries = await fs.readdir(resultsDir, { withFileTypes: true });
  const resultDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort()
    .reverse();

  if (resultDirs.length === 0) {
    console.error('No benchmark results found');
    process.exit(1);
  }

  const latestDir = path.join(resultsDir, resultDirs[0]);
  const resultsPath = path.join(latestDir, 'results.json');

  const data = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
  const results: BenchmarkResult[] = data.results;

  console.log(`\nValidating ${results.length} benchmark results from ${resultDirs[0]}\n`);

  let passed = 0;
  let failed = 0;
  let warnings = 0;

  // Group by scenario for variance checks
  const byScenario = new Map<string, BenchmarkResult[]>();
  for (const result of results) {
    const list = byScenario.get(result.scenarioId) || [];
    list.push(result);
    byScenario.set(result.scenarioId, list);
  }

  // Check individual results against rules
  for (const result of results) {
    if (!result.success) {
      console.log(
        `✗ ${result.scenarioName} (iteration ${result.iteration}): FAILED - ${result.error}`
      );
      failed++;
      continue;
    }

    const rules = DEFAULT_RULES.filter((r) => r.scenarioPattern.test(result.scenarioId));

    for (const rule of rules) {
      const metrics = result.metrics as Record<string, number>;
      const value = metrics[rule.metric];

      if (typeof value !== 'number') {
        console.log(`⚠ ${result.scenarioName}: Metric ${rule.metric} not found`);
        warnings++;
        continue;
      }

      if (rule.maxValue !== undefined && value > rule.maxValue) {
        console.log(
          `✗ ${result.scenarioName}: ${rule.metric}=${value.toFixed(2)} exceeds max=${rule.maxValue}`
        );
        failed++;
      } else if (rule.minValue !== undefined && value < rule.minValue) {
        console.log(
          `✗ ${result.scenarioName}: ${rule.metric}=${value.toFixed(2)} below min=${rule.minValue}`
        );
        failed++;
      }
    }

    passed++;
  }

  // Check variance between iterations
  console.log('\nVariance Analysis:');
  for (const [scenarioId, scenarioResults] of byScenario) {
    if (scenarioResults.length < 2) continue;

    const first = scenarioResults[0];
    const durations = scenarioResults.map((r) => r.durationMs);
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = (Math.max(...durations) - Math.min(...durations)) / avg;

    // Extract category from scenario ID
    const category = scenarioId.split('-')[0];
    const threshold = category === 'latency' ? 0.15 : category === 'scale' ? 0.1 : 0.25;

    if (variance > threshold) {
      console.log(
        `⚠ ${first.scenarioName}: High variance ${(variance * 100).toFixed(1)}% (threshold ${(threshold * 100).toFixed(0)}%)`
      );
      warnings++;
    } else {
      console.log(
        `✓ ${first.scenarioName}: Variance ${(variance * 100).toFixed(1)}% (within threshold)`
      );
    }
  }

  console.log(`\n${'='.repeat(50)}`);
  console.log(`Validation Complete:`);
  console.log(`  Passed:  ${passed} ✓`);
  console.log(`  Failed:  ${failed} ✗`);
  console.log(`  Warnings: ${warnings} ⚠`);
  console.log(`${'='.repeat(50)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(`Validation error: ${error}`);
  process.exit(1);
});
