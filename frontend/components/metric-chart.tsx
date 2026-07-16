"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { compact } from "@/lib/format";

export interface ChartPoint {
  date: string;
  value: number;
}

/**
 * Single-series time-series chart. One series → one hue (categorical slot 1)
 * and no legend box: the card title already names what's plotted.
 */
export function MetricChart({
  data,
  label,
}: {
  data: ChartPoint[];
  label: string;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex h-[280px] items-center justify-center text-sm"
        style={{ color: "var(--text-muted)" }}
      >
        No data in this range — sync a connection to populate metrics.
      </div>
    );
  }

  return (
    // Height includes the x-axis band so the axis labels are never cut off.
    <div className="h-[280px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: 4 }}>
          {/* Solid hairline grid, horizontal only — recessive, never dashed. */}
          <CartesianGrid
            stroke="var(--gridline)"
            strokeWidth={1}
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--baseline)", strokeWidth: 1 }}
            minTickGap={24}
            className="tabular"
          />
          <YAxis
            tick={{ fill: "var(--text-muted)", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={48}
            tickFormatter={(v: number) => compact(v)}
            className="tabular"
          />
          <Tooltip
            content={(props) => <ChartTooltip {...props} seriesLabel={label} />}
            cursor={{ stroke: "var(--baseline)", strokeWidth: 1 }}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            dot={false}
            // ≥8px marker with a 2px surface ring so it stays legible on the line.
            activeDot={{
              r: 4,
              fill: "var(--series-1)",
              stroke: "var(--surface-1)",
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * `label` is recharts' x-axis value; `seriesLabel` is ours (the metric name).
 * Props are typed structurally rather than with recharts' generics — the
 * generic Tooltip inference fights a component annotated to <number, string>.
 */
interface ChartTooltipProps {
  active?: boolean;
  payload?: readonly { value?: unknown }[];
  label?: unknown;
  seriesLabel?: string;
}

function ChartTooltip({
  active,
  payload,
  label: pointLabel,
  seriesLabel,
}: ChartTooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0];
  return (
    <div
      className="rounded-md px-3 py-2 text-xs shadow-sm"
      style={{
        background: "var(--surface-1)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
      }}
    >
      <div className="tabular" style={{ color: "var(--text-muted)" }}>
        {String(pointLabel ?? "")}
      </div>
      <div className="mt-1 flex items-center gap-2">
        <span
          aria-hidden="true"
          className="inline-block h-2 w-2 rounded-full"
          style={{ background: "var(--series-1)" }}
        />
        <span style={{ color: "var(--text-secondary)" }}>{seriesLabel}</span>
        <span className="tabular font-medium">
          {Number(point.value).toLocaleString()}
        </span>
      </div>
    </div>
  );
}
