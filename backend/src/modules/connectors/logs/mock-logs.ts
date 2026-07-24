import type { ConnectorLogEvent, LogLevel } from './log-connector';

/** Shapes a source's mock log stream. */
export interface LogProfile {
  /** Typical events per day; actual volume waves ±30% around this. */
  eventsPerDay: number;
  hosts: string[];
  services: string[];
  messages: Record<LogLevel, string[]>;
}

/**
 * Roughly one mock day in {ERROR_SPIKE_EVERY_DAYS} is an error-spike day, so
 * anomaly detection always has real spikes to find in demo data.
 */
export const ERROR_SPIKE_EVERY_DAYS = 11;
/** How much the error rate multiplies on a spike day. */
export const ERROR_SPIKE_MULTIPLIER = 6;

/** Baseline share of events at each level (info gets the remainder). */
const ERROR_RATE = 0.03;
const WARN_RATE = 0.07;
const DEBUG_RATE = 0.08;

/**
 * Deterministic mock log events for a source over a date range — same inputs
 * always produce the same events (seeded off the calendar day), so the metrics
 * aggregated from this stream always match the events stored from it.
 */
export async function* mockLogStream(
  source: string,
  profile: LogProfile,
  start: Date,
  end: Date,
): AsyncGenerator<ConnectorLogEvent> {
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    const dayKey = day.toISOString().slice(0, 10);
    const wave = 0.7 + Math.abs(Math.sin(daySeed(day, source))) * 0.6;
    const total = Math.round(profile.eventsPerDay * wave);
    const spikeDay = isSpikeDay(day, source);
    const errorRate = ERROR_RATE * (spikeDay ? ERROR_SPIKE_MULTIPLIER : 1);

    for (let i = 0; i < total; i += 1) {
      const level = pickLevel(
        hashFraction(`${source}:${dayKey}:${i}:level`),
        errorRate,
      );
      const pick = (values: string[], salt: string) =>
        values[hashString(`${source}:${dayKey}:${i}:${salt}`) % values.length];
      const secondOfDay =
        Math.floor((i * 86_400) / total) +
        (hashString(`${source}:${dayKey}:${i}:jitter`) % 60);
      yield {
        source,
        level,
        message: pick(profile.messages[level], 'msg'),
        host: pick(profile.hosts, 'host'),
        service: pick(profile.services, 'service'),
        metadata: { mock: true, spikeDay },
        timestamp: new Date(day.getTime() + secondOfDay * 1000),
      };
    }
  }
}

/** Spike days are deterministic per source so demos are reproducible. */
export function isSpikeDay(day: Date, source: string): boolean {
  return (dayNumber(day) + hashString(source)) % ERROR_SPIKE_EVERY_DAYS === 0;
}

function pickLevel(fraction: number, errorRate: number): LogLevel {
  if (fraction < errorRate) return 'error';
  if (fraction < errorRate + WARN_RATE) return 'warn';
  if (fraction < errorRate + WARN_RATE + DEBUG_RATE) return 'debug';
  return 'info';
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Whole days since the epoch — a stable per-day counter. */
function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

function daySeed(date: Date, seriesKey: string): number {
  return dayNumber(date) + hashString(seriesKey);
}

/** Stable 0..1 value from a key — decorrelates choices without randomness. */
function hashFraction(key: string): number {
  return (hashString(key) % 1000) / 1000;
}

/** Small stable integer hash (same shape as mock-metrics'). */
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 100_000;
  }
  return hash;
}
