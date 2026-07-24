import { Injectable } from '@nestjs/common';
import { LogConnector } from './log-connector';
import type { LogProfile } from './mock-logs';

/** Nginx — web server access/error logs (usually shipped via Vector.dev). */
@Injectable()
export class NginxLogsConnector extends LogConnector {
  readonly sourceName = 'nginx_logs';
  protected readonly liveEnvVars = ['NGINX_ACCESS_LOG_PATH'];
  protected readonly logProfile: LogProfile = {
    eventsPerDay: 140,
    hosts: ['web-01', 'web-02'],
    services: ['nginx'],
    messages: {
      debug: ['upstream keepalive connection reused'],
      info: [
        'GET / 200 12ms',
        'GET /api/v1/metrics/query 200 48ms',
        'POST /api/v1/chat 200 812ms',
        'GET /assets/app.js 304 3ms',
      ],
      warn: [
        'upstream response time exceeded 1s for /api/v1/chat',
        'client sent oversized header, truncating',
      ],
      error: [
        'GET /api/v1/metrics/query 502 upstream unavailable',
        'POST /api/v1/connections 500 internal error',
        'connect() failed (111: Connection refused) while connecting to upstream',
      ],
    },
  };
}
