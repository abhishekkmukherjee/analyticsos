import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** Shopify — storefront orders and revenue. */
@Injectable()
export class ShopifyConnector extends ScaffoldConnector {
  readonly sourceName = 'shopify';
  protected readonly baselines = {
    orders: 96,
    revenue: 11_200,
    aov: 116.6,
    sessions: 3_100,
  };
  protected readonly liveEnvVars = ['SHOPIFY_ACCESS_TOKEN', 'SHOPIFY_SHOP'];
}
