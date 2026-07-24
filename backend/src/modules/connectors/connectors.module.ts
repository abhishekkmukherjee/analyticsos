import { Module } from '@nestjs/common';
import { ConnectorsController } from './connectors.controller';
import { BaseConnector } from './base-connector';
import { ConnectorRegistry, CONNECTORS } from './registry';
import { Ga4Connector } from './analytics/ga4.connector';
import { GscConnector } from './analytics/gsc.connector';
import { GoogleAdsConnector } from './advertising/google-ads.connector';
import { MetaAdsConnector } from './advertising/meta-ads.connector';
import { LinkedInAdsConnector } from './advertising/linkedin-ads.connector';
import { TikTokAdsConnector } from './advertising/tiktok-ads.connector';
import { StripeConnector } from './commerce/stripe.connector';
import { ShopifyConnector } from './commerce/shopify.connector';
import { HubSpotConnector } from './crm/hubspot.connector';
import { MailchimpConnector } from './marketing/mailchimp.connector';
import { AwsLogsConnector } from './logs/aws.connector';
import { VultrLogsConnector } from './logs/vultr.connector';
import { HostingerLogsConnector } from './logs/hostinger.connector';
import { NginxLogsConnector } from './logs/nginx.connector';
import { DockerLogsConnector } from './logs/docker.connector';

// Every connector class. Add a new source by importing it and listing it here.
const CONNECTOR_CLASSES = [
  Ga4Connector,
  GscConnector,
  GoogleAdsConnector,
  MetaAdsConnector,
  LinkedInAdsConnector,
  TikTokAdsConnector,
  StripeConnector,
  ShopifyConnector,
  HubSpotConnector,
  MailchimpConnector,
  AwsLogsConnector,
  VultrLogsConnector,
  HostingerLogsConnector,
  NginxLogsConnector,
  DockerLogsConnector,
];

@Module({
  controllers: [ConnectorsController],
  providers: [
    ...CONNECTOR_CLASSES,
    {
      provide: CONNECTORS,
      useFactory: (...connectors: BaseConnector[]) => connectors,
      inject: CONNECTOR_CLASSES,
    },
    ConnectorRegistry,
  ],
  exports: [ConnectorRegistry],
})
export class ConnectorsModule {}
