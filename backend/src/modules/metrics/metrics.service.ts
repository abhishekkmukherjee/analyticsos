import { Inject, Injectable } from '@nestjs/common';
import type { ConnectorMetric } from '../connectors/base-connector';
import {
  METRICS_STORE,
  type MetricsStore,
} from './metrics-store.interface';
import type { QueryMetricsDto } from './dto/query-metrics.dto';

const DEFAULT_RANGE_DAYS = 30;

@Injectable()
export class MetricsService {
  constructor(
    @Inject(METRICS_STORE) private readonly store: MetricsStore,
  ) {}

  /** Time-series query with a running total. */
  async query(tenantId: string, dto: QueryMetricsDto) {
    const { start, end } = resolveRange(dto.start, dto.end);
    const series = await this.store.query({
      tenantId,
      source: dto.source,
      metricName: dto.metric,
      start,
      end,
    });
    return {
      source: dto.source ?? 'all',
      metric: dto.metric ?? 'all',
      range: { start: start.toISOString(), end: end.toISOString() },
      count: series.length,
      total: sum(series),
      series,
    };
  }

  /** Compare a period against the immediately preceding period of equal length. */
  async compare(tenantId: string, dto: QueryMetricsDto) {
    const { start, end } = resolveRange(dto.start, dto.end);
    const spanMs = end.getTime() - start.getTime();
    const prevEnd = new Date(start.getTime());
    const prevStart = new Date(start.getTime() - spanMs);

    const [current, previous] = await Promise.all([
      this.store.query({ tenantId, source: dto.source, metricName: dto.metric, start, end }),
      this.store.query({ tenantId, source: dto.source, metricName: dto.metric, start: prevStart, end: prevEnd }),
    ]);

    const currentTotal = sum(current);
    const previousTotal = sum(previous);
    return {
      source: dto.source ?? 'all',
      metric: dto.metric ?? 'all',
      current: { range: { start: start.toISOString(), end: end.toISOString() }, total: currentTotal },
      previous: { range: { start: prevStart.toISOString(), end: prevEnd.toISOString() }, total: previousTotal },
      changePct: percentChange(previousTotal, currentTotal),
    };
  }
}

function resolveRange(startIso?: string, endIso?: string): { start: Date; end: Date } {
  const end = endIso ? new Date(endIso) : new Date();
  const start = startIso
    ? new Date(startIso)
    : new Date(end.getTime() - DEFAULT_RANGE_DAYS * 86_400_000);
  return { start, end };
}

function sum(metrics: ConnectorMetric[]): number {
  return metrics.reduce((acc, m) => acc + m.value, 0);
}

function percentChange(from: number, to: number): number | null {
  if (from === 0) return null;
  return Math.round(((to - from) / from) * 1000) / 10;
}
