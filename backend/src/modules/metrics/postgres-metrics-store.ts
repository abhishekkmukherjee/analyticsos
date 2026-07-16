import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { ConnectorMetric } from '../connectors/base-connector';
import type { MetricQuery, MetricsStore } from './metrics-store.interface';

/**
 * Postgres-backed metrics store (via Prisma). The default implementation until
 * a ClickHouse cluster is provisioned — see MetricsStore for the seam.
 */
@Injectable()
export class PostgresMetricsStore implements MetricsStore {
  constructor(private readonly prisma: PrismaService) {}

  async insertMany(
    tenantId: string,
    metrics: ConnectorMetric[],
  ): Promise<number> {
    if (metrics.length === 0) return 0;
    const result = await this.prisma.metric.createMany({
      data: metrics.map((m) => ({
        tenantId,
        source: m.source,
        metricName: m.metricName,
        dimensions: m.dimensions,
        value: m.value,
        recordedAt: m.recordedAt,
      })),
    });
    return result.count;
  }

  async deleteRange(
    tenantId: string,
    source: string,
    start: Date,
    end: Date,
  ): Promise<number> {
    const result = await this.prisma.metric.deleteMany({
      where: {
        tenantId,
        source,
        recordedAt: { gte: start, lte: end },
      },
    });
    return result.count;
  }

  async query(q: MetricQuery): Promise<ConnectorMetric[]> {
    const rows = await this.prisma.metric.findMany({
      where: {
        tenantId: q.tenantId,
        ...(q.source ? { source: q.source } : {}),
        ...(q.metricName ? { metricName: q.metricName } : {}),
        recordedAt: { gte: q.start, lte: q.end },
      },
      orderBy: { recordedAt: 'asc' },
    });
    return rows.map((r) => ({
      metricName: r.metricName,
      value: r.value,
      dimensions: (r.dimensions ?? {}) as Record<string, string>,
      recordedAt: r.recordedAt,
      source: r.source,
    }));
  }
}
