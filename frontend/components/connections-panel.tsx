"use client";

import { useState } from "react";
import { api, type Connection, type ConnectorHealth } from "@/lib/api";
import { humanizeSource } from "@/lib/format";

const STATUS_COLOR: Record<Connection["status"], string> = {
  active: "var(--good)",
  error: "var(--critical)",
  pending: "var(--text-muted)",
};

export function ConnectionsPanel({
  connections,
  connectors,
  onChanged,
}: {
  connections: Connection[];
  connectors: ConnectorHealth[];
  onChanged: () => void;
}) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const connectedSources = new Set(connections.map((c) => c.source));
  const available = connectors.filter((c) => !connectedSources.has(c.source));

  async function run(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section
      className="rounded-lg p-4"
      style={{ background: "var(--surface-1)", border: "1px solid var(--border)" }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Connections</h2>
        <span className="text-xs" style={{ color: "var(--text-muted)" }}>
          {connections.length} of {connectors.length} sources
        </span>
      </div>

      {error && (
        <p className="mb-3 text-xs" style={{ color: "var(--critical)" }}>
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-2">
        {connections.map((conn) => (
          <li
            key={conn.id}
            className="flex items-center justify-between gap-3 rounded-md px-3 py-2"
            style={{ border: "1px solid var(--border)" }}
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                {/* Status is icon+color+label — never color alone. */}
                <span
                  aria-hidden="true"
                  className="inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: STATUS_COLOR[conn.status] }}
                />
                <span className="truncate text-sm font-medium">
                  {conn.displayName}
                </span>
                <span className="text-xs" style={{ color: STATUS_COLOR[conn.status] }}>
                  {conn.status}
                </span>
              </div>
              <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>
                {conn.lastSyncAt
                  ? `Last sync ${new Date(conn.lastSyncAt).toLocaleString()}`
                  : "Never synced"}
              </p>
            </div>

            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                disabled={busyId === conn.id}
                onClick={() => run(conn.id, () => api.syncConnection(conn.id))}
                className="rounded-md px-2.5 py-1.5 text-xs font-medium disabled:opacity-50"
                style={{ background: "var(--series-1)", color: "#fff" }}
              >
                {busyId === conn.id ? "Syncing…" : "Sync"}
              </button>
              <button
                type="button"
                disabled={busyId === conn.id}
                onClick={() => run(conn.id, () => api.deleteConnection(conn.id))}
                className="rounded-md px-2.5 py-1.5 text-xs disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                Remove
              </button>
            </div>
          </li>
        ))}
        {connections.length === 0 && (
          <li className="py-2 text-xs" style={{ color: "var(--text-muted)" }}>
            No connections yet — add a source below, then sync it.
          </li>
        )}
      </ul>

      {available.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
            Add a source
          </p>
          <div className="flex flex-wrap gap-2">
            {available.map((c) => (
              <button
                key={c.source}
                type="button"
                disabled={adding}
                onClick={async () => {
                  setAdding(true);
                  setError(null);
                  try {
                    await api.createConnection(c.source, humanizeSource(c.source));
                    onChanged();
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setAdding(false);
                  }
                }}
                className="rounded-full px-3 py-1 text-xs disabled:opacity-50"
                style={{ border: "1px solid var(--border)", color: "var(--text-secondary)" }}
              >
                + {humanizeSource(c.source)}
                <span style={{ color: "var(--text-muted)" }}> ({c.mode})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
