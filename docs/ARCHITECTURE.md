# AnalyticsOS — Understand The Whole Thing

> This document explains what we're building, how every piece works and why it
> exists, what's done, and what's left. Read it top to bottom once; after that
> use it as a map.

---

## 1. What is AnalyticsOS?

**The problem.** A company's data is scattered across a dozen tools. Traffic is
in Google Analytics. Ad spend is in Google Ads, Meta, LinkedIn, TikTok. Money is
in Stripe and Shopify. Customers are in HubSpot. Emails are in Mailchimp. Server
errors are in log files. To answer *"why did revenue drop last Tuesday?"* you'd
open eight tabs and manually correlate them.

**The product.** AnalyticsOS connects to all those sources, pulls their numbers
into **one database in one shape**, and puts an AI on top so you can just *ask*:
"Why did revenue drop last Tuesday?" — and it answers using your real data,
because it can see everything at once.

**It's multi-tenant.** One deployment serves many customer companies ("tenants").
Tenant A must never see Tenant B's data. This constraint shapes the whole design.

---

## 2. The one mental model that explains everything

Everything in this codebase is one pipeline:

```
Outside world          Normalize            Store              Read
─────────────          ─────────            ─────              ────
Stripe API    ┐
GA4 API       ├──▶  Connector  ──▶  ConnectorMetric  ──▶  MetricsStore  ──▶  Query API  ──▶  Dashboard
Meta Ads API  ┤     (per source)      (one shape)          (database)         REST            charts
Shopify API   ┘                                                          └──▶  Chat API  ──▶  AI answer
```

The key insight: **every source is different, but we force them all into one
shape** the moment they enter the system. That shape is `ConnectorMetric`:

```ts
{
  metricName: "revenue",      // what was measured
  value: 8400,                 // the number
  dimensions: { date: "..." }, // context/breakdown
  recordedAt: Date,            // when it happened
  source: "stripe"             // where it came from
}
```

Once Stripe revenue and GA4 sessions are both just `ConnectorMetric` rows,
*everything downstream is generic*. The chart doesn't know what Stripe is. The
AI doesn't know what GA4 is. They only know `ConnectorMetric`. That's why adding
a new source is ~10 lines: you only write the translation, nothing downstream
changes.

**If you remember one thing, remember that.** Every design decision below serves it.

---

## 3. The tech stack, and why each piece

| Layer | Choice | Why |
|---|---|---|
| Backend framework | **NestJS** (TypeScript) | Enforces structure. With 40+ connectors planned, an unopinionated framework becomes spaghetti. |
| Language | **TypeScript** | Same language as the frontend. Types catch mistakes before runtime. |
| Database (records) | **PostgreSQL** (Neon, cloud-hosted) | Tenants, users, connections — relational data with real relationships. |
| DB access | **Prisma** | Write a schema, get type-safe DB code generated. No hand-written SQL. |
| Metrics store | **Postgres today → ClickHouse later** | See §6. Hidden behind an interface so it can swap. |
| Frontend | **Next.js 16 + React 19** | The dashboard. |
| Charts | **Recharts** | React-native charting. |
| AI | **@anthropic-ai/sdk** (Claude) | Answers questions grounded in your metrics. |
| Auth | **Stub today → Clerk later** | See §6. |

---

## 4. NestJS concepts you need (this unlocks the backend)

The backend is ~40 small files, but they're only **five kinds of file**, repeated.
Learn these five and you can read all of it:

### Module — the wiring/box
Groups related things and declares what's available. `ChatModule` bundles the
chat controller + service. `AppModule` imports every other module. Nothing works
unless it's registered in a module.

### Controller — the HTTP layer
Maps URLs to functions. **It should contain no logic** — just take the request,
call a service, return the result.
```ts
@Controller('chat')            // → /api/v1/chat
export class ChatController {
  @Post()                      // → POST /api/v1/chat
  ask(@Body() body: ChatDto) { return this.chatService.ask(...); }
}
```

### Service — the brain
Where actual logic lives. Talks to the database, calls APIs, does math.
Controllers are thin; services are where the work happens.

### DTO — the bouncer
"Data Transfer Object". Defines + **validates** the shape of incoming data. If a
request doesn't match, NestJS rejects it with a 400 before your code ever runs.
```ts
export class ChatDto {
  @IsString() @MinLength(1)
  message!: string;            // a request without a string `message` is rejected
}
```

### Guard — the doorman
Runs *before* a controller. Ours (`AuthGuard`) figures out who you are and which
tenant you belong to, and attaches it to the request. Returns 401 if you can't be
identified.

### Dependency Injection (the "magic")
You never write `new ChatService()`. You declare what you need in a constructor:
```ts
constructor(private readonly prisma: PrismaService) {}
```
…and NestJS creates and hands it to you. It manages one shared instance of each
service. This is why testing is easy — you can swap in a fake `PrismaService`.

---

## 5. Every file we've written, explained

### Entry points
| File | What it does |
|---|---|
| `src/main.ts` | Boots the app. Sets `/api/v1` prefix, enables CORS (so the browser dashboard can call it), turns on the global validation pipe (makes DTOs enforce themselves). |
| `src/app.module.ts` | The root wiring. Imports every module, registers `AuthGuard` globally so **every route requires auth unless marked `@Public()`**. |
| `src/app.controller.ts` / `app.service.ts` | Health check at `GET /api/v1` — also pings the DB so it reports `database: up/down`. Marked `@Public()`. |

### Database layer
| File | What it does |
|---|---|
| `prisma/schema.prisma` | **The source of truth for the database.** Defines 4 tables (below). Change this → run a migration → Prisma regenerates type-safe code. |
| `src/prisma/prisma.service.ts` | The database client, wrapped as an injectable service. Connects on startup, disconnects on shutdown. |
| `src/prisma/prisma.module.ts` | Marked `@Global()` so any service can inject `PrismaService` without importing the module. |

**The 4 tables:**
- **`Tenant`** — a customer company. The root of isolation.
- **`User`** — a person inside a tenant. `authId` links to the external login provider.
- **`Connection`** — "this tenant has connected Stripe". Holds status + last sync time.
- **`Metric`** — the actual time-series numbers. Every row is one `ConnectorMetric`.

`Metric` deliberately has **no foreign key** to Tenant — it's a high-volume
append table, modeled on how ClickHouse would store it. It carries a plain
`tenantId` column that every query filters on.

### Auth / multi-tenancy (`src/common/auth/`)
| File | What it does |
|---|---|
| `auth-context.ts` | The shape of "who is this request": `{ tenantId, userId, email, role }`. |
| `auth.guard.ts` | Reads `x-tenant-id`/`x-user-id` headers. **In dev with no headers, it auto-creates a demo tenant** so the app just works. In production it 401s. This is the seam where Clerk plugs in later. |
| `current-user.decorator.ts` | Lets a controller write `@CurrentUser() user: AuthContext` to get the identity. |
| `public.decorator.ts` | Marks a route as not needing auth (the health check). |

> **Tenant isolation rule:** every database query filters by `tenantId`. No
> exceptions. `user.tenantId` comes from the guard, never from user input — so a
> user cannot ask for another tenant's data.

### Connectors (`src/modules/connectors/`) — the translation layer
| File | What it does |
|---|---|
| `base-connector.ts` | The **contract** every source must fulfil: `authenticate()`, `fetchMetrics()`, `healthCheck()`. Plus `collect()`, which drains the metric stream into an array. |
| `scaffold-connector.ts` | A shortcut base class. A source that isn't live yet just declares its name, its metrics, and which env vars would enable live mode. Saves writing the same 40 lines 9 times. |
| `mock-metrics.ts` | Generates fake-but-realistic daily numbers, **deterministically** (same day → same number, no randomness). Lets the whole product be demoed with zero API keys. |
| `registry.ts` | A lookup table: `"stripe"` → the StripeConnector object. Everything else asks the registry instead of knowing about specific connectors. |
| `connectors.module.ts` | Lists all 10 connector classes and assembles them into the registry. **Adding a source = add one line here.** |
| `analytics/ga4.connector.ts` | GA4. Has its own class (not `ScaffoldConnector`) because it's first in line for a real API implementation. |
| `advertising/`, `commerce/`, `crm/`, `marketing/` | The other 9 sources, each ~12 lines. |

**`fetchMetrics` is an async generator** (`async *`) — it `yield`s metrics one at
a time instead of returning a big array. This matters at scale: a source with a
million rows streams through memory instead of loading all at once.

**Mock vs live:** each connector checks whether its env vars are set. No key →
mock mode. Key present → live mode, which currently **throws "not implemented"**.
That's deliberate: mock data must never silently masquerade as real data.

### Metrics (`src/modules/metrics/`) — storage + reading
| File | What it does |
|---|---|
| `metrics-store.interface.ts` | **The most important abstraction.** Defines *what* a metrics store can do (`insertMany`, `deleteRange`, `query`) without saying *how*. |
| `postgres-metrics-store.ts` | The Postgres implementation of that interface. |
| `metrics.module.ts` | Picks which implementation to use. Today: Postgres. When `CLICKHOUSE_URL` exists: swap one line here, **nothing else in the app changes**. |
| `metrics.service.ts` | Query logic + period-over-period compare (`changePct`). |
| `metrics.controller.ts` | `GET /metrics/query`, `GET /metrics/compare`. |

### Connections (`src/modules/connections/`) — the sync engine
`connections.service.ts` is where the pipeline actually runs:
```
sync(tenantId, connectionId):
  1. load the connection (verify it belongs to this tenant)
  2. look up its connector in the registry
  3. connector.collect(...)         → ConnectorMetric[]
  4. metricsStore.deleteRange(...)  → clear the window first
  5. metricsStore.insertMany(...)   → write them
  6. mark connection active + timestamp
```
Step 4 is what makes sync **idempotent** — run it 5 times, you get the same data,
not 5 copies. The window snaps to whole UTC days so repeated runs use identical
bounds.

### Logs (`src/modules/logs/` + `src/modules/connectors/logs/`) — Phase 3
Log sources (nginx, docker, aws, vultr, hostinger) are different from metric
sources: they produce **events** (individual log lines), not daily numbers. So:

- `LogConnector` (extends `ScaffoldConnector`) streams `ConnectorLogEvent`s and
  *derives* its daily metrics (`log_events`, `errors`, `warnings`) from that same
  event stream — the numbers on the dashboard always match the stored events.
- Mock mode generates deterministic events, including scheduled **error-spike
  days** (~1 day in 11), so anomaly detection has real spikes to find in demos.
- The real-world path is push, not pull: a **Vector.dev agent** on the customer's
  server POSTs batches to `POST /logs/ingest`. The body is deliberately untyped —
  shippers send messy shapes; we normalize levels (syslog `crit`→`error` etc.)
  and keep unrecognized fields in `metadata` instead of dropping logs.
- `GET /logs` (filter by source/level/text/time) and `GET /logs/summary`
  (counts by source × level) read them back.

### Anomalies (`src/modules/anomalies/`) — error-spike alerts
`anomaly-detector.ts` is pure math (no I/O): each of the last 3 days is judged
against the mean/σ of the days before them — a day beyond **2.5σ** is an anomaly,
beyond **4σ** is critical. Named constants, unit-tested.

`anomalies.service.ts` builds daily error counts **from the LogEvent table**
(not from synced metrics — so logs pushed by real Vector agents trigger alerts
exactly like mock syncs do), persists findings to the `Anomaly` table, and emits
the Phase-3 alert (a structured server log; notification channels are Phase 4).
Detection runs automatically after every log sync and on demand via
`POST /anomalies/detect`. The feed is `GET /anomalies`; acknowledge/resolve via
`PATCH /anomalies/:id` — an acknowledged anomaly is never resurrected by
re-detection.

### Chat (`src/modules/chat/`)
`chat.service.ts` — pulls the tenant's recent metrics, summarizes them into text,
sends that to Claude as grounding context with the question, returns the answer.
No key → returns a mock answer that still shows the real data summary.

This is **RAG in its simplest form**: fetch relevant data → put it in the prompt →
the model answers from it instead of guessing.

### Frontend (`frontend/`)
| File | What it does |
|---|---|
| `lib/api.ts` | Typed wrapper around every backend endpoint. **The only file that knows the API's URL.** |
| `lib/format.ts` | Number/label formatting (`1.4M`, `MRR`, `TikTok ads`). |
| `app/globals.css` | Design tokens (colors) as CSS variables, with light + dark values. |
| `components/dashboard.tsx` | The orchestrator: holds state, fetches, and lays out everything. |
| `components/stat-tile.tsx` | One KPI tile: label, big number, delta %, sparkline. |
| `components/metric-chart.tsx` | The line chart. |
| `components/connections-panel.tsx` | List/add/remove/sync your sources. |
| `components/chat-panel.tsx` | Ask-a-question box. |

The dashboard fetches **two windows** (current + previous) and computes deltas in
the browser. Colors follow meaning: falling revenue is red, falling *refunds* is
green (`higherIsBetter`).

---

## 6. The three big decisions (and why)

**1. Postgres now, ClickHouse later — behind an interface.**
ClickHouse is built for time-series at massive scale; Postgres is not. But
ClickHouse needs another cloud account. So we defined `MetricsStore` as an
interface and wrote a Postgres version. The day scale demands it, someone writes
`ClickHouseMetricsStore`, changes one line in `MetricsModule`, and **no connector,
no controller, no chart changes**. This is *programming to an interface* — the
single most valuable pattern in the codebase.

**2. Stub auth now, Clerk later — behind a guard.**
Same idea. Everything downstream depends on `AuthContext`, not on Clerk. Swapping
the guard's insides swaps the auth provider.

**3. Mock data that never lies.**
Every connector runs in mock mode by default so the product is demoable instantly.
But live mode *throws* rather than falling back to mock — because silently serving
fake numbers as real is the worst possible bug in an analytics product.

---

## 7. What's built (done ✅)

**Phase 1 — Foundation**
- NestJS app, config, health check that pings the DB
- Postgres on Neon + Prisma; Tenant/User tables
- Tenant isolation via `AuthGuard` (stub auth; Clerk is a later swap)
- GA4 connector following the `BaseConnector` pattern
- Claude chat endpoint

**Phase 2 — Core Sources**
- `Metric` table + `MetricsStore` interface + Postgres implementation
- 10 connectors: ga4, gsc, google_ads, meta_ads, linkedin_ads, tiktok_ads, stripe, shopify, hubspot, mailchimp
- Connections API (CRUD + idempotent sync + status)
- Metrics API (`query`, `compare`)
- **Dashboard**: KPI tiles, line chart, table view, connections panel, chat

**Phase 3 — Logs & Infra**
- `LogEvent` + `Anomaly` tables
- 5 log connectors: aws_logs, vultr_logs, hostinger_logs, nginx_logs, docker_logs
- Logs API: `POST /logs/ingest` (Vector.dev push), `GET /logs`, `GET /logs/summary`
- Z-score anomaly detection + `GET /anomalies` feed + acknowledge/resolve
- Unit tests for the detector math and mock-log determinism

**Everything is verified end-to-end** against the real Neon database: create a
connection → sync (543 metrics, 27k log events) → push an error burst through
the ingest endpoint → detection flags a critical anomaly (z=26.8) → alert logged
→ acknowledge survives re-detection. Sync remains idempotent for events too.

## 8. What's NOT built (be honest about this)

- **All 15 sources are mock.** Not one talks to a real API yet (though the log
  ingest endpoint accepts real Vector.dev pushes today).
- **Auth is a stub.** No real login. Dev mode auto-creates a demo tenant.
- **No background jobs.** Sync only runs when you click the button. Real systems
  sync on a schedule (BullMQ + Redis, planned).
- **No ClickHouse, Kafka, or Redis yet.**
- **Thin test coverage.** Unit tests exist for anomaly math and mock logs;
  nothing else.
- **The frontend duplicates the compare math** the backend already does in
  `/metrics/compare` — the tiles compute deltas client-side instead. Known cleanup.

## 9. What's next (the roadmap)

| Phase | What | Status |
|---|---|---|
| 1 | Foundation: auth, DB, first connector, chat | ✅ Done |
| 2 | Core sources: 10 connectors, metrics pipeline, dashboard | ✅ Done |
| 3 | **Logs & Infra**: Nginx/AWS/Docker log connectors, log anomaly detection | ✅ Done |
| 4 | **Intelligence**: anomaly detection engine (all metrics), forecasting (Prophet/XGBoost via a small Python service), alert channels + scheduling | ⬜ Next |
| 5 | **Context**: crawl the company's site/socials, pgvector embeddings, RAG so answers know *your business* | ⬜ |
| 6 | **BI + session replay**: Power BI, Tableau, Looker, Clarity, Hotjar | ⬜ |
| 7 | **Workspace**: Gmail/M365/SendGrid deliverability, DMARC | ⬜ |
| 8 | **Reports**: scheduled executive summaries, PDF export | ⬜ |
| 9 | Polish & scale | ⬜ |

**The highest-value next steps, in order:**
1. **Make one connector real** (Stripe is easiest — one API key). Proves the whole
   mock→live architecture actually works against a real API.
2. **Real auth** (Clerk) so it's genuinely multi-user.
3. **Scheduled syncs** (BullMQ) so data updates without a button click — this
   also gives anomaly detection its cron cadence.
4. Then Phase 4+.

---

## 10. How to run it

```bash
# Terminal 1 — backend (port 3000)
cd backend
npm run start:dev

# Terminal 2 — frontend (port 3001)
cd frontend
npm run dev
```
Open <http://localhost:3001>. Add a source, click **Sync**, watch the chart fill in.

**Environment** (`backend/.env`): `DATABASE_URL` is required. Everything else is
optional — add `ANTHROPIC_API_KEY` for real AI answers, `STRIPE_API_KEY` etc. for
live sources.

**Common gotchas:**
- Changed `schema.prisma`? Run `npx prisma migrate dev --name <what_changed>`,
  then `npx prisma generate` — **always regenerate before building**.
- Run all `npm`/`prisma` commands from `backend/`, not the repo root.

---

## 11. Glossary

| Term | Meaning |
|---|---|
| **Tenant** | One customer company. The unit of data isolation. |
| **Connector** | Code that pulls data from one source and converts it to `ConnectorMetric`. |
| **ConnectorMetric** | The universal shape every metric takes. |
| **Sync** | Pull a date range from a source and write it to the metrics store. |
| **Idempotent** | Running it twice = running it once. Safe to retry. |
| **DTO** | A validated shape for incoming request data. |
| **Guard** | Code that runs before a controller to allow/deny + attach identity. |
| **DI (Dependency Injection)** | You declare what you need; the framework supplies it. |
| **Migration** | A versioned change to the database structure. |
| **RAG** | Fetch real data → put it in the AI prompt → it answers from facts, not guesses. |
| **Mock mode** | Running on generated data because no API key is set. |
