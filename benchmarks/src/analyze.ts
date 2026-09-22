#!/usr/bin/env node
/**
 * Benchmark results analyzer.
 * Compare results across multiple runs to detect trends.
 */

import fs from 'fs/promises';
import path from 'path';
import { BenchmarkResult } from './results.js';

async function main() {
  const resultsDir = process.argv[2] || './results';

  const entries = await fs.readdir(resultsDir, { withFileTypes: true });
  const resultDirs = entries
    .filter((e) => e.isDirectory())
    .map((e) => e.name)
    .sort();

  if (resultDirs.length === 0) {
    console.error('No benchmark results found');
    process.exit(1);
  }

  console.log(`\nAnalyzing ${resultDirs.length} benchmark runs\n`);

  // Load all results
  const allRuns: { dir: string; results: BenchmarkResult[] }[] = [];

  for (const dir of resultDirs) {
    try {
      const resultsPath = path.join(resultsDir, dir, 'results.json');
      const data = JSON.parse(await fs.readFile(resultsPath, 'utf-8'));
      allRuns.push({ dir, results: data.results });
    } catch {
      // Skip invalid results
    }
  }

  // Analyze trends
  const scenarios = new Set(allRuns.flatMap((r) => r.results.map((res) => res.scenarioId)));

  for (const scenarioId of scenarios) {
    console.log(`\n${scenarioId}:`);
    console.log('-'.repeat(40));

    const scenarioData = allRuns
      .map((run) => {
        const results = run.results.filter((r) => r.scenarioId === scenarioId);
        if (results.length === 0) return null;

        const avgDuration = results.reduce((a, r) => a + r.durationMs, 0) / results.length;
        return {
          run: run.dir,
          iterations: results.length,
          avgDuration,
          successRate: results.filter((r) => r.success).length / results.length,
        };
      })
      .filter(Boolean);

    for (const data of scenarioData) {
      console.log(
        `  ${data!.run}: ${data!.avgDuration.toFixed(0)}ms avg (${data!.iterations} runs, ${(data!.successRate * 100).toFixed(0)}% success)`
      );
    }
  }

  console.log();
}

main().catch((error) => {
  console.error(`Analysis error: ${error}`);
  process.exit(1);
});
