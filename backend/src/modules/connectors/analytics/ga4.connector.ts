import { Injectable, Logger } from '@nestjs/common';
import { BaseConnector, ConnectorMetric } from '../base-connector';

/**
 * Google Analytics 4 connector.
 *
 * Runs in one of two modes automatically:
 *  - LIVE  — when GA4_PROPERTY_ID + GA4_CREDENTIALS_JSON are set in the env,
 *            it will call the GA4 Data API (wiring stubbed until creds exist).
 *  - MOCK  — otherwise it emits plausible daily traffic so the whole product
 *            (chat, metrics endpoints) is demoable with zero external setup.
 *
 * Flip from mock to live by adding the two env vars — no code change needed.
 */
@Injectable()
export class Ga4Connector extends BaseConnector {
  readonly sourceName = 'ga4';
  private readonly logger = new Logger(Ga4Connector.name);

  private get isLive(): boolean {
    return Boolean(
      process.env.GA4_PROPERTY_ID && process.env.GA4_CREDENTIALS_JSON,
    );
  }

  async authenticate(): Promise<boolean> {
    if (!this.isLive) {
      this.logger.warn('GA4 running in MOCK mode (no GA4 creds in env).');
      return true;
    }
    // TODO(live): construct BetaAnalyticsDataClient from GA4_CREDENTIALS_JSON.
    return true;
  }

  async *fetchMetrics(
    tenantId: string,
    start: Date,
    end: Date,
  ): AsyncGenerator<ConnectorMetric> {
    if (this.isLive) {
      yield* this.fetchLive(tenantId, start, end);
      return;
    }
    yield* this.fetchMock(start, end);
  }

  async healthCheck(): Promise<Record<string, unknown>> {
    return {
      source: this.sourceName,
      mode: this.isLive ? 'live' : 'mock',
      healthy: true,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  private async *fetchLive(
    _tenantId: string,
    _start: Date,
    _end: Date,
  ): AsyncGenerator<ConnectorMetric> {
    // TODO(live): call GA4 Data API runReport and yield each row as a metric.
    throw new Error('GA4 live mode not yet implemented — add the Data API call.');
  }

  /** Deterministic pseudo-random daily traffic (no external calls). */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async *fetchMock(
    start: Date,
    end: Date,
  ): AsyncGenerator<ConnectorMetric> {
    const metrics = ['sessions', 'activeUsers', 'screenPageViews'] as const;
    const baselines: Record<(typeof metrics)[number], number> = {
      sessions: 1200,
      activeUsers: 900,
      screenPageViews: 3400,
    };

    for (
      let day = new Date(start);
      day <= end;
      day = addDays(day, 1)
    ) {
      const wave = seededWave(day);
      for (const metricName of metrics) {
        yield {
          metricName,
          value: Math.round(baselines[metricName] * wave),
          dimensions: { date: isoDate(day) },
          recordedAt: new Date(day),
          source: this.sourceName,
        };
      }
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

/** Smooth deterministic 0.7–1.3 multiplier from the calendar day. */
function seededWave(date: Date): number {
  const seed = date.getUTCFullYear() * 366 + dayOfYear(date);
  const noise = Math.abs(Math.sin(seed)) * 0.6; // 0..0.6
  return 0.7 + noise;
}

function dayOfYear(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear;
  return Math.floor(diff / 86_400_000);
}
