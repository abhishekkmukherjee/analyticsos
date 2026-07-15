import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** HubSpot — CRM contacts, deals, and pipeline value. */
@Injectable()
export class HubSpotConnector extends ScaffoldConnector {
  readonly sourceName = 'hubspot';
  protected readonly baselines = {
    newContacts: 58,
    dealsCreated: 12,
    dealValue: 34_000,
  };
  protected readonly liveEnvVars = ['HUBSPOT_ACCESS_TOKEN'];
}
