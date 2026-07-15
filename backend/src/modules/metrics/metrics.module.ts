import { Module, type Provider } from '@nestjs/common';
import { MetricsController } from './metrics.controller';
import { MetricsService } from './metrics.service';
import { METRICS_STORE } from './metrics-store.interface';
import { PostgresMetricsStore } from './postgres-metrics-store';

/**
 * Chooses the metrics backend. Postgres today; when CLICKHOUSE_URL is set a
 * ClickHouseMetricsStore should be constructed here instead — the rest of the
 * app depends only on the MetricsStore interface via the METRICS_STORE token.
 */
const metricsStoreProvider: Provider = {
  provide: METRICS_STORE,
  useFactory: (postgres: PostgresMetricsStore) => {
    // if (process.env.CLICKHOUSE_URL) return new ClickHouseMetricsStore(...);
    return postgres;
  },
  inject: [PostgresMetricsStore],
};

@Module({
  controllers: [MetricsController],
  providers: [PostgresMetricsStore, metricsStoreProvider, MetricsService],
  exports: [METRICS_STORE, MetricsService],
})
export class MetricsModule {}
