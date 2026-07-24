import { Injectable } from '@nestjs/common';
import { LogConnector } from './log-connector';
import type { LogProfile } from './mock-logs';

/** AWS — CloudWatch Logs (live pull via the CloudWatch Logs API later). */
@Injectable()
export class AwsLogsConnector extends LogConnector {
  readonly sourceName = 'aws_logs';
  protected readonly liveEnvVars = [
    'AWS_ACCESS_KEY_ID',
    'AWS_SECRET_ACCESS_KEY',
    'AWS_CLOUDWATCH_LOG_GROUP',
  ];
  protected readonly logProfile: LogProfile = {
    eventsPerDay: 90,
    hosts: ['i-0a1b2c3d', 'i-0e4f5a6b'],
    services: ['lambda:report-gen', 'ecs:api', 'rds:main'],
    messages: {
      debug: ['START RequestId trace sampled'],
      info: [
        'Lambda invocation completed in 240ms',
        'ECS task state RUNNING',
        'RDS connection pool healthy',
      ],
      warn: [
        'Lambda duration approaching timeout (80%)',
        'RDS CPU credit balance low',
      ],
      error: [
        'Lambda task timed out after 30.00 seconds',
        'ECS task stopped: essential container exited',
        'RDS too many connections',
      ],
    },
  };
}
