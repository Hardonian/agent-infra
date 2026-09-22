#!/usr/bin/env node
/**
 * ControlPlane Benchmark Runner
 *
 * Entry point for running all performance benchmarks.
 * Produces honest, reproducible results following strict methodology.
 */

import {
  allScenarios,
  getScenarioById,
  getScenariosByCategory,
  BenchmarkScenario,
} from './scenarios.js';
import { config, validateEnvironment, getSystemInfo, parseArgs } from './config.js';
import { logger } from './logger.js';
import { LatencyBenchmark } from './benchmarks/latency.js';
import { DegradedBenchmark } from './benchmarks/degraded.js';
import { ScaleBenchmark } from './benchmarks/scale.js';
import { BenchmarkResult, saveResults, generateReport } from './results.js';
import fs from 'fs/promises';
import path from 'path';

const BENCHMARKS = {
  latency: LatencyBenchmark,
  degraded: DegradedBenchmark,
  scale: ScaleBenchmark,
};

async function main() {
  const args = parseArgs();

  // List scenarios if requested
  if (args.list) {
    console.log('\nAvailable Benchmark Scenarios:\n');
    for (const scenario of allScenarios) {
      console.log(`  ${scenario.id.padEnd(25)} ${scenario.name}`);
      console.log(`                              ${scenario.description}`);
      console.log();
    }
    process.exit(0);
  }

  // Validate environment
  logger.info('Validating environment...');
  const envCheck = await validateEnvironment();

  if (!envCheck.valid) {
    logger.error('Environment validation failed:');
    for (const error of envCheck.errors) {
      logger.error(`  - ${error}`);
    }
    logger.error('\nMake sure all services are running: pnpm run dev:stack');
    process.exit(1);
  }

  logger.info('Environment validated successfully');

  // Determine which scenarios to run
  let scenariosToRun: BenchmarkScenario[] = [];

  if (args.all) {
    scenariosToRun = allScenarios;
  } else if (args.scenario) {
    const scenario = getScenarioById(args.scenario);
    if (scenario) {
      scenariosToRun = [scenario];
    } else {
      // Try as category
      scenariosToRun = getScenariosByCategory(args.scenario as 'latency' | 'degraded' | 'scale');
      if (scenariosToRun.length === 0) {
        logger.error(`Unknown scenario or category: ${args.scenario}`);
        logger.error('Run with --list to see available scenarios');
        process.exit(1);
      }
    }
  } else {
    logger.error('Usage: benchmark --all | --scenario=<id> | --scenario=<category>');
    logger.error('       benchmark --list');
    process.exit(1);
  }

  // Ensure results directory exists
  const resultsDir = path.resolve(config.resultsDir);
  await fs.mkdir(resultsDir, { recursive: true });

  // Run benchmarks
  const allResults: BenchmarkResult[] = [];
  const systemInfo = await getSystemInfo();

  logger.info(`\nRunning ${scenariosToRun.length} benchmark scenarios`);
  logger.info(`Iterations per scenario: ${config.iterations}`);
  logger.info(`Results will be saved to: ${resultsDir}\n`);

  for (const scenario of scenariosToRun) {
    logger.info(`\n${'='.repeat(60)}`);
    logger.info(`Scenario: ${scenario.name}`);
    logger.info(`${'='.repeat(60)}`);

    const category = scenario.id.split('-')[0] as keyof typeof BENCHMARKS;
    const BenchmarkClass = BENCHMARKS[category];

    if (!BenchmarkClass) {
      logger.error(`No benchmark implementation for category: ${category}`);
      continue;
    }

    const benchmark = new BenchmarkClass(scenario);

    for (let iteration = 1; iteration <= config.iterations; iteration++) {
      logger.info(`\nIteration ${iteration}/${config.iterations}`);

      try {
        const result = await benchmark.run(iteration);
        allResults.push(result);

        if (result.success) {
          logger.info(`✓ Completed in ${result.durationMs}ms`);
        } else {
          logger.error(`✗ Failed: ${result.error}`);
        }
      } catch (error) {
        logger.error(`✗ Exception: ${error instanceof Error ? error.message : String(error)}`);
        allResults.push({
          scenarioId: scenario.id,
          scenarioName: scenario.name,
          iteration,
          timestamp: new Date().toISOString(),
          durationMs: 0,
          success: false,
          error: error instanceof Error ? error.message : String(error),
          metrics: {},
        });
      }

      // Small delay between iterations
      if (iteration < config.iterations) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  // Save results
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(resultsDir, runId);
  await fs.mkdir(runDir, { recursive: true });

  await saveResults(allResults, runDir, systemInfo);

  // Generate report
  const reportPath = await generateReport(allResults, runDir, systemInfo);

  logger.info(`\n${'='.repeat(60)}`);
  logger.info('Benchmark Run Complete');
  logger.info(`${'='.repeat(60)}`);
  logger.info(`Results saved to: ${runDir}`);
  logger.info(`Report: ${reportPath}`);

  // Exit with error code if any benchmark failed
  const failures = allResults.filter((r) => !r.success);
  if (failures.length > 0) {
    logger.error(`\n${failures.length} benchmark(s) failed`);
    process.exit(1);
  }
}

main().catch((error) => {
  logger.error(`Fatal error: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
