export interface CounterMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

export interface GaugeMetric {
  name: string;
  value: number;
  labels: Record<string, string>;
  timestamp: string;
}

export interface HistogramBucket {
  le: number;
  count: number;
}

export interface HistogramMetric {
  name: string;
  buckets: HistogramBucket[];
  sum: number;
  count: number;
  labels: Record<string, string>;
  timestamp: string;
}

export type Metric = CounterMetric | GaugeMetric | HistogramMetric;

export class MetricsCollector {
  private counters = new Map<string, number>();
  private gauges = new Map<string, number>();
  private histograms = new Map<
    string,
    { buckets: Map<number, number>; sum: number; count: number }
  >();
  private listeners: ((metric: Metric) => void)[] = [];

  increment(name: string, labels: Record<string, string> = {}, value = 1): void {
    const key = this.makeKey(name, labels);
    const current = this.counters.get(key) || 0;
    const newValue = current + value;
    this.counters.set(key, newValue);

    const metric: CounterMetric = {
      name,
      value: newValue,
      labels,
      timestamp: new Date().toISOString(),
    };

    this.emit(metric);
  }

  set(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.makeKey(name, labels);
    this.gauges.set(key, value);

    const metric: GaugeMetric = {
      name,
      value,
      labels,
      timestamp: new Date().toISOString(),
    };

    this.emit(metric);
  }

  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.makeKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        buckets: new Map(),
        sum: 0,
        count: 0,
      };
      this.histograms.set(key, histogram);
    }

    // Update buckets (standard Prometheus-style buckets)
    const bucketBounds = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, Infinity];
    for (const bound of bucketBounds) {
      if (value <= bound) {
        const current = histogram.buckets.get(bound) || 0;
        histogram.buckets.set(bound, current + 1);
      }
    }

    histogram.sum += value;
    histogram.count += 1;

    const buckets: HistogramBucket[] = bucketBounds.map((bound) => ({
      le: bound,
      count: histogram!.buckets.get(bound) || 0,
    }));

    const metric: HistogramMetric = {
      name,
      buckets,
      sum: histogram.sum,
      count: histogram.count,
      labels,
      timestamp: new Date().toISOString(),
    };

    this.emit(metric);
  }

  onMetric(listener: (metric: Metric) => void): () => void {
    this.listeners.push(listener);
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getAllMetrics(): Metric[] {
    const metrics: Metric[] = [];
    const now = new Date().toISOString();

    // Counters
    for (const [key, value] of this.counters) {
      const { name, labels } = this.parseKey(key);
      metrics.push({ name, value, labels, timestamp: now });
    }

    // Gauges
    for (const [key, value] of this.gauges) {
      const { name, labels } = this.parseKey(key);
      metrics.push({ name, value, labels, timestamp: now });
    }

    // Histograms
    for (const [key, histogram] of this.histograms) {
      const { name, labels } = this.parseKey(key);
      const buckets: HistogramBucket[] = [];
      for (const [le, count] of histogram.buckets) {
        buckets.push({ le, count });
      }
      metrics.push({
        name,
        buckets,
        sum: histogram.sum,
        count: histogram.count,
        labels,
        timestamp: now,
      });
    }

    return metrics;
  }

  private makeKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}=${v}`)
      .join(',');
    return `${name}{${labelStr}}`;
  }

  private parseKey(key: string): { name: string; labels: Record<string, string> } {
    const match = key.match(/^(.+)\{(.+)\}$/);
    if (!match) {
      return { name: key, labels: {} };
    }

    const [, name, labelStr] = match;
    const labels: Record<string, string> = {};

    for (const part of labelStr.split(',')) {
      const [k, v] = part.split('=');
      if (k && v) {
        labels[k] = v;
      }
    }

    return { name, labels };
  }

  private emit(metric: Metric): void {
    for (const listener of this.listeners) {
      try {
        listener(metric);
      } catch (error) {
        // Don't let metric listeners crash the collector
      }
    }
  }
}

// Standard metric names for ControlPlane
export const METRIC_NAMES = {
  JOBS_RECEIVED: 'jobs_received_total',
  JOBS_COMPLETED: 'jobs_completed_total',
  JOBS_FAILED: 'jobs_failed_total',
  JOB_DURATION: 'job_duration_seconds',
  ACTIVE_JOBS: 'active_jobs',
  RUNNER_HEARTBEAT: 'runner_heartbeat_timestamp',
  EXTERNAL_API_REQUESTS: 'external_api_requests_total',
  EXTERNAL_API_DURATION: 'external_api_duration_seconds',
} as const;
