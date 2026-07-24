/**
 * Statistical anomaly detection — plain TypeScript z-score math (Engineering
 * Guide §: basic detection is native TS; ML models arrive in Phase 4 via the
 * Python service). Pure functions, no I/O, so the thresholds are unit-testable.
 */

/** Deviation (in σ) at which a point becomes an anomaly (guide: ±2.5σ). */
export const ANOMALY_ZSCORE_THRESHOLD = 2.5;
/** Deviation at which an anomaly escalates from 'warning' to 'critical'. */
export const CRITICAL_ZSCORE_THRESHOLD = 4;
/** Minimum baseline points required before a series can be judged at all. */
export const MIN_BASELINE_DAYS = 7;
/**
 * Floor on σ so flat baselines (e.g. constant 2 errors/day) don't turn a
 * one-count blip into an infinite z-score.
 */
export const STDDEV_FLOOR = 1;

export interface SeriesPoint {
  /** ISO calendar day, e.g. '2026-07-24'. */
  date: string;
  value: number;
}

export interface AnomalyFinding {
  date: string;
  observed: number;
  /** Baseline mean the observation was judged against. */
  expected: number;
  zscore: number;
  severity: 'warning' | 'critical';
  direction: 'spike' | 'drop';
}

/**
 * Judge the last {evaluateLast} points of a daily series against the history
 * before them. Each evaluated point's baseline excludes the evaluated points
 * themselves, so one huge spike doesn't inflate σ and mask itself.
 */
export function detectAnomalies(
  series: SeriesPoint[],
  evaluateLast: number,
): AnomalyFinding[] {
  const ordered = [...series].sort((a, b) => a.date.localeCompare(b.date));
  const splitAt = Math.max(0, ordered.length - evaluateLast);
  const baseline = ordered.slice(0, splitAt);
  if (baseline.length < MIN_BASELINE_DAYS) return [];

  const values = baseline.map((p) => p.value);
  const mean = avg(values);
  const sigma = Math.max(stddev(values, mean), STDDEV_FLOOR);

  const findings: AnomalyFinding[] = [];
  for (const point of ordered.slice(splitAt)) {
    const zscore = (point.value - mean) / sigma;
    if (Math.abs(zscore) < ANOMALY_ZSCORE_THRESHOLD) continue;
    findings.push({
      date: point.date,
      observed: point.value,
      expected: round2(mean),
      zscore: round2(zscore),
      severity:
        Math.abs(zscore) >= CRITICAL_ZSCORE_THRESHOLD ? 'critical' : 'warning',
      direction: zscore > 0 ? 'spike' : 'drop',
    });
  }
  return findings;
}

function avg(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function stddev(values: number[], mean: number): number {
  const variance = avg(values.map((v) => (v - mean) ** 2));
  return Math.sqrt(variance);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
