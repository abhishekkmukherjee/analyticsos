import { Injectable } from '@nestjs/common';
import { LogConnector } from './log-connector';
import type { LogProfile } from './mock-logs';

/** Docker — container stdout/stderr logs (usually shipped via Vector.dev). */
@Injectable()
export class DockerLogsConnector extends LogConnector {
  readonly sourceName = 'docker_logs';
  protected readonly liveEnvVars = ['DOCKER_LOGS_CONTAINERS'];
  protected readonly logProfile: LogProfile = {
    eventsPerDay: 110,
    hosts: ['app-host-1'],
    services: ['api', 'worker', 'scheduler'],
    messages: {
      debug: ['health check passed', 'gc pause 12ms'],
      info: [
        'request handled in 34ms',
        'job completed: sync-metrics',
        'container started',
      ],
      warn: ['memory usage above 80% of limit', 'job retry 1/3: sync-metrics'],
      error: [
        'unhandled promise rejection: connection reset',
        'job failed after 3 retries: sync-metrics',
        'container exited with code 137 (OOMKilled)',
      ],
    },
  };
}
