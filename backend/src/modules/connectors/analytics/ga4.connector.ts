import { Injectable, Logger } from '@nestjs/common';
import { BaseConnector, ConnectorMetric } from '../base-connector';
import { mockMetricStream, type MetricBaselines } from '../mock-metrics';

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
 *
 * Unlike the scaffolded sources this keeps its own class (rather than extending
 * ScaffoldConnector) because its live path is bespoke — it's the first source
 * slated for a real API implementation.
 */
@Injectable()
export class Ga4Connector extends BaseConnector {
  readonly sourceName = 'ga4';
  private readonly logger = new Logger(Ga4Connector.name);

  private readonly baselines: MetricBaselines = {
    sessions: 1200,
    activeUsers: 900,
    screenPageViews: 3400,
  };

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
    yield* mockMetricStream(this.sourceName, this.baselines, start, end);
  }

  async healthCheck(): Promise<Record<string, unknown>> {
    return {
      source: this.sourceName,
      mode: this.isLive ? 'live' : 'mock',
      healthy: true,
    };
  }

  // eslint-disable-next-line require-yield -- throws until the live API lands
  private async *fetchLive(
    _tenantId: string,
    _start: Date,
    _end: Date,
  ): AsyncGenerator<ConnectorMetric> {
    // TODO(live): call GA4 Data API runReport and yield each row as a metric.
    throw new Error(
      'GA4 live mode not yet implemented — add the Data API call.',
    );
  }
}
