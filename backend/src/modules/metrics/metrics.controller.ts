import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthContext } from '../../common/auth/auth-context';
import { MetricsService } from './metrics.service';
import { QueryMetricsDto } from './dto/query-metrics.dto';

@Controller('metrics')
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Get('query')
  query(@Query() dto: QueryMetricsDto, @CurrentUser() user: AuthContext) {
    return this.metrics.query(user.tenantId, dto);
  }

  @Get('compare')
  compare(@Query() dto: QueryMetricsDto, @CurrentUser() user: AuthContext) {
    return this.metrics.compare(user.tenantId, dto);
  }
}
