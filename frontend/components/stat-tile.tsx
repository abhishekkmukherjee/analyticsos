"use client";

import { compact } from "@/lib/format";

interface StatTileProps {
  label: string;
  value: number;
  /** Signed % vs the previous period; null when there's no baseline. */
  delta: number | null;
  /** Name of the comparison period, e.g. "prev 30 days". */
  deltaPeriod: string;
  /** Some metrics are better when they fall (refunds, unsubscribes, position). */
  higherIsBetter?: boolean;
  /** Sparkline points, oldest → newest. */
  trend?: number[];
  selected?: boolean;
  onSelect?: () => void;
}

export function StatTile({
  label,
  value,
  delta,
  deltaPeriod,
  higherIsBetter = true,
  trend = [],
  selected = false,
  onSelect,
}: StatTileProps) {
  const isGood = delta === null ? null : delta >= 0 === higherIsBetter;
  const deltaColor =
    isGood === null
      ? "var(--text-muted)"
      : isGood
        ? "var(--good)"
        : "var(--critical)";

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="flex flex-col items-start gap-3 rounded-lg p-4 text-left transition-colors"
      style={{
        background: "var(--surface-1)",
        border: `1px solid ${selected ? "var(--series-1)" : "var(--border)"}`,
      }}
    >
      <span
        className="text-xs font-medium"
        style={{ color: "var(--text-secondary)" }}
      >
        {label}
      </span>

      {/* Proportional figures on purpose — tabular-nums makes big numbers look loose. */}
      <span
        className="text-2xl font-semibold leading-none"
        style={{ color: "var(--text-primary)" }}
      >
        {compact(value)}
      </span>

      <div className="flex w-full items-end justify-between gap-3">
        <span className="text-xs" style={{ color: deltaColor }}>
          {delta === null ? (
            <span style={{ color: "var(--text-muted)" }}>no baseline</span>
          ) : (
            <>
              {delta >= 0 ? "↑" : "↓"} {Math.abs(delta)}%{" "}
              <span style={{ color: "var(--text-muted)" }}>vs {deltaPeriod}</span>
            </>
          )}
        </span>
        {trend.length > 1 && <Sparkline points={trend} />}
      </div>
    </button>
  );
}

/** 12-point sparkline: de-emphasis stroke, accent dot on the latest point. */
function Sparkline({ points }: { points: number[] }) {
  const last12 = points.slice(-12);
  const width = 64;
  const height = 20;
  const min = Math.min(...last12);
  const max = Math.max(...last12);
  const span = max - min || 1;

  const coords = last12.map((v, i) => {
    const x = (i / (last12.length - 1)) * width;
    const y = height - ((v - min) / span) * height;
    return [x, y] as const;
  });

  const path = coords.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const [lastX, lastY] = coords[coords.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      aria-hidden="true"
      className="overflow-visible"
    >
      <polyline
        points={path}
        fill="none"
        stroke="var(--baseline)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx={lastX} cy={lastY} r={2.5} fill="var(--series-1)" />
    </svg>
  );
}
