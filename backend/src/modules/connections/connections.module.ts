import { Module } from '@nestjs/common';
import { ConnectorsModule } from '../connectors/connectors.module';
import { MetricsModule } from '../metrics/metrics.module';
import { LogsModule } from '../logs/logs.module';
import { AnomaliesModule } from '../anomalies/anomalies.module';
import { ConnectionsController } from './connections.controller';
import { ConnectionsService } from './connections.service';

@Module({
  imports: [ConnectorsModule, MetricsModule, LogsModule, AnomaliesModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
})
export class ConnectionsModule {}
