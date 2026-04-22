# LLM Scoring Pipeline Design

## 1. Goals

- Score Japanese Diet speeches/questions on a **0-100 quality scale**.
- Keep API latency low by running LLM scoring asynchronously.
- Guarantee reproducibility and auditability across model/prompt changes.
- Support horizontal scaling and provider failover.

---

## 2. Scope

### In scope
- Data flow from newly ingested activity text to persisted quality scores.
- Queue/worker orchestration.
- Retry, backoff, idempotency, and dead-letter handling.
- Prompt versioning and model configuration.
- Observability, governance, and recalculation triggers.

### Out of scope
- UI/visualization details.
- Provider-specific prompt text content.

---

## 3. High-Level Architecture

```mermaid
flowchart LR
  A[Ingestion Upsert: activities] --> B[Eligibility Scanner]
  B -->|eligible| C[Score Task Producer]
  C --> D[(Queue)]
  D --> E[LLM Worker Pool]
  E --> F[Prompt Builder]
  F --> G[LLM Adapter]
  G --> H[Response Validator]
  H --> I[(llm_evaluations)]
  I --> J[Score Recompute Trigger]
  J --> K[(score_components / scores)]

  E --> L[Retry Policy]
  L --> D
  E --> M[DLQ]

  N[Model Registry + Prompt Versions] --> F
  O[Policy Config (timeouts, max tokens, thresholds)] --> E
```

---

## 4. Pipeline Stages

## Stage A — Eligibility detection

A newly inserted or updated `activities` row is eligible when:
- `activity_type IN ('question', 'speech')`
- `content_text` is non-empty and above minimum character threshold
- no existing successful `llm_evaluations` record for `activity_id`

Output: enqueue one logical scoring task per `activity_id`.

## Stage B — Task production

Producer creates a message:
- `job_id` (UUID)
- `activity_id`
- `priority`
- `prompt_version`
- `model_profile`
- `trace_id`
- `attempt` (start at 0)

Idempotency key:
- `activity_id + prompt_version + model_profile`

If duplicate message is detected, it is acknowledged and skipped.

## Stage C — Worker execution

Worker flow:
1. fetch activity text + metadata
2. normalize text (whitespace, unicode, max length policy)
3. construct prompt from versioned template
4. call LLM adapter with timeout and token budget
5. parse structured output
6. validate score range, schema, and confidence
7. persist result and emit domain event for recomputation

## Stage D — Post-processing

On successful write to `llm_evaluations`:
- enqueue recomputation event for associated politician
- recompute `question_quality_score`
- recompute final weighted score snapshot

---

## 5. Data Contracts

## 5.1 Queue message contract

```json
{
  "job_id": "uuid",
  "activity_id": 12345,
  "priority": "normal",
  "prompt_version": "qscore_v1_2026_04",
  "model_profile": "primary_gpt_tier",
  "attempt": 0,
  "trace_id": "uuid",
  "enqueued_at": "2026-04-20T00:00:00Z"
}
```

## 5.2 LLM structured output contract

```json
{
  "quality_score": 0,
  "confidence": 0.0,
  "rationale_summary": "string <= 500 chars",
  "flags": ["optional", "quality", "markers"]
}
```

Validation rules:
- `quality_score` in `[0,100]`
- `confidence` in `[0,1]`
- reject malformed payloads, classify as retryable/non-retryable

---

## 6. State Machine

`llm_evaluations.status` lifecycle:

1. `queued`
2. `succeeded` OR `failed`

Failure split:
- **retryable**: transient provider/network/rate-limit/timeouts
- **terminal**: invalid activity payload, repeated schema violations, policy block

Terminal failures are sent to DLQ with reason code and context.

---

## 7. Retry and Backoff Strategy

- Max attempts: `5`
- Backoff: exponential (`2^attempt`) with jitter
- Per-attempt timeout: configurable (e.g., 15s)
- Circuit breaker opens when provider error rate exceeds threshold in rolling window
- During breaker-open:
  - route to fallback provider profile, or
  - pause queue consumption for affected model profile

---

## 8. Prompt/Model Governance

- Prompt templates versioned (`prompt_version`) and immutable once released.
- Model profiles versioned (`model_profile`) and centrally configured.
- Each evaluation persists:
  - `model_name`
  - `prompt_version`
  - timestamp
- Re-scoring policy:
  - if prompt/model changes materially, enqueue backfill run for impacted period.

---

## 9. Scoring Calibration and Drift Control

- Maintain a gold evaluation set curated by policy analysts.
- Weekly calibration job:
  - compare model outputs to gold set
  - compute drift metrics (MAE, rank correlation)
  - alert on threshold breach
- Bias monitoring:
  - compare score distributions by party/house/term
  - investigate persistent skew patterns

---

## 10. Operational SLOs

- P95 end-to-end scoring latency (ingested activity → stored evaluation): target `< 10 min`
- Queue backlog alert threshold: configurable by ingestion volume
- Evaluation success rate target: `>= 99%` after retries
- Recompute freshness for ranking: target `< 30 min`

---

## 11. Observability Design

## 11.1 Metrics
- `llm_jobs_enqueued_total`
- `llm_jobs_processed_total{status}`
- `llm_job_duration_seconds`
- `llm_provider_errors_total{type}`
- `llm_tokens_used_total{model}`
- `llm_cost_estimate_total{model}`
- `llm_dlq_total{reason}`

## 11.2 Logging
Structured logs per job with:
- `trace_id`, `job_id`, `activity_id`, `prompt_version`, `model_profile`, `attempt`, `status`, `error_code`

## 11.3 Tracing
Single trace spans:
- producer enqueue
- worker fetch
- LLM adapter call
- DB write
- recompute trigger

---

## 12. Security and Compliance

- Activity text may contain sensitive context; restrict access by service role.
- Do not log raw full text by default; log hashes/snippets only.
- Encrypt data in transit and at rest.
- Rotate provider API keys and enforce least-privilege secrets access.

---

## 13. Backfill and Reprocessing Strategy

### Initial backfill
- Process historical activities in bounded batches (`N` rows per shard).
- Prioritize recent sessions first for faster user-visible ranking quality.

### Reprocessing triggers
- prompt version upgrade
- model profile switch
- bug fix in parser/validator

### Reprocessing controls
- run-id tagging for each backfill campaign
- throttling to avoid starving real-time queue

---

## 14. Failure Modes and Mitigations

1. **Provider outage**
   - fallback profile + circuit breaker + queued retry
2. **Malformed LLM output**
   - strict schema parse + limited retries + DLQ
3. **DB contention**
   - short transactions + retry on serialization conflicts
4. **Runaway costs**
   - token caps + budget guardrail + dynamic rate limiting
5. **Duplicate processing**
   - idempotency key + unique constraint (`activity_id`) on evaluation storage

---

## 15. Deployment Topology (Recommended)

- `api` service (FastAPI)
- `producer` service (eligibility scanner + enqueue)
- `worker` service (LLM scoring)
- `queue` broker (Redis/RabbitMQ)
- `postgres` primary
- optional `metrics` + `log` + `trace` stack

Each component should be independently scalable:
- API scale by request load
- Worker scale by queue depth and provider rate limits

---

## 16. Implementation-Ready Checklist

- [ ] Queue selected and provisioned with DLQ
- [ ] Message schema validated and versioned
- [ ] LLM adapter interface implemented with fallback profiles
- [ ] Parser/validator for strict structured outputs
- [ ] Metrics, tracing, and alert rules defined
- [ ] Recompute trigger integrated with scoring engine
- [ ] Backfill runner prepared for model/prompt migration
