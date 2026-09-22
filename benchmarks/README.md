# ControlPlane Performance Benchmarks

This directory contains honest, reproducible benchmarks for the ControlPlane orchestration system.

## Hard Rules

1. **No cherry-picking**: All runs included, no "best of 3"
2. **No synthetic-only**: Real-world scenarios with actual failures
3. **Reproducible**: Environment locked, documented, version-pinned
4. **Transparent**: Raw data included, limitations stated upfront

## Benchmark Scenarios

### 1. Orchestration Latency
- **What**: Time from job submission to completion
- **Metrics**: p50, p95, p99 latency
- **Workload**: Varying job counts (10, 100, 500 concurrent jobs)
- **Load**: Sustained (3-minute runs with warmup)

### 2. Degraded Mode Behavior
- **What**: System behavior under partial failure
- **Scenarios**:
  - Runner unavailable (jobs queue, retry, eventually timeout)
  - TruthCore unavailable (circuit breaker trips, graceful fallback)
  - Network partition between JobForge and Redis
- **Metrics**: Recovery time, error rates, queue depth

### 3. Scale-Out Runner Execution
- **What**: Performance with 1, 3, 5 concurrent runners
- **Workload**: Mixed job types (compute-heavy, I/O-heavy, fast)
- **Metrics**: Throughput (jobs/sec), latency distribution, resource utilization

## Quick Start

```bash
# Install dependencies
pnpm install

# Run all benchmarks
pnpm run benchmark

# Run specific benchmark
pnpm run benchmark:latency
pnpm run benchmark:degraded
pnpm run benchmark:scale

# Generate report
pnpm run benchmark:report
```

## Environment Requirements

- Node.js 18+
- Redis 7 (local or Docker)
- Docker & Docker Compose (for full stack)
- 4GB RAM minimum
- 2 CPU cores minimum

## Results Location

Raw results: `benchmarks/results/YYYY-MM-DD-HHMMSS/`
Latest report: `benchmarks/results/LATEST_REPORT.md`

## Interpreting Results

- **p50**: Typical user experience
- **p95**: Worst-case for 95% of users
- **p99**: Outlier behavior (outliers matter for SLAs)
- **Reproducibility tolerance**: ±15% for latency, ±10% for throughput

## How to Rerun Benchmarks

### Prerequisites

1. **Start the development stack:**
   ```bash
   pnpm run dev:stack
   ```

2. **Verify services are healthy:**
   ```bash
   pnpm run test:smoke
   ```

3. **Wait for services to stabilize (10-15 seconds)**

### Running Benchmarks

```bash
# List all available scenarios
pnpm run benchmark:list

# Run a specific scenario
pnpm --filter @controlplane/benchmarks tsx src/runner.ts --scenario=latency-light

# Run all latency benchmarks
pnpm run benchmark:latency

# Run complete benchmark suite (takes ~30 minutes)
pnpm run benchmark:all
```

### Reproducibility Checklist

To ensure your results are reproducible:

- [ ] Use same Node.js version (check `node --version`)
- [ ] Run on same hardware class (CPU count, RAM)
- [ ] Run with clean Redis (flush data: `redis-cli FLUSHALL`)
- [ ] Allow 10-second cooldown between runs
- [ ] Run 3 iterations minimum (default)
- [ ] Document any system changes (OS updates, load)

### Environment Variables

Control benchmark behavior via environment:

```bash
# Run benchmarks against remote services
TRUTHCORE_URL=https://truthcore.example.com \
JOBFORGE_URL=https://jobforge.example.com \
RUNNER_URL=https://runner.example.com \
  pnpm run benchmark

# Adjust tolerances
LATENCY_TOLERANCE=0.20 \
THROUGHPUT_TOLERANCE=0.15 \
  pnpm run benchmark

# Change results directory
BENCHMARK_RESULTS_DIR=/tmp/benchmarks \
  pnpm run benchmark

# Increase iterations for better statistical confidence
BENCHMARK_ITERATIONS=5 \
  pnpm run benchmark
```

## Methodology

### Latency Measurement

1. **Warmup Phase (10-20s):** 
   - Allow JIT compilation to stabilize
   - Warm Redis connection pools
   - Establish runner capacity baseline

2. **Measurement Phase:**
   - Submit all jobs concurrently
   - Record submission timestamp (t0)
   - Poll for completion with exponential backoff
   - Record completion timestamp (t1)
   - Calculate latency = t1 - t0

3. **Statistics:**
   - Report min, max, average, p50, p95, p99
   - Calculate throughput = completed_jobs / total_time
   - Track error rate separately

### Degraded Mode Testing

1. **Baseline:** Measure normal operation for 30s
2. **Failure Injection:** Stop target service
3. **Workload Continuation:** Continue submitting jobs
4. **Recovery:** Restart service, measure recovery time
5. **Post-Recovery:** Verify return to baseline

### Scale-Out Testing

1. **Single Runner Baseline:** Measure throughput with 1 runner
2. **Scale Up:** Increase runner count (3, 5)
3. **Calculate Efficiency:**
   ```
   scaling_efficiency = (actual_speedup / ideal_speedup) × 100
   ideal_speedup = new_runner_count / baseline_runner_count
   actual_speedup = new_throughput / baseline_throughput
   ```

## Limitations & Transparency

We openly document what these benchmarks do NOT capture:

1. **Network Latency:** All services on localhost (0.01ms RTT)
2. **Production Load:** No realistic user traffic patterns
3. **Cross-Region:** Single datacenter setup
4. **Persistence:** Redis running locally, not distributed
5. **Hardware:** Consumer-grade hardware, not server-class
6. **Jitter:** ±15% variance expected for latency

## Interpreting Variance

Results within these bounds are considered reproducible:

- **Latency:** ±15% between runs
- **Throughput:** ±10% between runs  
- **Recovery Time:** ±25% (highly variable)

If variance exceeds these bounds:
1. Check system load (CPU, memory, other processes)
2. Verify Redis is not shared with other workloads
3. Ensure no background jobs are running
4. Consider increasing iteration count

## Contributing Benchmarks

1. Define scenario in `src/scenarios.ts`
2. Implement harness in `src/benchmarks/`
3. Add metrics to `src/results.ts`
4. Document methodology in this README
5. Ensure runs complete in < 10 minutes per scenario
6. Verify reproducibility across 3 runs before submitting
