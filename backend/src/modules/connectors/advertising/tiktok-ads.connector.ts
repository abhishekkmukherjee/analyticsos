import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** TikTok Ads — short-form video paid performance. */
@Injectable()
export class TikTokAdsConnector extends ScaffoldConnector {
  readonly sourceName = 'tiktok_ads';
  protected readonly baselines = {
    impressions: 94_000,
    clicks: 2_100,
    spend: 430,
    conversions: 47,
  };
  protected readonly liveEnvVars = [
    'TIKTOK_ACCESS_TOKEN',
    'TIKTOK_ADVERTISER_ID',
  ];
}
