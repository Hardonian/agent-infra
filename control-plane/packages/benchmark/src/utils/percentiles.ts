export type PercentileMode = 'exact' | 'histogram';

export interface PercentileConfig {
  mode: PercentileMode;
  sampleThreshold: number;
  histogramBins: number;
}

const DEFAULT_CONFIG: PercentileConfig = {
  mode: 'exact',
  sampleThreshold: 10_000,
  histogramBins: 200,
};

export interface DistributionStats {
  min: number;
  max: number;
  mean: number;
  percentiles: Record<number, number>;
}

export function resolvePercentileConfig(config?: Partial<PercentileConfig>): PercentileConfig {
  return {
    mode: config?.mode ?? DEFAULT_CONFIG.mode,
    sampleThreshold: config?.sampleThreshold ?? DEFAULT_CONFIG.sampleThreshold,
    histogramBins: config?.histogramBins ?? DEFAULT_CONFIG.histogramBins,
  };
}

export function computeDistributionStats(
  values: number[],
  percentiles: number[],
  config?: Partial<PercentileConfig>
): DistributionStats {
  const percentileConfig = resolvePercentileConfig(config);

  if (values.length === 0) {
    return {
      min: 0,
      max: 0,
      mean: 0,
      percentiles: percentiles.reduce<Record<number, number>>((acc, percentile) => {
        acc[percentile] = 0;
        return acc;
      }, {}),
    };
  }

  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;

  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
    sum += value;
  }

  const mean = sum / values.length;

  const useApproximation =
    percentileConfig.mode === 'histogram' && values.length >= percentileConfig.sampleThreshold;

  const percentileValues = useApproximation
    ? computeHistogramPercentiles(values, percentiles, min, max, percentileConfig.histogramBins)
    : computeExactPercentiles(values, percentiles);

  return {
    min,
    max,
    mean,
    percentiles: percentileValues,
  };
}

function computeExactPercentiles(values: number[], percentiles: number[]): Record<number, number> {
  const sorted = [...values].sort((a, b) => a - b);
  const lastValue = sorted[sorted.length - 1] ?? 0;

  return percentiles.reduce<Record<number, number>>((acc, percentile) => {
    const rank = Math.floor(sorted.length * (percentile / 100));
    acc[percentile] = sorted[rank] ?? lastValue;
    return acc;
  }, {});
}

function computeHistogramPercentiles(
  values: number[],
  percentiles: number[],
  min: number,
  max: number,
  bins: number
): Record<number, number> {
  if (min === max) {
    return percentiles.reduce<Record<number, number>>((acc, percentile) => {
      acc[percentile] = min;
      return acc;
    }, {});
  }

  const safeBins = Math.max(1, bins);
  const range = max - min;
  const binWidth = range / safeBins;
  const counts = new Array<number>(safeBins).fill(0);

  for (const value of values) {
    const index = Math.min(safeBins - 1, Math.max(0, Math.floor((value - min) / binWidth)));
    counts[index] += 1;
  }

  const targets = percentiles.map((percentile) => ({
    percentile,
    rank: Math.floor(values.length * (percentile / 100)),
  }));

  const results: Record<number, number> = {};
  let cumulative = 0;
  let targetIndex = 0;

  for (let i = 0; i < counts.length; i++) {
    cumulative += counts[i];

    while (targetIndex < targets.length && cumulative > targets[targetIndex].rank) {
      const estimate = min + (i + 0.5) * binWidth;
      results[targets[targetIndex].percentile] = estimate;
      targetIndex += 1;
    }

    if (targetIndex >= targets.length) break;
  }

  for (const target of targets) {
    if (results[target.percentile] === undefined) {
      results[target.percentile] = max;
    }
  }

  return results;
}
