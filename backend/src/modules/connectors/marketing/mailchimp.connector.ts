import { Injectable } from '@nestjs/common';
import { ScaffoldConnector } from '../scaffold-connector';

/** Mailchimp — email campaign engagement. */
@Injectable()
export class MailchimpConnector extends ScaffoldConnector {
  readonly sourceName = 'mailchimp';
  protected readonly baselines = {
    sent: 12_000,
    opens: 3_600,
    clicks: 540,
    unsubscribes: 22,
  };
  protected readonly liveEnvVars = ['MAILCHIMP_API_KEY', 'MAILCHIMP_SERVER'];
}
