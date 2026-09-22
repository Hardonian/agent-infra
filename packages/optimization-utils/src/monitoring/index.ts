/**
 * Monitoring Module - Performance tracking and optimization insights
 */

export interface PerformanceMetrics {
  operation: string;
  durationMs: number;
  timestamp: number;
  success: boolean;
  metadata?: Record<string, unknown>;
}

export interface HotPathReport {
  path: string;
  totalCalls: number;
  totalDurationMs: number;
  avgDurationMs: number;
  p50: number;
  p95: number;
  p99: number;
  errorRate: number;
  hotness: number; // Calculated score
}

export interface OptimizationSuggestion {
  type: 'caching' | 'batching' | 'circuit-breaker' | 'rate-limit' | 'async';
  path: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  recommendation: string;
}

interface OperationStats {
  durations: number[];
  errors: number;
  total: number;
}

/**
 * Performance monitor for tracking operation metrics
 * Collects timing data and generates insights
 */
export class PerformanceMonitor {
  private metrics: Map<string, OperationStats>;
  private enabled: boolean;

  constructor(enabled = true) {
    this.metrics = new Map();
    this.enabled = enabled;
  }

  async track<T>(
    operation: string,
    fn: () => Promise<T>,
    _metadata?: Record<string, unknown>
  ): Promise<T> {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    let success = false;

    try {
      const result = await fn();
      success = true;
      return result;
    } finally {
      const duration = performance.now() - start;
      this.record(operation, duration, success);
    }
  }

  trackSync<T>(operation: string, fn: () => T): T {
    if (!this.enabled) {
      return fn();
    }

    const start = performance.now();
    let success = false;

    try {
      const result = fn();
      success = true;
      return result;
    } finally {
      const duration = performance.now() - start;
      this.record(operation, duration, success);
    }
  }

  record(operation: string, durationMs: number, success: boolean): void {
    if (!this.enabled) return;

    let stats = this.metrics.get(operation);
    if (!stats) {
      stats = { durations: [], errors: 0, total: 0 };
      this.metrics.set(operation, stats);
    }

    stats.durations.push(durationMs);
    stats.total++;
    if (!success) {
      stats.errors++;
    }

    // Limit stored durations to prevent memory bloat
    if (stats.durations.length > 10000) {
      stats.durations = stats.durations.slice(-5000);
    }
  }

  getReport(): HotPathReport[] {
    const reports: HotPathReport[] = [];

    for (const [path, stats] of this.metrics.entries()) {
      if (stats.durations.length === 0) continue;

      const sorted = [...stats.durations].sort((a, b) => a - b);
      const totalDuration = stats.durations.reduce((a, b) => a + b, 0);
      const avgDuration = totalDuration / stats.durations.length;

      const p50Index = Math.floor(sorted.length * 0.5);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);

      const hotness = this.calculateHotness(stats, avgDuration);

      reports.push({
        path,
        totalCalls: stats.total,
        totalDurationMs: totalDuration,
        avgDurationMs: avgDuration,
        p50: sorted[p50Index] ?? sorted[sorted.length - 1] ?? 0,
        p95: sorted[p95Index] ?? sorted[sorted.length - 1] ?? 0,
        p99: sorted[p99Index] ?? sorted[sorted.length - 1] ?? 0,
        errorRate: stats.total > 0 ? stats.errors / stats.total : 0,
        hotness,
      });
    }

    // Sort by hotness score (descending)
    return reports.sort((a, b) => b.hotness - a.hotness);
  }

  getSuggestions(): OptimizationSuggestion[] {
    const suggestions: OptimizationSuggestion[] = [];
    const reports = this.getReport();

    for (const report of reports) {
      // High call volume with high latency
      if (report.totalCalls > 1000 && report.avgDurationMs > 10) {
        suggestions.push({
          type: 'caching',
          path: report.path,
          severity:
            report.avgDurationMs > 100 ? 'critical' : report.avgDurationMs > 50 ? 'high' : 'medium',
          description: `Frequently called operation with ${report.avgDurationMs.toFixed(2)}ms average latency`,
          impact: `Caching could save ${((report.totalCalls * report.avgDurationMs) / 1000).toFixed(1)}s per analysis period`,
          effort: 'medium',
          recommendation: 'Implement LRU cache with TTL for repeated calls with same parameters',
        });
      }

      // High error rate
      if (report.errorRate > 0.01) {
        suggestions.push({
          type: 'circuit-breaker',
          path: report.path,
          severity:
            report.errorRate > 0.1 ? 'critical' : report.errorRate > 0.05 ? 'high' : 'medium',
          description: `High error rate detected: ${(report.errorRate * 100).toFixed(2)}%`,
          impact: 'Preventing cascading failures and resource exhaustion',
          effort: 'low',
          recommendation:
            'Wrap operation with CircuitBreaker to fail fast when downstream is unhealthy',
        });
      }

      // High P99 latency indicates outliers
      if (report.p99 > report.avgDurationMs * 3) {
        suggestions.push({
          type: 'rate-limit',
          path: report.path,
          severity: 'medium',
          description: `P99 latency (${report.p99.toFixed(2)}ms) is ${(report.p99 / report.avgDurationMs).toFixed(1)}x higher than average`,
          impact: 'Outliers suggest resource contention or downstream throttling',
          effort: 'low',
          recommendation: 'Add rate limiting to smooth traffic and prevent spikes',
        });
      }

      // Very frequent calls suggest batching opportunity
      if (report.totalCalls > 5000) {
        suggestions.push({
          type: 'batching',
          path: report.path,
          severity: 'high',
          description: `Extremely high call volume: ${report.totalCalls} calls`,
          impact: `Batching could reduce overhead by up to ${Math.min(report.totalCalls / 100, 90).toFixed(0)}%`,
          effort: 'medium',
          recommendation:
            'Implement request batching to combine multiple operations into single request',
        });
      }
    }

    // Sort by severity
    const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
    return suggestions.sort((a, b) => severityOrder[b.severity] - severityOrder[a.severity]);
  }

  clear(): void {
    this.metrics.clear();
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }

  private calculateHotness(stats: OperationStats, avgDuration: number): number {
    // Hotness score combines frequency, duration, and error rate
    const frequencyWeight = Math.log10(stats.total + 1) / 4; // 0-1 scale for 0-10k calls
    const durationWeight = Math.min(avgDuration / 100, 1); // 0-1 scale, capped at 100ms
    const errorWeight = Math.min((stats.errors * 10) / Math.max(stats.total, 1), 1); // 0-1 scale

    return (frequencyWeight * 0.4 + durationWeight * 0.4 + errorWeight * 0.2) * 100;
  }
}

interface HotPathEntry {
  path: string;
  duration: number;
  timestamp: number;
}

/**
 * Hot path tracker for identifying optimization opportunities
 * Tracks code paths that consume the most resources
 */
export class HotPathTracker {
  private paths: Map<string, HotPathEntry[]>;
  private enabled: boolean;

  constructor(enabled = true) {
    this.paths = new Map();
    this.enabled = enabled;
  }

  enter(path: string): () => void {
    if (!this.enabled) {
      return () => {};
    }

    const startTime = performance.now();

    return () => {
      const duration = performance.now() - startTime;
      this.record(path, duration);
    };
  }

  record(path: string, durationMs: number): void {
    if (!this.enabled) return;

    let entries = this.paths.get(path);
    if (!entries) {
      entries = [];
      this.paths.set(path, entries);
    }

    entries.push({
      path,
      duration: durationMs,
      timestamp: Date.now(),
    });

    // Limit entries to prevent memory bloat
    if (entries.length > 10000) {
      this.paths.set(path, entries.slice(-5000));
    }
  }

  getHotPaths(
    limit = 10
  ): Array<{ path: string; totalDuration: number; avgDuration: number; calls: number }> {
    const results: Array<{
      path: string;
      totalDuration: number;
      avgDuration: number;
      calls: number;
    }> = [];

    for (const [path, entries] of this.paths.entries()) {
      if (entries.length === 0) continue;

      const totalDuration = entries.reduce((sum, e) => sum + e.duration, 0);
      results.push({
        path,
        totalDuration,
        avgDuration: totalDuration / entries.length,
        calls: entries.length,
      });
    }

    // Sort by total duration (descending)
    return results.sort((a, b) => b.totalDuration - a.totalDuration).slice(0, limit);
  }

  getPathDetails(path: string): {
    calls: number;
    totalDuration: number;
    avgDuration: number;
    minDuration: number;
    maxDuration: number;
    percentiles: Record<number, number>;
  } | null {
    const entries = this.paths.get(path);
    if (!entries || entries.length === 0) return null;

    const durations = entries.map((e) => e.duration).sort((a, b) => a - b);
    const totalDuration = durations.reduce((a, b) => a + b, 0);

    const getPercentile = (p: number) => {
      const index = Math.floor(durations.length * (p / 100));
      return durations[index] ?? durations[durations.length - 1] ?? 0;
    };

    return {
      calls: entries.length,
      totalDuration,
      avgDuration: totalDuration / durations.length,
      minDuration: durations[0] ?? 0,
      maxDuration: durations[durations.length - 1] ?? 0,
      percentiles: {
        50: getPercentile(50),
        90: getPercentile(90),
        95: getPercentile(95),
        99: getPercentile(99),
      },
    };
  }

  clear(): void {
    this.paths.clear();
  }

  enable(): void {
    this.enabled = true;
  }

  disable(): void {
    this.enabled = false;
  }
}
