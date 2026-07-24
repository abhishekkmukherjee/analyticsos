import { Injectable } from '@nestjs/common';
import { LogConnector } from './log-connector';
import type { LogProfile } from './mock-logs';

/** Hostinger — shared/VPS hosting logs (usually shipped via Vector.dev). */
@Injectable()
export class HostingerLogsConnector extends LogConnector {
  readonly sourceName = 'hostinger_logs';
  protected readonly liveEnvVars = ['HOSTINGER_API_TOKEN'];
  protected readonly logProfile: LogProfile = {
    eventsPerDay: 60,
    hosts: ['hostinger-vps'],
    services: ['apache', 'php-fpm', 'mysql'],
    messages: {
      debug: ['php-fpm: pool www idle worker recycled'],
      info: [
        'apache: GET /index.php 200',
        'mysql: slow query log rotated',
        'php-fpm: request served in 85ms',
      ],
      warn: [
        'php-fpm: max_children limit reached, queuing requests',
        'mysql: slow query detected (2.4s)',
      ],
      error: [
        'apache: 503 service unavailable',
        'php-fpm: PHP Fatal error: allowed memory size exhausted',
        'mysql: connection refused',
      ],
    },
  };
}
