/**
 * A single measured value pulled from a data source. This is the common
 * currency every connector produces, regardless of vendor.
 */
export interface ConnectorMetric {
  metricName: string;
  value: number;
  dimensions: Record<string, string>;
  recordedAt: Date;
  source: string;
}

/**
 * The reference pattern every data-source connector follows (see the
 * Engineering Guide §5). Concrete connectors implement authenticate /
 * fetchMetrics / healthCheck; `collect()` is the shared helper that drains the
 * async stream into an array. When ClickHouse lands (Phase 2) a `sync()` that
 * streams each metric into storage will live here too.
 */
export abstract class BaseConnector {
  abstract readonly sourceName: string;
  readonly supportsRealtime: boolean = false;

  abstract authenticate(credentials: Record<string, unknown>): Promise<boolean>;

  abstract fetchMetrics(
    tenantId: string,
    start: Date,
    end: Date,
  ): AsyncGenerator<ConnectorMetric>;

  abstract healthCheck(): Promise<Record<string, unknown>>;

  /** Drain fetchMetrics into an array. Fine for API responses; streaming
   *  into ClickHouse will replace this for large syncs later. */
  async collect(
    tenantId: string,
    start: Date,
    end: Date,
  ): Promise<ConnectorMetric[]> {
    const out: ConnectorMetric[] = [];
    for await (const metric of this.fetchMetrics(tenantId, start, end)) {
      out.push(metric);
    }
    return out;
  }
}
