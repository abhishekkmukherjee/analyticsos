import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthContext } from '../../common/auth/auth-context';
import { ConnectorRegistry } from './registry';
import { MetricsQueryDto } from './dto/metrics-query.dto';

const DEFAULT_RANGE_DAYS = 7;

@Controller('connectors')
export class ConnectorsController {
  constructor(private readonly registry: ConnectorRegistry) {}

  /** List every available source and its health/mode. */
  @Get()
  async list() {
    const sources = this.registry.list();
    const connectors = await Promise.all(
      sources.map(async (source) => {
        const connector = this.registry.get(source)!;
        return connector.healthCheck();
      }),
    );
    return { connectors };
  }

  /** Pull a date range of metrics for the current tenant from one source. */
  @Get(':source/metrics')
  async metrics(
    @Param('source') source: string,
    @Query() query: MetricsQueryDto,
    @CurrentUser() user: AuthContext,
  ) {
    const connector = this.registry.get(source);
    if (!connector) {
      throw new NotFoundException(`Unknown connector source: ${source}`);
    }

    const end = query.end ? new Date(query.end) : new Date();
    const start = query.start
      ? new Date(query.start)
      : addDays(end, -DEFAULT_RANGE_DAYS);

    const metrics = await connector.collect(user.tenantId, start, end);
    return {
      source,
      tenantId: user.tenantId,
      range: { start: start.toISOString(), end: end.toISOString() },
      count: metrics.length,
      metrics,
    };
  }
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
