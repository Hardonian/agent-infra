# @controlplane/benchmark

Performance benchmarking suite for ControlPlane - measures job throughput, latency, and system scalability.

## Features

- **Job Throughput**: Measures job submission and acceptance rates
- **End-to-End Latency**: Tracks complete job lifecycle from submission to completion
- **TruthCore Query Performance**: Benchmarks assertion storage and query performance
- **Runner Scaling**: Tests runner performance at various concurrency levels
- **Contract Validation**: Measures Zod schema validation performance
- **Queue Performance**: Tests message queue enqueue/dequeue throughput
- **Health Check Performance**: Measures health endpoint response times

## Installation

```bash
pnpm add @controlplane/benchmark
```

## Quick Start

### CLI Usage

```bash
# Run all benchmarks
pnpm run benchmark:all

# Run specific benchmark suites
pnpm run benchmark:throughput
pnpm run benchmark:latency
pnpm run benchmark:truthcore
pnpm run benchmark:runner
pnpm run benchmark:contract
pnpm run benchmark:queue
pnpm run benchmark:health

# Custom configuration
npx cp-benchmark --suite=throughput --duration=60000 --concurrency=20 --verbose
```

### Programmatic Usage

```typescript
import { BenchmarkEngine } from '@controlplane/benchmark';
import type { BenchmarkSuite, BenchmarkConfig } from '@controlplane/benchmark';

const config: BenchmarkConfig = {
  name: 'My Throughput Test',
  description: 'Test job submission throughput',
  suite: 'throughput',
  durationMs: 30000,
  warmupMs: 5000,
  concurrency: 10,
  thresholds: {
    minThroughput: 50,
    maxErrorRate: 0.05,
  },
};

const suite: BenchmarkSuite = {
  id: crypto.randomUUID(),
  name: 'My Suite',
  description: 'Custom benchmark suite',
  configs: [config],
  globalConfig: {
    truthcoreUrl: 'http://localhost:3001',
    jobforgeUrl: 'http://localhost:3002',
    runnerUrl: 'http://localhost:3003',
    outputFormat: 'table',
    verbose: false,
  },
};

const engine = new BenchmarkEngine();
const report = await engine.runSuite(suite);

console.log(`Total: ${report.summary.total}`);
console.log(`Passed: ${report.summary.passed}`);
console.log(`Failed: ${report.summary.failed}`);
```

## CLI Options

```
Options:
  -s, --suite <type>                    Benchmark suite (throughput|latency|truthcore|runner|contract|queue|health|all)
  -d, --duration <ms>                  Benchmark duration in milliseconds (default: 30000)
  -c, --concurrency <n>                 Number of concurrent workers (default: 10)
  -w, --warmup <ms>                     Warmup duration in milliseconds (default: 5000)
  --truthcore <url>                    TruthCore URL (default: http://localhost:3001)
  --jobforge <url>                     JobForge URL (default: http://localhost:3002)
  --runner <url>                       Runner URL (default: http://localhost:3003)
  -f, --format <format>                 Output format: json|table|markdown (default: table)
  -o, --output <path>                   Output file path for JSON report
  -v, --verbose                         Enable verbose output
  --target-rps <rps>                     Target requests per second
  --iterations <n>                      Number of iterations for contract validation (default: 10000)
  --threshold-error-rate <rate>         Maximum acceptable error rate (default: 0.05)
  --threshold-max-latency <ms>           Maximum acceptable latency
  --threshold-min-throughput <rps>     Minimum acceptable throughput
  -h, --help                           Display help
```

## Benchmark Suites

### Job Throughput

Measures the rate at which JobForge can accept job submissions.

**Key Metrics:**
- `jobs_per_second`: Average job submission rate
- `acceptance_rate`: Percentage of jobs successfully accepted
- `avg_acceptance_latency`: Time from submission to acceptance
- `throughput_*`: Min/max/avg throughput per second

### End-to-End Latency

Tracks the complete job lifecycle from submission through execution to completion.

**Key Metrics:**
- `avg_total_latency`: Average time from submission to completion
- `p50/p95/p99_latency`: Latency percentiles
- `pipeline_throughput`: Effective throughput of completed jobs
- `success_rate`: Percentage of jobs completed successfully

### TruthCore Query Performance

Benchmarks TruthCore's assertion storage and query capabilities.

**Key Metrics:**
- `assertion_throughput`: Assertions stored per second
- `query_throughput`: Queries executed per second
- `assert_*_latency`: Assertion operation latencies
- `query_*_latency`: Query operation latencies

### Runner Scaling

Tests how runners handle varying levels of concurrent job execution.

**Key Metrics:**
- `concurrency_{N}_*`: Metrics at different concurrency levels (1, 5, 10, 25, 50)
- `concurrency_{N}_throughput`: Throughput at each concurrency level
- `concurrency_{N}_success_rate`: Success rate at each concurrency level

### Contract Validation

Measures Zod schema validation performance.

**Key Metrics:**
- `{schema}_avg_time`: Average validation time per schema
- `{schema}_throughput`: Validations per second per schema
- `overall_throughput`: Total validations per second
- `total_validations`: Total number of validations performed

### Queue Performance

Tests message queue operations.

**Key Metrics:**
- `enqueue_throughput`: Messages enqueued per second
- `dequeue_throughput`: Messages dequeued per second
- `processing_lag`: Messages remaining in queue
- `queue_depth_*`: Queue depth statistics

### Health Check Performance

Measures health endpoint response times.

**Key Metrics:**
- `{service}_avg_latency`: Average health check latency per service
- `{service}_health_rate`: Health check success rate per service
- `overall_health_rate`: Overall health check success rate
- `{service}_p95/p99_latency`: Latency percentiles per service

## Output Formats

### Table Format (Default)
Human-readable formatted table output with colored status indicators.

### JSON Format
Machine-readable JSON output suitable for CI/CD pipelines and further processing.

### Markdown Format
GitHub-flavored markdown suitable for documentation and issue tracking.

## Thresholds and Pass/Fail

Benchmarks can be configured with thresholds that determine pass/fail status:

- `minThroughput`: Minimum required throughput (req/s)
- `maxLatencyMs`: Maximum acceptable latency (ms)
- `maxErrorRate`: Maximum acceptable error rate (0-1)

If any threshold is exceeded, the benchmark will be marked as failed.

## Integration with CI/CD

```yaml
# .github/workflows/benchmark.yml
name: Performance Benchmarks

on:
  push:
    branches: [main]
  pull_request:

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: pnpm/action-setup@v2
      - name: Start services
        run: pnpm run dev:stack
      - name: Run benchmarks
        run: |
          pnpm run benchmark:all --format=json --output=benchmark-report.json
      - name: Upload results
        uses: actions/upload-artifact@v3
        with:
          name: benchmark-report
          path: benchmark-report.json
```

## License

Apache-2.0
