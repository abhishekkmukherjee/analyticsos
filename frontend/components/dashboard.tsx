"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  type Connection,
  type ConnectorHealth,
  type Metric,
} from "@/lib/api";
import {
  compact,
  daysAgo,
  humanizeMetric,
  humanizeSource,
  isoDate,
  percentChange,
} from "@/lib/format";
import { StatTile } from "./stat-tile";
import { MetricChart, type ChartPoint } from "./metric-chart";
import { ConnectionsPanel } from "./connections-panel";
import { ChatPanel } from "./chat-panel";

const RANGES = [7, 30, 90] as const;

/** Metrics where a rise is bad — the delta color must flip for these. */
const LOWER_IS_BETTER = new Set([
  "refunds",
  "unsubscribes",
  "position",
  "bounceRate",
]);

export function Dashboard() {
  const [connectors, setConnectors] = useState<ConnectorHealth[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [source, setSource] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);
  // The user's explicit tile choice; `metric` below derives the effective one.
  const [selectedMetric, setSelectedMetric] = useState<string | null>(null);
  const [current, setCurrent] = useState<Metric[]>([]);
  const [previous, setPrevious] = useState<Metric[]>([]);
  const [loading, setLoading] = useState(false);
  const [showTable, setShowTable] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Bumped after a sync/add/remove to force the metrics effect to re-run.
  const [refreshKey, setRefreshKey] = useState(0);

  const loadShell = useCallback(async () => {
    try {
      const [{ connectors: cx }, conns] = await Promise.all([
        api.listConnectors(),
        api.listConnections(),
      ]);
      setConnectors(cx);
      setConnections(conns);
      setSource((prev) => prev ?? conns[0]?.source ?? null);
      setError(null);
    } catch (e) {
      setError(`Can't reach the API — is the backend running? (${(e as Error).message})`);
    }
  }, []);

  useEffect(() => {
    // loadShell only sets state after awaiting the API — nothing runs
    // synchronously here, so this is the "subscribe to an external system"
    // case the rule allows. The rule can't see through the async boundary.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadShell();
  }, [loadShell]);

  // Fetching from the API is exactly what an effect is for: synchronizing with
  // an external system. State updates happen in the async callbacks, never
  // synchronously in the effect body.
  useEffect(() => {
    if (!source) return;
    let cancelled = false;

    const end = new Date();
    const start = daysAgo(days);
    const prevEnd = start;
    const prevStart = daysAgo(days * 2);

    const run = async () => {
      setLoading(true);
      try {
        const [cur, prev] = await Promise.all([
          api.queryMetrics({ source, start: isoDate(start), end: isoDate(end) }),
          api.queryMetrics({
            source,
            start: isoDate(prevStart),
            end: isoDate(prevEnd),
          }),
        ]);
        if (cancelled) return;
        setCurrent(cur.series);
        setPrevious(prev.series);
        setError(null);
      } catch (e) {
        if (!cancelled) setError((e as Error).message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void run();

    return () => {
      cancelled = true;
    };
  }, [source, days, refreshKey]);

  // Roll the flat metric list into per-metric totals + a daily series.
  const byMetric = useMemo(() => groupByMetric(current), [current]);
  const prevTotals = useMemo(() => totalsByMetric(previous), [previous]);
  const metricNames = useMemo(() => Object.keys(byMetric).sort(), [byMetric]);

  // Derived, not synced via an effect: the user's pick wins while it's still a
  // valid metric for this source, otherwise fall back to the first one. This
  // self-corrects when the source changes without a cascading re-render.
  const metric =
    selectedMetric && metricNames.includes(selectedMetric)
      ? selectedMetric
      : (metricNames[0] ?? null);

  const chartData: ChartPoint[] = useMemo(() => {
    if (!metric || !byMetric[metric]) return [];
    return byMetric[metric]
      .slice()
      .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
      .map((m) => ({
        date: (m.dimensions?.date ?? m.recordedAt).slice(0, 10),
        value: m.value,
      }));
  }, [metric, byMetric]);

  const hasConnections = connections.length > 0;

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-xl font-semibold">AnalyticsOS</h1>
          <p className="text-xs" style={{ color: "var(--text-muted)" }}>
            Unified metrics across your connected sources
          </p>
        </div>
      </header>

      {error && (
        <p
          className="rounded-md px-3 py-2 text-sm"
          style={{ background: "var(--surface-1)", color: "var(--critical)", border: "1px solid var(--border)" }}
        >
          {error}
        </p>
      )}

      {/* ONE filter row, above everything it scopes. */}
      {hasConnections && (
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
            Source
            <select
              value={source ?? ""}
              onChange={(e) => setSource(e.target.value)}
              className="rounded-md px-2 py-1.5 text-xs"
              style={{
                background: "var(--surface-1)",
                border: "1px solid var(--border)",
                color: "var(--text-primary)",
              }}
            >
              {connections.map((c) => (
                <option key={c.id} value={c.source}>
                  {humanizeSource(c.source)}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-1">
            {RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setDays(r)}
                aria-pressed={days === r}
                className="rounded-md px-2.5 py-1.5 text-xs"
                style={{
                  background: days === r ? "var(--series-1)" : "var(--surface-1)",
                  color: days === r ? "#fff" : "var(--text-secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Refetch holds the previous render at reduced opacity — no skeleton flash. */}
      <div
        className="flex flex-col gap-4 transition-opacity"
        style={{ opacity: loading && current.length > 0 ? 0.6 : 1 }}
      >
        {metricNames.length > 0 && (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {metricNames.map((name) => {
              const total = byMetric[name].reduce((a, m) => a + m.value, 0);
              const prev = prevTotals[name] ?? 0;
              return (
                <StatTile
                  key={name}
                  label={humanizeMetric(name)}
                  value={total}
                  delta={percentChange(prev, total)}
                  deltaPeriod={`prev ${days}d`}
                  higherIsBetter={!LOWER_IS_BETTER.has(name)}
                  trend={byMetric[name]
                    .slice()
                    .sort((a, b) => a.recordedAt.localeCompare(b.recordedAt))
                    .map((m) => m.value)}
                  selected={metric === name}
                  onSelect={() => setSelectedMetric(name)}
                />
              );
            })}
          </div>
        )}

        {hasConnections && (
          <section
            className="rounded-lg p-4"
            style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">
                  {metric ? humanizeMetric(metric) : "Metrics"}
                  <span className="font-normal" style={{ color: "var(--text-muted)" }}>
                    {" "}
                    · {source ? humanizeSource(source) : ""} · last {days} days
                  </span>
                </h2>
              </div>
              {/* Table-view twin: every value stays reachable without hover. */}
              <button
                type="button"
                onClick={() => setShowTable((s) => !s)}
                className="rounded-md px-2.5 py-1.5 text-xs"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                {showTable ? "Show chart" : "Show table"}
              </button>
            </div>

            {showTable ? (
              <DataTable data={chartData} label={metric ? humanizeMetric(metric) : ""} />
            ) : (
              <MetricChart data={chartData} label={metric ? humanizeMetric(metric) : ""} />
            )}
          </section>
        )}

        <div className="grid gap-4 lg:grid-cols-2">
          <ConnectionsPanel
            connections={connections}
            connectors={connectors}
            onChanged={() => {
              void loadShell();
              // Re-pull metrics for the active source after a sync/add/remove.
              setRefreshKey((k) => k + 1);
            }}
          />
          <ChatPanel />
        </div>
      </div>
    </div>
  );
}

function DataTable({ data, label }: { data: ChartPoint[]; label: string }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm" style={{ color: "var(--text-muted)" }}>
        No data in this range.
      </p>
    );
  }
  return (
    <div className="max-h-[280px] overflow-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0" style={{ background: "var(--surface-1)" }}>
          <tr style={{ color: "var(--text-muted)" }}>
            <th className="py-1.5 pr-4 text-xs font-medium">Date</th>
            <th className="py-1.5 text-xs font-medium">{label}</th>
          </tr>
        </thead>
        <tbody>
          {data.map((p) => (
            <tr key={p.date} style={{ borderTop: "1px solid var(--border)" }}>
              <td className="tabular py-1.5 pr-4" style={{ color: "var(--text-secondary)" }}>
                {p.date}
              </td>
              <td className="tabular py-1.5">{compact(p.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function groupByMetric(metrics: Metric[]): Record<string, Metric[]> {
  const out: Record<string, Metric[]> = {};
  for (const m of metrics) (out[m.metricName] ??= []).push(m);
  return out;
}

function totalsByMetric(metrics: Metric[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const m of metrics) out[m.metricName] = (out[m.metricName] ?? 0) + m.value;
  return out;
}
