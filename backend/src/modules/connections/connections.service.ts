import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { Prisma } from '../../generated/prisma/client';
import { ConnectorRegistry } from '../connectors/registry';
import {
  METRICS_STORE,
  type MetricsStore,
} from '../metrics/metrics-store.interface';
import type { CreateConnectionDto } from './dto/create-connection.dto';

/**
 * How much history a sync pulls. Deliberately wider than the dashboard's
 * longest view (90d) so period-over-period comparisons always have a fully
 * populated previous window to compare against.
 */
const SYNC_WINDOW_DAYS = 180;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ConnectorRegistry,
    @Inject(METRICS_STORE) private readonly metrics: MetricsStore,
  ) {}

  /** List every connection for the tenant. */
  list(tenantId: string) {
    return this.prisma.connection.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Add a connection for a known source. */
  async create(tenantId: string, dto: CreateConnectionDto) {
    if (!this.registry.get(dto.source)) {
      throw new BadRequestException(`Unknown connector source: ${dto.source}`);
    }
    return this.prisma.connection.create({
      data: {
        tenantId,
        source: dto.source,
        displayName: dto.displayName ?? dto.source,
        // Cast is required: Prisma models JSON columns as InputJsonValue, which
        // a plain Record<string, unknown> doesn't structurally satisfy.
        config: (dto.config ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async remove(tenantId: string, id: string) {
    await this.getOwned(tenantId, id);
    await this.prisma.connection.delete({ where: { id } });
    return { deleted: true, id };
  }

  async status(tenantId: string, id: string) {
    const conn = await this.getOwned(tenantId, id);
    return {
      id: conn.id,
      source: conn.source,
      status: conn.status,
      lastSyncAt: conn.lastSyncAt,
    };
  }

  /** Pull the last {SYNC_WINDOW_DAYS} days from the source into the metrics store. */
  async sync(tenantId: string, id: string) {
    const conn = await this.getOwned(tenantId, id);
    const connector = this.registry.get(conn.source);
    if (!connector) {
      throw new BadRequestException(`Unknown connector source: ${conn.source}`);
    }

    // Snap to whole UTC days so every sync on a given day uses byte-identical
    // bounds. Without this, `now` drifts between runs and the delete range
    // misses the previous run's boundary row, leaving stale rows behind.
    const end = startOfUtcDay(new Date());
    const start = startOfUtcDay(
      new Date(end.getTime() - SYNC_WINDOW_DAYS * 86_400_000),
    );

    try {
      const metrics = await connector.collect(tenantId, start, end);
      // Replace the window rather than append — a repeated sync must not
      // double-count. Same reason a retried job is safe.
      await this.metrics.deleteRange(tenantId, conn.source, start, end);
      const written = await this.metrics.insertMany(tenantId, metrics);
      const updated = await this.prisma.connection.update({
        where: { id },
        data: { status: 'active', lastSyncAt: new Date() },
      });
      return {
        id: updated.id,
        source: updated.source,
        status: updated.status,
        lastSyncAt: updated.lastSyncAt,
        metricsWritten: written,
      };
    } catch (error) {
      await this.prisma.connection.update({
        where: { id },
        data: { status: 'error' },
      });
      throw new BadRequestException(
        `Sync failed for ${conn.source}: ${(error as Error).message}`,
      );
    }
  }

  /** Fetch a connection, enforcing tenant ownership. */
  private async getOwned(tenantId: string, id: string) {
    const conn = await this.prisma.connection.findFirst({
      where: { id, tenantId },
    });
    if (!conn) {
      throw new NotFoundException(`Connection ${id} not found`);
    }
    return conn;
  }
}

/** Midnight UTC on the same calendar day as `date`. */
function startOfUtcDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
