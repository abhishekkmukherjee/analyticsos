import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** LinkedIn Ads — B2B paid social performance. */
@Injectable()
export class LinkedInAdsConnector extends ScaffoldConnector {
  readonly sourceName = 'linkedin_ads';
  protected readonly baselines = {
    impressions: 21_000,
    clicks: 420,
    spend: 380,
    leads: 19,
  };
  protected readonly liveEnvVars = [
    'LINKEDIN_ACCESS_TOKEN',
    'LINKEDIN_AD_ACCOUNT_ID',
  ];
}
