import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** Stripe — payments, revenue, and subscription metrics. */
@Injectable()
export class StripeConnector extends ScaffoldConnector {
  readonly sourceName = 'stripe';
  protected readonly baselines = {
    revenue: 8_400,
    charges: 132,
    refunds: 6,
    mrr: 42_000,
  };
  protected readonly liveEnvVars = ['STRIPE_API_KEY'];
}
