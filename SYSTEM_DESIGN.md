# Political Score API — System Design (No Code Phase)

## 1) System Architecture Diagram

```mermaid
flowchart TB
  subgraph Sources[External Data Sources]
    D1[Diet Proceedings\n(speeches/questions)]
    D2[Attendance Records]
    D3[Bill Registry\n(submitted/passed)]
    D4[Committee & Party Roles]
  end

  subgraph Ingestion[Data Collection Layer]
    C1[Source Connectors\n(scraper/API/CSV)]
    C2[Normalization & Validation]
    C3[Deduplication]
    C4[Raw Staging Store]
  end

  subgraph Core[Backend Services (FastAPI Domain)]
    S1[Politician Service]
    S2[Activity Service]
    S3[Bill Service]
    S4[Scoring Orchestrator]
    S5[Ranking Service]
    S6[Analysis Service]
  end

  subgraph AI[AI Scoring Module]
    A1[Question Quality Job Producer]
    A2[Async Worker Queue]
    A3[LLM Evaluator Adapter]
    A4[Quality Score Store]
  end

  subgraph Data[PostgreSQL]
    P1[(politicians)]
    P2[(activities)]
    P3[(bills)]
    P4[(influence_roles)]
    P5[(score_components)]
    P6[(scores)]
    P7[(ingestion_runs)]
    P8[(llm_evaluations)]
  end

  subgraph API[Public API]
    E1[GET /politicians]
    E2[GET /politicians/{id}]
    E3[GET /ranking]
    E4[GET /analysis/{id}]
  end

  subgraph FE[Next.js Frontend]
    F1[Ranking Dashboard]
    F2[Politician Detail]
    F3[Radar Visualization]
  end

  subgraph Obs[Ops]
    O1[Structured Logging]
    O2[Metrics/Tracing]
    O3[Alerting]
  end

  D1 --> C1
  D2 --> C1
  D3 --> C1
  D4 --> C1

  C1 --> C2 --> C3 --> C4
  C4 --> P1
  C4 --> P2
  C4 --> P3
  C4 --> P4
  C4 --> P7

  S1 --> P1
  S2 --> P2
  S3 --> P3
  S4 --> P5
  S4 --> P6
  S5 --> P6
  S6 --> P5

  S4 --> A1 --> A2 --> A3 --> A4 --> P8
  P8 --> S4

  E1 --> S1
  E2 --> S1
  E3 --> S5
  E4 --> S6

  FE --> API

  Core --> O1
  Core --> O2
  AI --> O1
  AI --> O2
  O2 --> O3
```

---

## 2) Tech Stack Explanation

### Backend (API)
- **Python 3.12 + FastAPI** for high-throughput async APIs and clear OpenAPI contracts.
- **Pydantic v2** for strict request/response schemas and validation.
- **SQLAlchemy 2.x + Alembic** for DB access and schema migrations.
- **Uvicorn/Gunicorn** for production process management.

### Data Ingestion
- Connector abstraction supports **HTTP scraping**, **CSV batch imports**, and future official APIs.
- Ingestion jobs are idempotent via source-record hash + run metadata.

### Asynchronous AI Scoring
- **Task queue model** (producer/worker) to decouple API latency from LLM evaluation.
- LLM provider wrapped behind an adapter interface for vendor flexibility and cost control.

### Database
- **PostgreSQL 16** as source of truth.
- Normalized relational model with targeted indexes for ranking and profile queries.

### Frontend
- **Next.js 15 (App Router)** + **React** + **TypeScript**.
- **TailwindCSS** for consistent utility-based styling.
- Radar chart rendered with a charting library (e.g., Recharts/ECharts) behind a reusable visualization component.

### Deployment
- Containerized with **Docker** and **docker-compose** for local/prod parity.
- Ready for later split into microservices without redesigning domain boundaries.

---

## 3) Database Schema (SQL Design Specification)

> Design intent is normalization-first (3NF) while preserving query performance for ranking and analysis.

### `politicians`
- `id` (PK, bigint)
- `name_ja`, `name_en` (text)
- `party_id` (FK)
- `electoral_district` (text)
- `house` (enum: representatives/councillors)
- `term_start`, `term_end` (date)
- `is_active` (bool)
- `created_at`, `updated_at`

**Indexes**
- `(party_id)`
- `(house, is_active)`
- unique logical key on canonical name + house + term window

### `activities`
- `id` (PK)
- `politician_id` (FK -> politicians)
- `activity_type` (enum: question/speech/attendance/committee_action)
- `session_date` (date)
- `session_id` (text)
- `source_url` (text)
- `source_hash` (text, unique per source)
- `content_text` (text, nullable for attendance)
- `metadata_json` (jsonb)
- `created_at`

**Indexes**
- `(politician_id, session_date desc)`
- `(activity_type, session_date desc)`
- unique `(source_hash)`

### `bills`
- `id` (PK)
- `bill_code` (text unique)
- `title` (text)
- `status` (enum: submitted/in_committee/passed/rejected/withdrawn)
- `submitted_date` (date)
- `passed_date` (date nullable)
- `created_at`, `updated_at`

### `bill_sponsors`
- `bill_id` (FK -> bills)
- `politician_id` (FK -> politicians)
- `sponsor_role` (enum: primary/co/committee)
- composite PK `(bill_id, politician_id, sponsor_role)`

**Indexes**
- `(politician_id, sponsor_role)`
- `(bill_id)`

### `influence_roles`
- `id` (PK)
- `politician_id` (FK)
- `role_scope` (enum: committee/party/parliament)
- `role_name` (text)
- `level_weight` (numeric)
- `start_date`, `end_date`
- `source_url`, `source_hash`

**Indexes**
- `(politician_id, end_date nulls first)`

### `llm_evaluations`
- `id` (PK)
- `activity_id` (FK -> activities, unique)
- `model_name` (text)
- `prompt_version` (text)
- `quality_score` (numeric 0..100)
- `confidence` (numeric 0..1)
- `rationale_summary` (text)
- `evaluated_at`
- `status` (enum: queued/succeeded/failed)

**Indexes**
- `(status, evaluated_at desc)`
- `(activity_id)`

### `score_components`
- `id` (PK)
- `politician_id` (FK)
- `period_start`, `period_end` (date)
- `activity_score` (numeric)
- `question_quality_score` (numeric)
- `legislative_score` (numeric)
- `influence_score` (numeric)
- `policy_impact_score` (numeric)
- `weights_version` (text)
- `computed_at`

**Indexes**
- `(politician_id, computed_at desc)`
- `(period_start, period_end)`

### `scores`
- `id` (PK)
- `politician_id` (FK)
- `component_set_id` (FK -> score_components)
- `final_score` (numeric)
- `rank_snapshot` (int)
- `computed_at`

**Indexes**
- `(computed_at desc, final_score desc)`
- `(politician_id, computed_at desc)`

### `ingestion_runs`
- `id` (PK)
- `source_name` (text)
- `started_at`, `finished_at`
- `status` (enum: running/success/failure/partial)
- `records_seen`, `records_inserted`, `records_updated`, `records_failed`
- `error_summary` (text)

---

## 4) Backend Code (Design-Level Specification)

### Layered Architecture
- **API Layer**: route handlers, authentication hooks (future), response mapping.
- **Application Layer**: use-cases (`GetRanking`, `GetPoliticianDetail`, `GetAnalysis`).
- **Domain Layer**: scoring policies, entity rules, invariants.
- **Infrastructure Layer**: DB repositories, ingestion connectors, LLM adapter, queue integration.

### Endpoint Contracts
- `GET /politicians`
  - pagination (`limit`, `offset`), optional filters (`party`, `house`, `active`).
- `GET /politicians/{id}`
  - base profile + latest final score + recent activity summary.
- `GET /ranking`
  - sorted by `final_score` desc, supports snapshot date.
- `GET /analysis/{id}`
  - detailed component scores + weight set + contribution percentages.

### Reliability & API Concerns
- Global exception middleware with typed error codes.
- Request correlation IDs for tracing.
- Strict schema validation and versioned API (`/v1`).
- Cursor pagination for large result sets in ranking endpoint.

---

## 5) Scoring Engine Implementation (Design)

### Component Scores
1. **Activity Score**
   - Inputs: question count, speech count, attendance ratio.
   - Normalize each metric per chamber/session and combine.

2. **Question Quality Score**
   - Mean or robust average (trimmed mean) of LLM `quality_score` across analyzed questions.
   - Minimum sample-size threshold before high confidence.

3. **Legislative Score**
   - Weighted sum of bills submitted, co-sponsored, committee progress, and passed outcomes.

4. **Influence Score**
   - Derived from role hierarchy and tenure duration in roles.

5. **Policy Impact Score**
   - Uses bill outcomes + downstream indicators (initially proxy-based, later enriched).

### Final Score Formula
- `Final = w_activity*A + w_quality*Q + w_legislative*L + w_influence*I + w_policy*P`
- Weight sets versioned and stored; active set loaded from config table or environment-backed registry.

### Operational Rules
- Recompute per politician on new relevant data event.
- Nightly full refresh for consistency.
- Keep historical snapshots to support trend analysis and auditable rankings.

---

## 6) AI Scoring Module (Design)

### Pipeline
1. Detect new `activities` of type `question/speech` without successful evaluation.
2. Enqueue task with `activity_id`, language metadata, and prompt version.
3. Worker fetches text, invokes LLM adapter.
4. Persist `quality_score`, `confidence`, and short rationale.
5. Trigger component and final-score recomputation.

### Guardrails
- Prompt template versioning for reproducibility.
- Retry policy with exponential backoff for transient LLM failures.
- Timeout and circuit breaker for provider instability.
- Cost controls: max tokens per request, batching policy where possible.

### Quality Assurance
- Human-audited calibration set to validate score drift.
- Bias checks across parties/houses to detect systemic skew.
- Model fallback strategy if primary provider is degraded.

---

## 7) Frontend Code (Design)

### Pages
1. **Ranking Dashboard**
   - Table with rank, name, party, final score, change vs previous snapshot.
   - Filters: house, party, date snapshot.

2. **Politician Detail Page**
   - Bio/header section.
   - Score cards for each component.
   - Activity and bills timeline.

3. **Score Visualization**
   - Radar chart for five score components.
   - Overlay comparison with chamber average.

### Frontend Architecture
- Server-side data fetching for SEO/performance on ranking and detail pages.
- Shared API client with typed responses.
- Error boundary + empty/loading states for production resilience.
- Design tokens via Tailwind config for consistent UI scale.

---

## 8) Docker Setup (Design)

### Services
- `api`: FastAPI service (depends on `db`, optional `worker`).
- `worker`: async scoring worker consuming queue.
- `frontend`: Next.js app.
- `db`: PostgreSQL with volume persistence.
- `queue` (optional but recommended): Redis/RabbitMQ depending on worker framework.

### Environment Strategy
- `.env` for local, secrets manager in production.
- Separate environment variables for DB URL, LLM keys, scoring weights version, logging level.

### Production Hardening
- Health checks for all services.
- Non-root containers and slim base images.
- Resource limits and restart policies.

---

## 9) Setup Instructions (Design-Phase Runbook)

1. Provision PostgreSQL and initialize schema migrations.
2. Configure ingestion source credentials/endpoints.
3. Start queue + worker for AI scoring.
4. Launch API service and verify `/health` + OpenAPI docs.
5. Launch frontend and validate API connectivity.
6. Run initial backfill ingestion job.
7. Trigger first scoring snapshot and validate ranking outputs.
8. Enable observability stack (logs, metrics, alerts).
9. Establish scheduled jobs:
   - frequent incremental ingestion,
   - nightly full recompute,
   - weekly calibration report for AI score quality.

---

## Engineering Decisions (Clarifications)

- Chose normalized relational schema with snapshot tables to support historical ranking reproducibility.
- Chose async LLM evaluation to protect API latency and improve fault isolation.
- Chose configurable weight versioning to support policy changes without data rewrites.
- Chose layered architecture to keep scraping, scoring logic, and API contracts independently evolvable.
