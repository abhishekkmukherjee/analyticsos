import { Injectable } from '@nestjs/common';
import { LogConnector } from './log-connector';
import type { LogProfile } from './mock-logs';

/** Vultr — VPS syslog/system logs (usually shipped via Vector.dev). */
@Injectable()
export class VultrLogsConnector extends LogConnector {
  readonly sourceName = 'vultr_logs';
  protected readonly liveEnvVars = ['VULTR_API_KEY'];
  protected readonly logProfile: LogProfile = {
    eventsPerDay: 70,
    hosts: ['vultr-vps-1'],
    services: ['sshd', 'systemd', 'cron'],
    messages: {
      debug: ['systemd: reloading unit state'],
      info: [
        'sshd: accepted publickey for deploy',
        'cron: daily backup completed',
        'systemd: started application service',
      ],
      warn: [
        'sshd: failed password attempt (fail2ban notified)',
        'disk usage above 75% on /',
      ],
      error: [
        'systemd: application service crashed, restarting',
        'cron: backup job failed — destination unreachable',
        'kernel: out of memory: killed process',
      ],
    },
  };
}
