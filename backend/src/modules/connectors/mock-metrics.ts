import type { ConnectorMetric } from './base-connector';

/** Map of metricName → its typical daily baseline value. */
export type MetricBaselines = Record<string, number>;

/**
 * Deterministic daily mock metrics for a source over a date range. Same inputs
 * always produce the same numbers (seeded off the calendar day), so demos and
 * tests are reproducible without any external API.
 */
export async function* mockMetricStream(
  source: string,
  baselines: MetricBaselines,
  start: Date,
  end: Date,
): AsyncGenerator<ConnectorMetric> {
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    const wave = seededWave(day);
    for (const [metricName, baseline] of Object.entries(baselines)) {
      yield {
        metricName,
        value: round(baseline * wave, baseline < 100),
        dimensions: { date: isoDate(day) },
        recordedAt: new Date(day),
        source,
      };
    }
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Keep small metrics (rates, AOV) as decimals; round large ones to integers. */
function round(value: number, keepDecimals: boolean): number {
  return keepDecimals ? Math.round(value * 100) / 100 : Math.round(value);
}

/** Smooth deterministic 0.7–1.3 multiplier derived from the calendar day. */
function seededWave(date: Date): number {
  const seed = date.getUTCFullYear() * 366 + dayOfYear(date);
  return 0.7 + Math.abs(Math.sin(seed)) * 0.6;
}

function dayOfYear(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  return Math.floor((date.getTime() - startOfYear) / 86_400_000);
}
