import { ScaffoldConnector } from '../scaffold-connector';
import type { ConnectorMetric } from '../base-connector';
import type { MetricBaselines } from '../mock-metrics';
import { mockLogStream, type LogProfile } from './mock-logs';

/** Log levels every source's events are normalized to. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * A single normalized log event — the log-side sibling of ConnectorMetric.
 * Everything vendor-specific goes in `metadata`.
 */
export interface ConnectorLogEvent {
  source: string;
  level: LogLevel;
  message: string;
  host?: string;
  service?: string;
  metadata: Record<string, unknown>;
  timestamp: Date;
}

/** Daily metric names derived from a source's log events. */
export const LOG_METRIC_NAMES = {
  total: 'log_events',
  errors: 'errors',
  warnings: 'warnings',
} as const;

/**
 * Base class for infra/log sources (nginx, docker, aws, ...). Unlike metric
 * connectors these produce *events*, not daily numbers; the daily metrics
 * (log_events / errors / warnings) are aggregated from the same event stream
 * so the existing metrics query/compare APIs work on log sources unchanged.
 *
 * Real log flow is push-based: a Vector.dev agent on the customer's server
 * POSTs to /api/v1/logs/ingest. The connector's live pull path (provider APIs
 * like CloudWatch) throws until implemented, same as every scaffold source.
 */
export abstract class LogConnector extends ScaffoldConnector {
  /** Shapes the mock stream: volume, services, message templates. */
  protected abstract readonly logProfile: LogProfile;

  /** Log metrics derive from events — the scaffold baseline path is unused. */
  protected readonly baselines: MetricBaselines = {};

  async *fetchLogs(
    _tenantId: string,
    start: Date,
    end: Date,
  ): AsyncGenerator<ConnectorLogEvent> {
    if (this.isLive) {
      throw new Error(
        `${this.sourceName} live pull not implemented yet — add the provider ` +
          `API call, or stream real logs by pointing a Vector.dev agent at ` +
          `POST /api/v1/logs/ingest.`,
      );
    }
    yield* mockLogStream(this.sourceName, this.logProfile, start, end);
  }

  /** Drain fetchLogs into an array (mirror of BaseConnector.collect). */
  async collectLogs(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<ConnectorLogEvent[]> {
    const out: ConnectorLogEvent[] = [];
    for await (const event of this.fetchLogs(tenantId, start, end)) {
      out.push(event);
    }
    return out;
  }

  /** Daily log_events / errors / warnings, aggregated from the event stream. */
  async *fetchMetrics(
    tenantId: string,
    start: Date,
    end: Date,
  ): AsyncGenerator<ConnectorMetric> {
    const byDay = new Map<
      string,
      { total: number; err: number; warn: number }
    >();
    for await (const event of this.fetchLogs(tenantId, start, end)) {
      const day = event.timestamp.toISOString().slice(0, 10);
      const bucket = byDay.get(day) ?? { total: 0, err: 0, warn: 0 };
      bucket.total += 1;
      if (event.level === 'error') bucket.err += 1;
      if (event.level === 'warn') bucket.warn += 1;
      byDay.set(day, bucket);
    }
    for (const [day, bucket] of byDay) {
      const recordedAt = new Date(`${day}T00:00:00.000Z`);
      const dimensions = { date: day };
      const rows: Array<[string, number]> = [
        [LOG_METRIC_NAMES.total, bucket.total],
        [LOG_METRIC_NAMES.errors, bucket.err],
        [LOG_METRIC_NAMES.warnings, bucket.warn],
      ];
      for (const [metricName, value] of rows) {
        yield {
          metricName,
          value,
          dimensions,
          recordedAt,
          source: this.sourceName,
        };
      }
    }
  }
}
