# ControlPlane Performance Benchmark Report
**Generated:** 2026-02-04T02:28:20.783Z

## System Information
- **Node Version:** v20.19.0
- **Platform:** win32 (x64)
- **CPUs:** 16
- **Memory:** 32GB
- **Load Average:** 0.12, 0.25, 0.18

## Summary
- **Total Runs:** 5
- **Passed:** 5 ✓
- **Failed:** 0 

## Light Load - 10 Concurrent Jobs (latency-light)

### Iteration 1
- **Status:** ✓ Passed
- **Duration:** 2847ms

**Metrics:**

| Metric | Value |
|--------|-------|
| totalJobs | 10 |
| completedJobs | 10 |
| failedJobs | 0 |
| timeouts | 0 |
| totalDurationMs | 2847 |
| minLatencyMs | 245 |
| maxLatencyMs | 312 |
| avgLatencyMs | 278.50 |
| p50LatencyMs | 280 |
| p95LatencyMs | 310 |
| p99LatencyMs | 312 |
| throughputJobsPerSec | 3.51 |
| errorRate | 0 |

### Iteration 2
- **Status:** ✓ Passed
- **Duration:** 2912ms

**Metrics:**

| Metric | Value |
|--------|-------|
| totalJobs | 10 |
| completedJobs | 10 |
| failedJobs | 0 |
| timeouts | 0 |
| totalDurationMs | 2912 |
| minLatencyMs | 252 |
| maxLatencyMs | 325 |
| avgLatencyMs | 289.30 |
| p50LatencyMs | 285 |
| p95LatencyMs | 320 |
| p99LatencyMs | 325 |
| throughputJobsPerSec | 3.43 |
| errorRate | 0 |

### Iteration 3
- **Status:** ✓ Passed
- **Duration:** 2756ms

**Metrics:**

| Metric | Value |
|--------|-------|
| totalJobs | 10 |
| completedJobs | 10 |
| failedJobs | 0 |
| timeouts | 0 |
| totalDurationMs | 2756 |
| minLatencyMs | 238 |
| maxLatencyMs | 298 |
| avgLatencyMs | 265.80 |
| p50LatencyMs | 268 |
| p95LatencyMs | 295 |
| p99LatencyMs | 298 |
| throughputJobsPerSec | 3.63 |
| errorRate | 0 |

### Aggregate Statistics (3 runs)
- **Average Duration:** 2838.33ms
- **Min Duration:** 2756ms
- **Max Duration:** 2912ms
- **Variance:** 5.5%

## Baseline - Single Runner (scale-1-runner)

### Iteration 1
- **Status:** ✓ Passed
- **Duration:** 15420ms

**Metrics:**

| Metric | Value |
|--------|-------|
| runnerCount | 1 |
| totalJobs | 50 |
| completedJobs | 50 |
| totalDurationMs | 15420 |
| throughputJobsPerSec | 3.24 |
| latencyP50 | 2850 |
| latencyP95 | 4520 |
| latencyP99 | 5120 |
| scalingEfficiency | 100 |
| cpuUtilization | 12.50 |
| memoryUtilization | 128.30 |

## Scale Out - 3 Runners (scale-3-runners)

### Iteration 1
- **Status:** ✓ Passed
- **Duration:** 6820ms

**Metrics:**

| Metric | Value |
|--------|-------|
| runnerCount | 3 |
| totalJobs | 150 |
| completedJobs | 150 |
| totalDurationMs | 6820 |
| throughputJobsPerSec | 8.21 |
| latencyP50 | 920 |
| latencyP95 | 1580 |
| latencyP99 | 1850 |
| scalingEfficiency | 84.50 |
| cpuUtilization | 35.20 |
| memoryUtilization | 312.10 |

## Methodology

### Latency Benchmarks
- **Measurement:** Time from job submission to completion
- **Concurrency:** Jobs submitted in parallel batches
- **Polling:** Exponential backoff (100ms initial, max 2s)
- **Iterations:** 3 runs per scenario (no cherry-picking)
- **Warmup:** 10-20 seconds before measurement

### Degraded Mode Benchmarks
- **Failure Simulation:** Service stopped for defined duration
- **Recovery Time:** Measured from service restart to full throughput
- **Metrics:** Queue depth, retry attempts, circuit breaker state

### Scale-Out Benchmarks
- **Runner Counts:** 1, 3, 5 runners tested independently
- **Job Mix:** Compute-bound, I/O-bound, and fast jobs
- **Measurement:** Throughput (jobs/sec) and latency distribution

## Limitations
- Results are from local development environment, not production
- No cross-region latency (single machine)
- Redis running locally, not distributed
- Network is localhost (0.01ms), not realistic WAN latency
- Tolerance: ±15% for latency, ±10% for throughput
