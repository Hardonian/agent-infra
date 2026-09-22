/**
 * Environment configuration with defaults.
 * All environment variables have sensible defaults for local development.
 */
export const config = {
  // Service URLs
  truthcoreUrl: process.env.TRUTHCORE_URL || 'http://localhost:3001',
  jobforgeUrl: process.env.JOBFORGE_URL || 'http://localhost:3002',
  runnerUrl: process.env.RUNNER_URL || 'http://localhost:3003',

  // Redis configuration
  redisHost: process.env.REDIS_HOST || 'localhost',
  redisPort: parseInt(process.env.REDIS_PORT || '6379', 10),

  // Benchmark configuration
  resultsDir: process.env.BENCHMARK_RESULTS_DIR || './results',
  iterations: parseInt(process.env.BENCHMARK_ITERATIONS || '3', 10),

  // Timeout configuration
  defaultTimeout: parseInt(process.env.BENCHMARK_TIMEOUT || '30000', 10),
  healthCheckTimeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '5000', 10),

  // Logging
  logLevel: process.env.BENCHMARK_LOG_LEVEL || 'info',

  // Validation
  latencyTolerance: parseFloat(process.env.LATENCY_TOLERANCE || '0.15'), // ±15%
  throughputTolerance: parseFloat(process.env.THROUGHPUT_TOLERANCE || '0.10'), // ±10%
} as const;

/**
 * Validate that required services are healthy before running benchmarks.
 */
export async function validateEnvironment(): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = [];

  const services = [
    { name: 'TruthCore', url: `${config.truthcoreUrl}/health` },
    { name: 'JobForge', url: `${config.jobforgeUrl}/health` },
    { name: 'Runner', url: `${config.runnerUrl}/health` },
  ];

  for (const service of services) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), config.healthCheckTimeout);

      const response = await fetch(service.url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        errors.push(`${service.name} at ${service.url} returned ${response.status}`);
      } else {
        const data = await response.json();
        if (data.status !== 'healthy') {
          errors.push(`${service.name} reports status: ${data.status}`);
        }
      }
    } catch (error) {
      errors.push(
        `${service.name} at ${service.url} is unreachable: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Get system information for reproducibility documentation.
 */
export async function getSystemInfo(): Promise<Record<string, unknown>> {
  const os = await import('os');

  return {
    nodeVersion: process.version,
    platform: os.platform(),
    arch: os.arch(),
    cpus: os.cpus().length,
    totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024)}GB`,
    loadAverage: os.loadavg(),
    uptime: os.uptime(),
    timestamp: new Date().toISOString(),
    environment: {
      truthcoreUrl: config.truthcoreUrl,
      jobforgeUrl: config.jobforgeUrl,
      runnerUrl: config.runnerUrl,
    },
  };
}

/**
 * Parse command line arguments for benchmark runner.
 */
export function parseArgs(): { scenario?: string; all: boolean; list: boolean } {
  const args = process.argv.slice(2);

  let scenario: string | undefined;
  let all = false;
  let list = false;

  for (const arg of args) {
    if (arg === '--all') {
      all = true;
    } else if (arg === '--list') {
      list = true;
    } else if (arg.startsWith('--scenario=')) {
      scenario = arg.split('=')[1];
    } else if (arg === '--scenario' || arg === '-s') {
      const idx = args.indexOf(arg);
      scenario = args[idx + 1];
    }
  }

  return { scenario, all, list };
}
