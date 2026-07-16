/**
 * Typed client for the AnalyticsOS backend (/api/v1).
 *
 * Auth note: the backend's AuthGuard auto-provisions a demo tenant in dev when
 * no auth headers are present, so no credentials are needed locally. When Clerk
 * lands, attach the token in `request()` — every call routes through it.
 */

const BASE =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export interface ConnectorHealth {
  source: string;
  mode: "live" | "mock";
  healthy: boolean;
}

export interface Connection {
  id: string;
  source: string;
  displayName: string;
  status: "pending" | "active" | "error";
  lastSyncAt: string | null;
  createdAt: string;
}

export interface Metric {
  metricName: string;
  value: number;
  dimensions: Record<string, string>;
  recordedAt: string;
  source: string;
}

export interface MetricQueryResult {
  source: string;
  metric: string;
  range: { start: string; end: string };
  count: number;
  total: number;
  series: Metric[];
}

export interface SyncResult {
  id: string;
  source: string;
  status: string;
  lastSyncAt: string | null;
  metricsWritten: number;
}

export interface ChatAnswer {
  answer: string;
  mode: "live" | "mock";
  groundedOn: { source: string; metricCount: number };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${res.status} ${res.statusText}: ${body}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ status: string }>("/"),

  listConnectors: () =>
    request<{ connectors: ConnectorHealth[] }>("/connectors"),

  listConnections: () => request<Connection[]>("/connections"),

  createConnection: (source: string, displayName?: string) =>
    request<Connection>("/connections", {
      method: "POST",
      body: JSON.stringify({ source, displayName }),
    }),

  deleteConnection: (id: string) =>
    request<{ deleted: boolean }>(`/connections/${id}`, { method: "DELETE" }),

  syncConnection: (id: string) =>
    request<SyncResult>(`/connections/${id}/sync`, { method: "POST" }),

  queryMetrics: (params: {
    source?: string;
    metric?: string;
    start?: string;
    end?: string;
  }) => {
    const qs = new URLSearchParams(
      Object.entries(params).filter(([, v]) => Boolean(v)) as [string, string][],
    );
    return request<MetricQueryResult>(`/metrics/query?${qs}`);
  },

  chat: (message: string) =>
    request<ChatAnswer>("/chat", {
      method: "POST",
      body: JSON.stringify({ message }),
    }),
};
