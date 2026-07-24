import type { ConnectorLogEvent } from './log-connector';
import { NginxLogsConnector } from './nginx.connector';
import { isSpikeDay, mockLogStream, type LogProfile } from './mock-logs';

const PROFILE: LogProfile = {
  eventsPerDay: 100,
  hosts: ['h1'],
  services: ['svc'],
  messages: {
    debug: ['d'],
    info: ['i'],
    warn: ['w'],
    error: ['e1', 'e2'],
  },
};

async function drain(
  gen: AsyncGenerator<ConnectorLogEvent>,
): Promise<ConnectorLogEvent[]> {
  const out: ConnectorLogEvent[] = [];
  for await (const e of gen) out.push(e);
  return out;
}

describe('mockLogStream', () => {
  const start = new Date('2026-06-01T00:00:00Z');
  const end = new Date('2026-06-10T00:00:00Z');

  it('is deterministic — same inputs, identical events', async () => {
    const a = await drain(mockLogStream('src', PROFILE, start, end));
    const b = await drain(mockLogStream('src', PROFILE, start, end));
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('keeps events inside the requested range with valid levels', async () => {
    const events = await drain(mockLogStream('src', PROFILE, start, end));
    for (const e of events) {
      expect(e.timestamp.getTime()).toBeGreaterThanOrEqual(start.getTime());
      expect(['debug', 'info', 'warn', 'error']).toContain(e.level);
      expect(e.source).toBe('src');
    }
  });

  it('produces markedly more errors on spike days', async () => {
    const events = await drain(
      mockLogStream(
        'src',
        PROFILE,
        new Date('2026-01-01T00:00:00Z'),
        new Date('2026-03-31T00:00:00Z'),
      ),
    );
    const errorsByDay = new Map<string, number>();
    for (const e of events) {
      if (e.level !== 'error') continue;
      const day = e.timestamp.toISOString().slice(0, 10);
      errorsByDay.set(day, (errorsByDay.get(day) ?? 0) + 1);
    }
    const spike: number[] = [];
    const normal: number[] = [];
    for (const [day, count] of errorsByDay) {
      const bucket = isSpikeDay(new Date(`${day}T00:00:00Z`), 'src')
        ? spike
        : normal;
      bucket.push(count);
    }
    expect(spike.length).toBeGreaterThan(0);
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    expect(avg(spike)).toBeGreaterThan(avg(normal) * 3);
  });
});

describe('LogConnector metric aggregation', () => {
  it('derives daily metrics that exactly match the event stream', async () => {
    const connector = new NginxLogsConnector();
    const start = new Date('2026-06-01T00:00:00Z');
    const end = new Date('2026-06-05T00:00:00Z');

    const events = await connector.collectLogs('t1', start, end);
    const metrics = await connector.collect('t1', start, end);

    const errorsFromEvents = events.filter((e) => e.level === 'error').length;
    const errorsFromMetrics = metrics
      .filter((m) => m.metricName === 'errors')
      .reduce((a, m) => a + m.value, 0);
    const totalFromMetrics = metrics
      .filter((m) => m.metricName === 'log_events')
      .reduce((a, m) => a + m.value, 0);

    expect(errorsFromMetrics).toBe(errorsFromEvents);
    expect(totalFromMetrics).toBe(events.length);
  });
});
