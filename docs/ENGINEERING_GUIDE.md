# AnalyticsOS — Engineering Guide (JavaScript / TypeScript Edition)

> **Status:** Active engineering guide.
> **Supersedes:** the technology-stack and code-convention choices in `AnalyticsOS_Project_Guide (1).docx`.
> The original guide's **product vision, data sources, AI features, database design, and phases are all still valid** — only the *implementation language and tooling* have changed from Python to TypeScript.

---

## 1. The Decision (and Why)

The original guide specified a **Python / FastAPI** backend. We are instead building the backend in **TypeScript with NestJS**.

**Rationale:**

- **One language, front to back.** The frontend is already Next.js (JavaScript/TypeScript). A TypeScript backend means a single language across the whole project.
- **No performance or scalability cost.** The 90% of this project that isn't machine learning is I/O-bound work (calling APIs, streaming responses, database queries). Node.js handles this as fast as — often faster than — Python for high-concurrency I/O.
- **Two of the doc's own tools are already JavaScript:** BullMQ (queues) and Playwright (crawler).
- **NestJS enforces structure**, which keeps a 40-connector, multi-tenant project from turning into spaghetti — and it teaches real backend architecture.

**The one honest tradeoff:** the predictive ML models (Prophet, XGBoost, Isolation Forest) are Python-native. See §6 — we handle these with a small standalone **Python ML microservice** in Phase 4. This does *not* reduce what the product can do.

---

## 2. What Is What (layers)

```
NestJS         ← app structure: controllers, services, modules (TypeScript-first)
  └─ Express/Fastify   ← the HTTP framework Nest runs on internally
       └─ Node.js      ← the runtime that executes JavaScript on the server
```

You are always using **Node.js**. NestJS is the top layer that organizes your code.

---

## 3. Technology Stack (Python → TypeScript mapping)

| Layer | Original (Python) | **Our choice (TypeScript)** | Purpose |
|---|---|---|---|
| Frontend | Next.js 15 | **Next.js 15** *(unchanged)* | Dashboard, chat UI |
| Backend API | FastAPI | **NestJS** | REST + WebSocket API |
| Language | Python 3.12 | **TypeScript (strict mode)** | Type-safe code |
| Validation | Pydantic v2 | **class-validator + class-transformer** (Nest-native); Zod as alternative | Validate API inputs/outputs |
| ORM (Postgres) | SQLAlchemy 2.0 | **Prisma** | Users, tenants, config, pgvector |
| ClickHouse | clickhouse-connect | **@clickhouse/client** | Time-series metrics, logs |
| Background jobs | Celery + Redis | **BullMQ + Redis** *(doc already listed this)* | Connector sync workers |
| Event streaming | Kafka (confluent) | **Kafka (kafkajs)** | Real-time data pipeline |
| Cache | Redis (redis-py) | **Redis (ioredis)** | Query cache, rate limiting |
| Object storage | boto3 (S3) | **@aws-sdk/client-s3** | Log archives, report PDFs |
| Auth | Clerk | **Clerk** *(unchanged)* | Multi-tenant org auth |
| LLM (primary) | Anthropic SDK (py) | **@anthropic-ai/sdk** | Query answering, reports |
| LLM (embeddings) | openai (py) | **openai** (node) | Vector embeddings |
| Web crawling | Playwright + Crawlee | **Playwright + Crawlee** *(JS-native)* | Website + social crawling |
| **ML models** | scikit-learn, Prophet, XGBoost | ⚠️ **Python microservice** (Phase 4 only) | Forecasting, anomaly ML |
| Config/secrets | pydantic-settings | **@nestjs/config + .env** | Environment configuration |
| Testing | pytest | **Jest** (Nest default) | Unit + integration tests |
| Lint/format | ruff, mypy | **ESLint + Prettier** | Code quality |
| CI/CD | GitHub Actions | **GitHub Actions** *(unchanged)* | Test + deploy |

---

## 4. Project / File Structure

```
analyticsos/
├── backend/                      # NestJS API (TypeScript)
│   ├── src/
│   │   ├── main.ts               # App entry point (bootstrap)
│   │   ├── app.module.ts         # Root module — wires everything together
│   │   ├── config/               # Env config, validation
│   │   ├── common/               # Guards, interceptors, filters, decorators
│   │   │   └── tenant/           # Multi-tenant middleware (tenantId isolation)
│   │   ├── modules/
│   │   │   ├── auth/             # auth.module / .controller / .service
│   │   │   ├── connections/      # Manage data-source connections
│   │   │   ├── connectors/       # The 40+ source connectors
│   │   │   │   ├── base-connector.ts   # Abstract BaseConnector class
│   │   │   │   ├── registry.ts          # ConnectorRegistry
│   │   │   │   ├── analytics/            # ga4.connector.ts, gsc.connector.ts ...
│   │   │   │   ├── advertising/          # google-ads, meta, linkedin ...
│   │   │   │   ├── logs/                 # aws, vultr, hostinger, nginx ...
│   │   │   │   ├── bi/                   # power-bi, tableau, looker ...
│   │   │   │   ├── session-replay/       # clarity, hotjar, fullstory ...
│   │   │   │   ├── workspace/            # gmail, m365, sendgrid ...
│   │   │   │   └── status-pages/         # vendor status monitoring
│   │   │   ├── metrics/          # Query / compare / forecast endpoints
│   │   │   ├── chat/             # AI chat (SSE streaming)
│   │   │   ├── anomalies/        # Anomaly records + feed
│   │   │   ├── reports/          # Executive report generation
│   │   │   ├── ai-engine/        # query-planner, llm-orchestrator, context-builder
│   │   │   └── workers/          # BullMQ job processors
│   │   └── prisma/               # Prisma schema + migrations
│   ├── test/
│   ├── package.json
│   ├── tsconfig.json
│   └── nest-cli.json
│
├── frontend/                     # Next.js 15 app (added later)
│
├── ml-service/                   # Python ML microservice (Phase 4 only)
│                                 # Prophet / XGBoost / scikit-learn, exposed over HTTP
│
├── docs/                         # This guide + architecture docs
└── infrastructure/               # Docker / deployment configs
```

**Naming conventions:**

| Thing | Convention | Example |
|---|---|---|
| Variables, functions | `camelCase` | `fetchMetrics`, `tenantId` |
| Classes, types, interfaces | `PascalCase` | `BaseConnector`, `ConnectorMetric` |
| File names | `kebab-case` + role suffix | `ga4.connector.ts`, `auth.service.ts` |
| URL paths | `kebab-case` | `/api/v1/status-pages` |
| Constants | `UPPER_SNAKE_CASE` | `ANOMALY_ZSCORE_THRESHOLD` |

---

## 5. The Connector Pattern (TypeScript)

Every data source connector follows this shape — the TypeScript translation of the doc's `BaseConnector`. This is the **reference pattern**; you'll write each concrete connector yourself following it.

```typescript
// backend/src/modules/connectors/base-connector.ts

export interface ConnectorMetric {
  metricName: string;
  value: number;
  dimensions: Record<string, string>;
  recordedAt: Date;
  source: string;
}

export abstract class BaseConnector {
  abstract readonly sourceName: string;      // 'ga4', 'meta_ads', 'nginx_logs'
  readonly supportsRealtime: boolean = false;

  abstract authenticate(credentials: Record<string, unknown>): Promise<boolean>;

  abstract fetchMetrics(
    tenantId: string,
    start: Date,
    end: Date,
  ): AsyncGenerator<ConnectorMetric>;

  abstract healthCheck(): Promise<Record<string, unknown>>;

  // Default sync: pull metrics and push each into ClickHouse
  async sync(tenantId: string, start: Date, end: Date): Promise<number> {
    let count = 0;
    for await (const metric of this.fetchMetrics(tenantId, start, end)) {
      await clickhouse.insertMetric(metric);
      count += 1;
    }
    return count;
  }
}
```

TypeScript equivalents of the Python concepts:

| Python | TypeScript |
|---|---|
| `class BaseConnector(ABC)` | `abstract class BaseConnector` |
| `@abstractmethod` | `abstract methodName(): ReturnType` |
| `AsyncGenerator[ConnectorMetric, None]` | `AsyncGenerator<ConnectorMetric>` |
| `async def` / `await` | `async` / `await` *(nearly identical)* |
| `dict[str, str]` | `Record<string, string>` |
| Pydantic `BaseModel` | `interface` or class with class-validator |

---

## 6. The Python ML Microservice (Phase 4 — deferred)

The predictive models stay in Python but live in an **isolated service**, not the main app.

```
Node (NestJS) app  ──HTTP──▶  ml-service (Python + FastAPI)
                                 ├─ Prophet     (traffic forecast)
                                 ├─ XGBoost      (revenue prediction)
                                 └─ scikit-learn (Isolation Forest anomalies)
```

- The NestJS app calls it like any other API: `POST /forecast { metric, history }` → `{ forecast, confidence_interval }`.
- Basic anomaly detection (Z-score, IQR, thresholds) is simple math done **natively in TypeScript** — only the advanced ML needs Python.
- This is a standard "polyglot microservice" pattern and does not appear until Phase 4 (week 15+).

---

## 7. Code Quality Rules (TypeScript)

- **Strict mode on.** `tsconfig` with `"strict": true`. No `any` without a `// justification` comment.
- **Validate every input.** All API request bodies use a DTO with class-validator decorators. No raw untyped objects at API boundaries.
- **Async everywhere.** All I/O uses `async/await`. Never block the event loop.
- **Tenant isolation is mandatory.** Every database query includes a `tenantId` filter — no exceptions.
- **No secrets in code.** Read everything from `.env` via `@nestjs/config`. `.env` is git-ignored.
- **Errors are typed.** Catch specific errors; use Nest exception filters. No swallowing errors silently.
- **Tests.** Every connector has a unit test with mocked HTTP. Target 80% coverage.
- **Named constants.** Thresholds (anomaly σ, alert %) are named constants, never magic numbers.

---

## 8. Revised Phase 1 Checklist

1. ✅ Choose stack: TypeScript + NestJS
2. ✅ Scaffold the NestJS backend project
3. ✅ First endpoint running (`GET /api/v1` → health check, now DB-aware)
4. ✅ Environment config (`@nestjs/config` + `.env`)
5. ✅ Prisma + PostgreSQL: `Tenant`, `User`, `Connection` tables (multi-tenant schema, migrated to Neon)
6. ✅ Tenant-isolation: `AuthGuard` populates `AuthContext.tenantId`; queries scope by it
7. 🟡 Auth — **stub** header/dev-fallback guard in place (`AuthGuard`); swap for Clerk later at the same seam
8. ✅ First connector: GA4 (`BaseConnector` pattern, mock now → live when GA4 creds set)
9. ✅ Basic chat endpoint calling Claude via `@anthropic-ai/sdk` (mock now → live when `ANTHROPIC_API_KEY` set)

*Success criterion (from original guide): a user can ask questions about GA4 data in chat.*
