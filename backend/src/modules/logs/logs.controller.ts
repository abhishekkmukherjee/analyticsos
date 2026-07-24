import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthContext } from '../../common/auth/auth-context';
import { LogsService } from './logs.service';
import { QueryLogsDto } from './dto/query-logs.dto';

@Controller('logs')
export class LogsController {
  constructor(private readonly logs: LogsService) {}

  /**
   * Push endpoint for log shippers. A Vector.dev http sink posts a JSON array
   * here (encoding.codec = "json"), with the tenant header and an optional
   * ?source= identifying which connector the stream belongs to. The body is
   * deliberately untyped — shippers send arbitrary shapes and we normalize.
   */
  @Post('ingest')
  ingest(
    @Body() body: unknown,
    @Query('source') source: string | undefined,
    @CurrentUser() user: AuthContext,
  ) {
    return this.logs.ingest(user.tenantId, body, source);
  }

  @Get()
  query(@Query() dto: QueryLogsDto, @CurrentUser() user: AuthContext) {
    return this.logs.query(user.tenantId, dto);
  }

  @Get('summary')
  summary(@Query() dto: QueryLogsDto, @CurrentUser() user: AuthContext) {
    return this.logs.summary(user.tenantId, dto);
  }
}
