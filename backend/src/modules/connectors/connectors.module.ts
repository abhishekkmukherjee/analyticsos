import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { ConnectorRegistry } from './registry';
import { Ga4Connector } from './analytics/ga4.connector';

@Module({
  controllers: [ConnectorsController],
  providers: [Ga4Connector, ConnectorRegistry],
  exports: [ConnectorRegistry],
})
export class ConnectorsModule {}
