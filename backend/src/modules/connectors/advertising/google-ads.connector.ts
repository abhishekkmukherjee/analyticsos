import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** Google Ads — paid search spend and performance. */
@Injectable()
export class GoogleAdsConnector extends ScaffoldConnector {
  readonly sourceName = 'google_ads';
  protected readonly baselines = {
    impressions: 52_000,
    clicks: 1_800,
    cost: 640,
    conversions: 74,
  };
  protected readonly liveEnvVars = [
    'GOOGLE_ADS_DEVELOPER_TOKEN',
    'GOOGLE_ADS_CREDENTIALS_JSON',
  ];
}
