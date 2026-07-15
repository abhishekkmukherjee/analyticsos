import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConnectorRegistry } from '../connectors/registry';
import {
  METRICS_STORE,
  type MetricsStore,
} from '../metrics/metrics-store.interface';
import type { CreateConnectionDto } from './dto/create-connection.dto';

const SYNC_WINDOW_DAYS = 30;

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
        config: (dto.config ?? {}) as object,
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

    const end = new Date();
    const start = new Date(end.getTime() - SYNC_WINDOW_DAYS * 86_400_000);

    try {
      const metrics = await connector.collect(tenantId, start, end);
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
