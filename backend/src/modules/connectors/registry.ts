import { Inject, Injectable } from '@nestjs/common';
import { BaseConnector } from './base-connector';

/** DI token for the list of all connector instances. */
export const CONNECTORS = Symbol('CONNECTORS');

/**
 * Central lookup of every available source connector, keyed by sourceName.
 * Connectors are collected via the CONNECTORS token (assembled in
 * ConnectorsModule) so adding a source is a one-line change there.
 */
@Injectable()
export class ConnectorRegistry {
  private readonly connectors = new Map<string, BaseConnector>();

  constructor(@Inject(CONNECTORS) connectors: BaseConnector[]) {
    for (const connector of connectors) {
      this.connectors.set(connector.sourceName, connector);
    }
  }

  get(source: string): BaseConnector | undefined {
    return this.connectors.get(source);
  }

  list(): string[] {
    return [...this.connectors.keys()];
  }
}
