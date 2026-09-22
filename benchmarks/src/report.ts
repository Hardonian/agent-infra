#!/usr/bin/env node
/**
 * Benchmark report generator - standalone report from existing results.
 */

import { generateReport } from './results.js';
import fs from 'fs/promises';
import path from 'path';

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

  const reportPath = await generateReport(data.results, latestDir, data.systemInfo);
  console.log(`Report generated: ${reportPath}`);
}

main().catch((error) => {
  console.error(`Report error: ${error}`);
  process.exit(1);
});
