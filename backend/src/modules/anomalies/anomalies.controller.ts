import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/auth/current-user.decorator';
import type { AuthContext } from '../../common/auth/auth-context';
import { AnomaliesService } from './anomalies.service';
import { ListAnomaliesDto } from './dto/list-anomalies.dto';
import { UpdateAnomalyDto } from './dto/update-anomaly.dto';

@Controller('anomalies')
export class AnomaliesController {
  constructor(private readonly anomalies: AnomaliesService) {}

  @Get()
  list(@Query() dto: ListAnomaliesDto, @CurrentUser() user: AuthContext) {
    return this.anomalies.list(user.tenantId, dto);
  }

  /** Re-run detection now (also runs automatically after every log sync). */
  @Post('detect')
  detect(
    @Query('source') source: string | undefined,
    @CurrentUser() user: AuthContext,
  ) {
    return this.anomalies.detect(user.tenantId, source);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateAnomalyDto,
    @CurrentUser() user: AuthContext,
  ) {
    return this.anomalies.updateStatus(user.tenantId, id, dto.status);
  }
}
