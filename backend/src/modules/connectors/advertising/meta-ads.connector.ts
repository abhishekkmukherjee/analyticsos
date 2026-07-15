import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** Meta Ads (Facebook/Instagram) — paid social performance. */
@Injectable()
export class MetaAdsConnector extends ScaffoldConnector {
  readonly sourceName = 'meta_ads';
  protected readonly baselines = {
    impressions: 68_000,
    clicks: 1_450,
    spend: 510,
    conversions: 58,
  };
  protected readonly liveEnvVars = ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'];
}
