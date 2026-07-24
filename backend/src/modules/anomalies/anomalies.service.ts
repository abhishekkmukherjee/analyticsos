import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Anomaly } from '../../generated/prisma/client';
import { LOG_METRIC_NAMES } from '../connectors/logs/log-connector';
import { detectAnomalies, type AnomalyFinding } from './anomaly-detector';
import type { ListAnomaliesDto } from './dto/list-anomalies.dto';

/** How much history feeds the baseline for each judged day. */
const DETECTION_WINDOW_DAYS = 30;
/** How many most-recent days are judged on each detection run. */
const EVALUATION_DAYS = 3;
const DEFAULT_FEED_SIZE = 50;
const DAY_MS = 86_400_000;

@Injectable()
export class AnomaliesService {
  private readonly logger = new Logger(AnomaliesService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Run error-spike detection over every source with log events, or just one
   * source when given. Daily error counts are aggregated from the LogEvent
   * table directly — not from synced metrics — so logs pushed by real
   * Vector.dev agents drive alerts exactly like connector syncs do. Runs after
   * each log sync and on demand via POST /anomalies/detect; a cron schedule
   * joins the Phase 4 alerting engine.
   */
  async detect(tenantId: string, onlySource?: string) {
    const sources = onlySource ? [onlySource] : await this.logSources(tenantId);
    const end = new Date();
    const start = new Date(end.getTime() - DETECTION_WINDOW_DAYS * DAY_MS);

    const persisted: Anomaly[] = [];
    for (const source of sources) {
      const series = await this.dailyErrorSeries(tenantId, source, start, end);
      const findings = detectAnomalies(series, EVALUATION_DAYS).filter(
        // Phase 3 alerts on error *spikes*; a drop in errors is not an incident.
        (f) => f.direction === 'spike',
      );
      for (const finding of findings) {
        persisted.push(await this.persist(tenantId, source, finding));
        this.alert(source, finding);
      }
    }
    return {
      sourcesEvaluated: sources.length,
      found: persisted.length,
      anomalies: persisted,
    };
  }

  list(tenantId: string, dto: ListAnomaliesDto) {
    return this.prisma.anomaly.findMany({
      where: {
        tenantId,
        ...(dto.status ? { status: dto.status } : {}),
        ...(dto.source ? { source: dto.source } : {}),
      },
      orderBy: { detectedAt: 'desc' },
      take: dto.limit ?? DEFAULT_FEED_SIZE,
    });
  }

  async updateStatus(tenantId: string, id: string, status: string) {
    const existing = await this.prisma.anomaly.findFirst({
      where: { id, tenantId },
    });
    if (!existing) throw new NotFoundException(`Anomaly ${id} not found`);
    return this.prisma.anomaly.update({ where: { id }, data: { status } });
  }

  /**
   * Errors per calendar day for one source. Days with logs but zero errors
   * count as 0; days before the source's first event are excluded so a source
   * that only started shipping recently doesn't get a fake all-zero baseline.
   */
  private async dailyErrorSeries(
    tenantId: string,
    source: string,
    start: Date,
    end: Date,
  ) {
    const range = { gte: start, lte: end };
    const first = await this.prisma.logEvent.findFirst({
      where: { tenantId, source, timestamp: range },
      orderBy: { timestamp: 'asc' },
      select: { timestamp: true },
    });
    if (!first) return [];

    const errors = await this.prisma.logEvent.findMany({
      where: { tenantId, source, level: 'error', timestamp: range },
      select: { timestamp: true },
    });
    const counts = new Map<string, number>();
    for (
      let t = startOfUtcDay(first.timestamp).getTime();
      t <= end.getTime();
      t += DAY_MS
    ) {
      counts.set(isoDay(new Date(t)), 0);
    }
    for (const row of errors) {
      const day = isoDay(row.timestamp);
      counts.set(day, (counts.get(day) ?? 0) + 1);
    }
    return [...counts].map(([date, value]) => ({ date, value }));
  }

  /**
   * Upsert by (source, metric, window) — re-detection refreshes the row
   * instead of stacking duplicates, but never resurrects one a user already
   * acknowledged or resolved.
   */
  private async persist(tenantId: string, source: string, f: AnomalyFinding) {
    const windowStart = new Date(`${f.date}T00:00:00.000Z`);
    const windowEnd = new Date(windowStart.getTime() + DAY_MS);
    const where = {
      tenantId,
      source,
      metricName: LOG_METRIC_NAMES.errors,
      windowStart,
    };
    const existing = await this.prisma.anomaly.findFirst({ where });
    const data = {
      severity: f.severity,
      zscore: f.zscore,
      observed: f.observed,
      expected: f.expected,
      windowEnd,
      context: { direction: f.direction },
    };
    if (existing) {
      return this.prisma.anomaly.update({
        where: { id: existing.id },
        data: existing.status === 'open' ? data : {},
      });
    }
    return this.prisma.anomaly.create({ data: { ...where, ...data } });
  }

  /**
   * Phase 3 alert channel: structured server log. The Phase 4 alert system
   * (notification service, queues, digests) plugs in here.
   */
  private alert(source: string, f: AnomalyFinding) {
    this.logger.warn(
      `ALERT [${f.severity}] error spike on ${source} (${f.date}): ` +
        `observed ${f.observed} vs expected ${f.expected} (z=${f.zscore})`,
    );
  }

  private async logSources(tenantId: string): Promise<string[]> {
    const rows = await this.prisma.logEvent.findMany({
      where: { tenantId },
      distinct: ['source'],
      select: { source: true },
    });
    return rows.map((r) => r.source);
  }
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
