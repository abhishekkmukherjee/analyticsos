import { Injectable } from '@nestjs/common';
import { BaseConnector } from './base-connector';
import { Ga4Connector } from './analytics/ga4.connector';

/**
 * Central lookup of every available source connector, keyed by sourceName.
 * New connectors register themselves here (inject + add to the constructor
 * list). Everything else (metrics, chat, workers) resolves connectors through
 * this registry rather than newing them up.
 */
@Injectable()
export class ConnectorRegistry {
  private readonly connectors = new Map<string, BaseConnector>();

  constructor(ga4: Ga4Connector) {
    this.register(ga4);
  }

  private register(connector: BaseConnector): void {
    this.connectors.set(connector.sourceName, connector);
  }

  get(source: string): BaseConnector | undefined {
    return this.connectors.get(source);
  }

  list(): string[] {
    return [...this.connectors.keys()];
  }
}
