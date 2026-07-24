import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import type {
  ConnectorLogEvent,
  LogLevel,
} from '../connectors/logs/log-connector';
import { DEFAULT_LOG_PAGE_SIZE, type QueryLogsDto } from './dto/query-logs.dto';

/** Largest batch one ingest call accepts (Vector batches well below this). */
const MAX_INGEST_BATCH = 1000;
const DEFAULT_QUERY_HOURS = 24;

/** Fields lifted out of a raw ingested event; the rest go to `metadata`. */
const KNOWN_EVENT_FIELDS = new Set([
  'message',
  'msg',
  'level',
  'severity',
  'timestamp',
  'host',
  'service',
  'source',
]);

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Accept a push batch (Vector.dev http sink or anything JSON). Events are
   * arbitrary shapes — we normalize what we recognize and keep the rest in
   * metadata rather than rejecting, because dropping logs on schema drift is
   * worse than storing them loosely.
   */
  async ingest(tenantId: string, body: unknown, defaultSource?: string) {
    const rawEvents = Array.isArray(body) ? body : [body];
    if (rawEvents.length === 0) return { written: 0 };
    if (rawEvents.length > MAX_INGEST_BATCH) {
      throw new BadRequestException(
        `Batch too large: ${rawEvents.length} events (max ${MAX_INGEST_BATCH}).`,
      );
    }
    const events = rawEvents.map((raw) =>
      normalizeRawEvent(raw, defaultSource ?? 'ingest'),
    );
    return { written: await this.insertMany(tenantId, events) };
  }

  /**
   * Replace a source's events in a time range — sync's idempotent write path,
   * same contract as MetricsStore.deleteRange + insertMany.
   */
  async replaceRange(
    tenantId: string,
    source: string,
    start: Date,
    end: Date,
    events: ConnectorLogEvent[],
  ): Promise<number> {
    await this.prisma.logEvent.deleteMany({
      where: { tenantId, source, timestamp: { gte: start, lte: end } },
    });
    return this.insertMany(tenantId, events);
  }

  async query(tenantId: string, dto: QueryLogsDto) {
    const end = dto.end ? new Date(dto.end) : new Date();
    const start = dto.start
      ? new Date(dto.start)
      : new Date(end.getTime() - DEFAULT_QUERY_HOURS * 3_600_000);
    const events = await this.prisma.logEvent.findMany({
      where: {
        tenantId,
        timestamp: { gte: start, lte: end },
        ...(dto.source ? { source: dto.source } : {}),
        ...(dto.level ? { level: dto.level } : {}),
        ...(dto.q ? { message: { contains: dto.q, mode: 'insensitive' } } : {}),
      },
      orderBy: { timestamp: 'desc' },
      take: dto.limit ?? DEFAULT_LOG_PAGE_SIZE,
    });
    return {
      range: { start: start.toISOString(), end: end.toISOString() },
      count: events.length,
      events,
    };
  }

  /** Event counts by source and level over a range — feeds dashboard panels. */
  async summary(tenantId: string, dto: QueryLogsDto) {
    const end = dto.end ? new Date(dto.end) : new Date();
    const start = dto.start
      ? new Date(dto.start)
      : new Date(end.getTime() - DEFAULT_QUERY_HOURS * 3_600_000);
    const grouped = await this.prisma.logEvent.groupBy({
      by: ['source', 'level'],
      where: {
        tenantId,
        timestamp: { gte: start, lte: end },
        ...(dto.source ? { source: dto.source } : {}),
      },
      _count: { _all: true },
    });
    const sources: Record<string, Record<string, number>> = {};
    let total = 0;
    for (const row of grouped) {
      sources[row.source] ??= {};
      sources[row.source][row.level] = row._count._all;
      total += row._count._all;
    }
    return {
      range: { start: start.toISOString(), end: end.toISOString() },
      total,
      sources,
    };
  }

  private async insertMany(
    tenantId: string,
    events: ConnectorLogEvent[],
  ): Promise<number> {
    if (events.length === 0) return 0;
    const result = await this.prisma.logEvent.createMany({
      data: events.map((e) => ({
        tenantId,
        source: e.source,
        level: e.level,
        message: e.message,
        host: e.host,
        service: e.service,
        metadata: e.metadata as Prisma.InputJsonValue,
        timestamp: e.timestamp,
      })),
    });
    return result.count;
  }
}

/** Best-effort mapping of an arbitrary pushed event onto our log shape. */
function normalizeRawEvent(
  raw: unknown,
  defaultSource: string,
): ConnectorLogEvent {
  if (raw === null || typeof raw !== 'object') {
    return {
      source: defaultSource,
      level: 'info',
      message: String(raw),
      metadata: {},
      timestamp: new Date(),
    };
  }
  const event = raw as Record<string, unknown>;
  const metadata: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(event)) {
    if (!KNOWN_EVENT_FIELDS.has(key)) metadata[key] = value;
  }
  const rawTimestamp = event.timestamp;
  const timestamp =
    typeof rawTimestamp === 'string' || typeof rawTimestamp === 'number'
      ? new Date(rawTimestamp)
      : new Date(NaN);
  return {
    source: asString(event.source) ?? defaultSource,
    level: normalizeLevel(event.level ?? event.severity),
    message:
      asString(event.message) ?? asString(event.msg) ?? JSON.stringify(raw),
    host: asString(event.host),
    service: asString(event.service),
    metadata,
    timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
  };
}

/** Collapse syslog-style severities onto our four levels. */
function normalizeLevel(value: unknown): LogLevel {
  const level = typeof value === 'string' ? value.toLowerCase() : '';
  if (level === 'trace' || level === 'debug') return 'debug';
  if (level === 'warn' || level === 'warning') return 'warn';
  if (
    ['err', 'error', 'crit', 'critical', 'alert', 'emerg', 'fatal'].includes(
      level,
    )
  ) {
    return 'error';
  }
  return 'info';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}
