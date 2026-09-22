import type { BenchmarkConfig, BenchmarkResult } from '../contracts/index.js';
import { LoadGenerator } from '../load-generator.js';

export interface BenchmarkContext {
  truthcoreUrl: string;
  jobforgeUrl: string;
  runnerUrl: string;
  verbose: boolean;
}

export abstract class BenchmarkRunner {
  protected loadGenerator: LoadGenerator;
  protected context: BenchmarkContext;

  constructor(context: BenchmarkContext) {
    this.loadGenerator = new LoadGenerator();
    this.context = context;
  }

  abstract run(config: BenchmarkConfig): Promise<BenchmarkResult>;

  protected createBaseResult(
    config: BenchmarkConfig,
    startTime: string,
    endTime: string,
    durationMs: number,
    status: 'passed' | 'failed' | 'skipped' = 'passed'
  ): BenchmarkResult {
    return {
      id: crypto.randomUUID(),
      name: config.name,
      description: config.description,
      suite: config.suite,
      status,
      durationMs,
      startTime,
      endTime,
      metrics: [],
      metadata: {},
    };
  }

  protected log(message: string): void {
    if (this.context.verbose) {
      console.log(`[${this.constructor.name}] ${message}`);
    }
  }
}
