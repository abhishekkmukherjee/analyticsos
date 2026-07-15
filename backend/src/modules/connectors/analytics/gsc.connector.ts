import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** Google Search Console — organic search performance. */
@Injectable()
export class GscConnector extends ScaffoldConnector {
  readonly sourceName = 'gsc';
  protected readonly baselines = {
    clicks: 850,
    impressions: 24_000,
    ctr: 3.5,
    position: 12.4,
  };
  protected readonly liveEnvVars = ['GSC_SITE_URL', 'GSC_CREDENTIALS_JSON'];
}
