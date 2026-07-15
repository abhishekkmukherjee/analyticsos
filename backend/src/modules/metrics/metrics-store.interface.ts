import type { ConnectorMetric } from '../connectors/base-connector';

/** DI token for the active MetricsStore implementation. */
export const METRICS_STORE = Symbol('METRICS_STORE');

export interface MetricQuery {
  tenantId: string;
  source?: string;
  metricName?: string;
  start: Date;
  end: Date;
}

/**
 * Storage boundary for time-series metrics. Today it's backed by Postgres
 * (PostgresMetricsStore); swapping in a ClickHouse-backed implementation later
 * means writing one class and changing the provider in MetricsModule — nothing
 * upstream (connectors, sync, query API) changes.
 */
export interface MetricsStore {
  /** Persist a batch of metrics for a tenant. Returns rows written. */
  insertMany(tenantId: string, metrics: ConnectorMetric[]): Promise<number>;

  /** Read back metrics in a time range, optionally filtered by source/name. */
  query(query: MetricQuery): Promise<ConnectorMetric[]>;
}
