import { Logger } from '@nestjs/common';
import { BaseConnector, ConnectorMetric } from './base-connector';
import { mockMetricStream, type MetricBaselines } from './mock-metrics';

/**
 * Base class for connectors that are scaffolded (mock) until their live API is
 * implemented. A concrete connector only declares its source name, the metrics
 * it produces, and which env vars enable live mode. When those env vars are all
 * present, live mode is expected — until the real API call is written it throws
 * a clear "not implemented" so mock data never masquerades as live.
 */
export abstract class ScaffoldConnector extends BaseConnector {
  protected readonly logger = new Logger(this.constructor.name);

  /** metricName → daily baseline used to synthesize mock data. */
  protected abstract readonly baselines: MetricBaselines;

  /** Env vars that must all be set for this source to run live. */
  protected abstract readonly liveEnvVars: string[];

  protected get isLive(): boolean {
    return this.liveEnvVars.every((name) => Boolean(process.env[name]));
  }

  async authenticate(): Promise<boolean> {
    if (!this.isLive) {
      this.logger.warn(
        `${this.sourceName} in MOCK mode — set ${this.liveEnvVars.join(', ')} for live.`,
      );
    }
    return true;
  }

  async *fetchMetrics(
    _tenantId: string,
    start: Date,
    end: Date,
  ): AsyncGenerator<ConnectorMetric> {
    if (this.isLive) {
      throw new Error(
        `${this.sourceName} live mode not implemented yet — add the API call.`,
      );
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
}
