/**
 * Lightweight metrics collector for Criterion Server
 *
 * Exposes metrics in Prometheus format without external dependencies.
 */

export interface MetricsOptions {
  /** Enable metrics collection (default: false) */
  enabled?: boolean;
  /** Endpoint path for metrics (default: /metrics) */
  endpoint?: string;
  /** Histogram buckets for latency in seconds */
  buckets?: number[];
}

interface MetricLabels {
  [key: string]: string;
}

interface CounterValue {
  labels: MetricLabels;
  value: number;
}

interface HistogramValue {
  labels: MetricLabels;
  sum: number;
  count: number;
  buckets: Map<number, number>;
}

/**
 * Simple metrics collector that outputs Prometheus format
 */
export class MetricsCollector {
  private counters: Map<string, CounterValue[]> = new Map();
  private histograms: Map<string, HistogramValue[]> = new Map();
  private buckets: number[];

  constructor(options: MetricsOptions = {}) {
    // Default histogram buckets (in seconds)
    this.buckets = options.buckets ?? [
      0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10,
    ];
  }

  /**
   * Increment a counter metric
   */
  increment(name: string, labels: MetricLabels = {}, value: number = 1): void {
    const existing = this.findCounter(name, labels);
    if (existing) {
      existing.value += value;
    } else {
      if (!this.counters.has(name)) {
        this.counters.set(name, []);
      }
      this.counters.get(name)!.push({ labels, value });
    }
  }

  /**
   * Record a value in a histogram metric
   */
  observe(name: string, labels: MetricLabels, value: number): void {
    const existing = this.findHistogram(name, labels);
    if (existing) {
      existing.sum += value;
      existing.count += 1;
      for (const bucket of this.buckets) {
        if (value <= bucket) {
          existing.buckets.set(bucket, (existing.buckets.get(bucket) ?? 0) + 1);
        }
      }
    } else {
      if (!this.histograms.has(name)) {
        this.histograms.set(name, []);
      }
      const bucketMap = new Map<number, number>();
      for (const bucket of this.buckets) {
        bucketMap.set(bucket, value <= bucket ? 1 : 0);
      }
      this.histograms.get(name)!.push({
        labels,
        sum: value,
        count: 1,
        buckets: bucketMap,
      });
    }
  }

  /**
   * Get a counter value
   */
  getCounter(name: string, labels: MetricLabels = {}): number {
    return this.findCounter(name, labels)?.value ?? 0;
  }

  /**
   * Get histogram stats
   */
  getHistogram(
    name: string,
    labels: MetricLabels
  ): { sum: number; count: number } | undefined {
    const h = this.findHistogram(name, labels);
    if (!h) return undefined;
    return { sum: h.sum, count: h.count };
  }

  /**
   * Export all metrics in Prometheus format
   */
  toPrometheus(): string {
    const lines: string[] = [];

    // Counters
    for (const [name, values] of this.counters) {
      lines.push(`# HELP ${name} Counter metric`);
      lines.push(`# TYPE ${name} counter`);
      for (const v of values) {
        const labelStr = this.formatLabels(v.labels);
        lines.push(`${name}${labelStr} ${v.value}`);
      }
    }

    // Histograms
    for (const [name, values] of this.histograms) {
      lines.push(`# HELP ${name} Histogram metric`);
      lines.push(`# TYPE ${name} histogram`);
      for (const v of values) {
        const baseLabels = this.formatLabels(v.labels);
        // Bucket values (cumulative)
        let cumulative = 0;
        for (const bucket of this.buckets) {
          cumulative += v.buckets.get(bucket) ?? 0;
          const bucketLabels = this.formatLabels({ ...v.labels, le: String(bucket) });
          lines.push(`${name}_bucket${bucketLabels} ${cumulative}`);
        }
        // +Inf bucket
        const infLabels = this.formatLabels({ ...v.labels, le: "+Inf" });
        lines.push(`${name}_bucket${infLabels} ${v.count}`);
        // Sum and count
        lines.push(`${name}_sum${baseLabels} ${v.sum}`);
        lines.push(`${name}_count${baseLabels} ${v.count}`);
      }
    }

    return lines.join("\n");
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.histograms.clear();
  }

  private findCounter(name: string, labels: MetricLabels): CounterValue | undefined {
    const values = this.counters.get(name);
    if (!values) return undefined;
    return values.find((v) => this.labelsMatch(v.labels, labels));
  }

  private findHistogram(name: string, labels: MetricLabels): HistogramValue | undefined {
    const values = this.histograms.get(name);
    if (!values) return undefined;
    return values.find((v) => this.labelsMatch(v.labels, labels));
  }

  private labelsMatch(a: MetricLabels, b: MetricLabels): boolean {
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key) => a[key] === b[key]);
  }

  private formatLabels(labels: MetricLabels): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return "";
    const parts = entries.map(([k, v]) => `${k}="${v}"`);
    return `{${parts.join(",")}}`;
  }
}

// Metric names
export const METRIC_EVALUATIONS_TOTAL = "criterion_evaluations_total";
export const METRIC_EVALUATION_DURATION_SECONDS = "criterion_evaluation_duration_seconds";
export const METRIC_RULE_MATCHES_TOTAL = "criterion_rule_matches_total";
