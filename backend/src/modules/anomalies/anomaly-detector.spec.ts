import {
  ANOMALY_ZSCORE_THRESHOLD,
  MIN_BASELINE_DAYS,
  detectAnomalies,
  type SeriesPoint,
} from './anomaly-detector';

function series(values: number[]): SeriesPoint[] {
  return values.map((value, i) => ({
    date: `2026-07-${String(i + 1).padStart(2, '0')}`,
    value,
  }));
}

describe('detectAnomalies', () => {
  it('returns nothing when the baseline is too short', () => {
    const short = series(
      Array.from({ length: MIN_BASELINE_DAYS - 1 }, () => 5).concat([500]),
    );
    expect(detectAnomalies(short, 1)).toEqual([]);
  });

  it('ignores normal day-to-day variation', () => {
    const calm = series([18, 22, 20, 19, 21, 23, 17, 20, 22, 19]);
    expect(detectAnomalies(calm, 3)).toEqual([]);
  });

  it('flags a large error spike as critical', () => {
    const spiked = series([20, 21, 19, 22, 18, 20, 23, 21, 19, 120]);
    const findings = detectAnomalies(spiked, 1);
    expect(findings).toHaveLength(1);
    expect(findings[0]).toMatchObject({
      date: '2026-07-10',
      observed: 120,
      severity: 'critical',
      direction: 'spike',
    });
    expect(findings[0].zscore).toBeGreaterThan(ANOMALY_ZSCORE_THRESHOLD);
  });

  it('flags collapses as drops', () => {
    const dropped = series([50, 52, 48, 51, 49, 50, 53, 47, 50, 2]);
    const [finding] = detectAnomalies(dropped, 1);
    expect(finding.direction).toBe('drop');
  });

  it('excludes evaluated days from their own baseline', () => {
    // Two spike days in the evaluated window: if the baseline included them,
    // the inflated σ would mask both.
    const doubleSpike = series([10, 11, 9, 10, 12, 10, 11, 10, 95, 90]);
    const findings = detectAnomalies(doubleSpike, 2);
    expect(findings.map((f) => f.observed).sort()).toEqual([90, 95]);
  });

  it('survives a perfectly flat baseline via the stddev floor', () => {
    const flat = series([5, 5, 5, 5, 5, 5, 5, 5, 5, 40]);
    const [finding] = detectAnomalies(flat, 1);
    expect(finding.severity).toBe('critical');
    expect(Number.isFinite(finding.zscore)).toBe(true);
  });
});
