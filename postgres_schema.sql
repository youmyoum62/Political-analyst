BEGIN;

-- Optional extension for case-insensitive text and hashing helpers.
CREATE EXTENSION IF NOT EXISTS citext;

-- =========================
-- Enumerated domain types
-- =========================
CREATE TYPE house_type AS ENUM ('representatives', 'councillors');
CREATE TYPE activity_type AS ENUM ('question', 'speech', 'attendance', 'committee_action');
CREATE TYPE bill_status AS ENUM ('submitted', 'in_committee', 'passed', 'rejected', 'withdrawn');
CREATE TYPE sponsor_role AS ENUM ('primary', 'co', 'committee');
CREATE TYPE role_scope AS ENUM ('committee', 'party', 'parliament');
CREATE TYPE evaluation_status AS ENUM ('queued', 'succeeded', 'failed');
CREATE TYPE run_status AS ENUM ('running', 'success', 'failure', 'partial');

-- =========================
-- Core reference tables
-- =========================
CREATE TABLE parties (
  id                BIGSERIAL PRIMARY KEY,
  name_ja           CITEXT NOT NULL,
  name_en           CITEXT,
  abbreviation      CITEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_parties_name_ja UNIQUE (name_ja),
  CONSTRAINT uq_parties_abbreviation UNIQUE (abbreviation)
);

CREATE TABLE politicians (
  id                BIGSERIAL PRIMARY KEY,
  external_ref       TEXT,
  name_ja           CITEXT NOT NULL,
  name_en           CITEXT,
  party_id          BIGINT REFERENCES parties(id) ON UPDATE CASCADE ON DELETE SET NULL,
  electoral_district TEXT,
  house             house_type NOT NULL,
  term_start        DATE,
  term_end          DATE,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_politicians_external_ref UNIQUE (external_ref),
  CONSTRAINT ck_politicians_term_window CHECK (term_end IS NULL OR term_start IS NULL OR term_end >= term_start)
);

-- =========================
-- Activity ingestion tables
-- =========================
CREATE TABLE ingestion_runs (
  id                BIGSERIAL PRIMARY KEY,
  source_name       TEXT NOT NULL,
  started_at        TIMESTAMPTZ NOT NULL,
  finished_at       TIMESTAMPTZ,
  status            run_status NOT NULL,
  records_seen      INTEGER NOT NULL DEFAULT 0,
  records_inserted  INTEGER NOT NULL DEFAULT 0,
  records_updated   INTEGER NOT NULL DEFAULT 0,
  records_failed    INTEGER NOT NULL DEFAULT 0,
  error_summary     TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_ingestion_records_non_negative CHECK (
    records_seen >= 0 AND records_inserted >= 0 AND records_updated >= 0 AND records_failed >= 0
  )
);

CREATE TABLE activities (
  id                BIGSERIAL PRIMARY KEY,
  politician_id     BIGINT NOT NULL REFERENCES politicians(id) ON UPDATE CASCADE ON DELETE CASCADE,
  ingestion_run_id  BIGINT REFERENCES ingestion_runs(id) ON UPDATE CASCADE ON DELETE SET NULL,
  activity_type     activity_type NOT NULL,
  session_date      DATE NOT NULL,
  session_id        TEXT,
  source_url        TEXT NOT NULL,
  source_hash       TEXT NOT NULL,
  content_text      TEXT,
  metadata_json     JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_activities_source_hash UNIQUE (source_hash)
);

-- =========================
-- Legislative tables
-- =========================
CREATE TABLE bills (
  id                BIGSERIAL PRIMARY KEY,
  bill_code         TEXT NOT NULL,
  title             TEXT NOT NULL,
  status            bill_status NOT NULL DEFAULT 'submitted',
  submitted_date    DATE,
  passed_date       DATE,
  source_url        TEXT,
  source_hash       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_bills_bill_code UNIQUE (bill_code),
  CONSTRAINT uq_bills_source_hash UNIQUE (source_hash),
  CONSTRAINT ck_bills_passed_date CHECK (passed_date IS NULL OR submitted_date IS NULL OR passed_date >= submitted_date)
);

CREATE TABLE bill_sponsors (
  bill_id           BIGINT NOT NULL REFERENCES bills(id) ON UPDATE CASCADE ON DELETE CASCADE,
  politician_id     BIGINT NOT NULL REFERENCES politicians(id) ON UPDATE CASCADE ON DELETE CASCADE,
  sponsor_role      sponsor_role NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (bill_id, politician_id, sponsor_role)
);

CREATE TABLE influence_roles (
  id                BIGSERIAL PRIMARY KEY,
  politician_id     BIGINT NOT NULL REFERENCES politicians(id) ON UPDATE CASCADE ON DELETE CASCADE,
  role_scope        role_scope NOT NULL,
  role_name         TEXT NOT NULL,
  level_weight      NUMERIC(8,4) NOT NULL DEFAULT 1.0000,
  start_date        DATE,
  end_date          DATE,
  source_url        TEXT,
  source_hash       TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_influence_roles_source_hash UNIQUE (source_hash),
  CONSTRAINT ck_influence_roles_weight_non_negative CHECK (level_weight >= 0),
  CONSTRAINT ck_influence_roles_dates CHECK (end_date IS NULL OR start_date IS NULL OR end_date >= start_date)
);

-- =========================
-- AI quality scoring tables
-- =========================
CREATE TABLE llm_evaluations (
  id                BIGSERIAL PRIMARY KEY,
  activity_id       BIGINT NOT NULL REFERENCES activities(id) ON UPDATE CASCADE ON DELETE CASCADE,
  model_name        TEXT NOT NULL,
  prompt_version    TEXT NOT NULL,
  quality_score     NUMERIC(5,2),
  confidence        NUMERIC(4,3),
  rationale_summary TEXT,
  evaluated_at      TIMESTAMPTZ,
  status            evaluation_status NOT NULL DEFAULT 'queued',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_llm_evaluations_activity UNIQUE (activity_id),
  CONSTRAINT ck_llm_evaluations_quality_range CHECK (quality_score IS NULL OR (quality_score >= 0 AND quality_score <= 100)),
  CONSTRAINT ck_llm_evaluations_confidence_range CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

-- =========================
-- Score snapshot tables
-- =========================
CREATE TABLE weight_sets (
  id                BIGSERIAL PRIMARY KEY,
  version           TEXT NOT NULL,
  activity_weight   NUMERIC(7,6) NOT NULL,
  quality_weight    NUMERIC(7,6) NOT NULL,
  legislative_weight NUMERIC(7,6) NOT NULL,
  influence_weight  NUMERIC(7,6) NOT NULL,
  policy_weight     NUMERIC(7,6) NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_weight_sets_version UNIQUE (version),
  CONSTRAINT ck_weight_sets_non_negative CHECK (
    activity_weight >= 0 AND quality_weight >= 0 AND legislative_weight >= 0 AND influence_weight >= 0 AND policy_weight >= 0
  ),
  CONSTRAINT ck_weight_sets_sum_to_one CHECK (
    ABS((activity_weight + quality_weight + legislative_weight + influence_weight + policy_weight) - 1.0) < 0.000001
  )
);

CREATE TABLE score_components (
  id                BIGSERIAL PRIMARY KEY,
  politician_id     BIGINT NOT NULL REFERENCES politicians(id) ON UPDATE CASCADE ON DELETE CASCADE,
  weight_set_id     BIGINT NOT NULL REFERENCES weight_sets(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  period_start      DATE NOT NULL,
  period_end        DATE NOT NULL,
  activity_score    NUMERIC(5,2) NOT NULL,
  question_quality_score NUMERIC(5,2) NOT NULL,
  legislative_score NUMERIC(5,2) NOT NULL,
  influence_score   NUMERIC(5,2) NOT NULL,
  policy_impact_score NUMERIC(5,2) NOT NULL,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_score_components_period CHECK (period_end >= period_start),
  CONSTRAINT ck_score_components_ranges CHECK (
    activity_score BETWEEN 0 AND 100
    AND question_quality_score BETWEEN 0 AND 100
    AND legislative_score BETWEEN 0 AND 100
    AND influence_score BETWEEN 0 AND 100
    AND policy_impact_score BETWEEN 0 AND 100
  )
);

CREATE TABLE scores (
  id                BIGSERIAL PRIMARY KEY,
  politician_id     BIGINT NOT NULL REFERENCES politicians(id) ON UPDATE CASCADE ON DELETE CASCADE,
  component_set_id  BIGINT NOT NULL REFERENCES score_components(id) ON UPDATE CASCADE ON DELETE CASCADE,
  final_score       NUMERIC(5,2) NOT NULL,
  rank_snapshot     INTEGER,
  computed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_scores_component_set UNIQUE (component_set_id),
  CONSTRAINT ck_scores_range CHECK (final_score BETWEEN 0 AND 100),
  CONSTRAINT ck_scores_rank_positive CHECK (rank_snapshot IS NULL OR rank_snapshot > 0)
);

-- =========================
-- Index strategy
-- =========================
CREATE INDEX idx_politicians_party_id ON politicians (party_id);
CREATE INDEX idx_politicians_house_active ON politicians (house, is_active);
CREATE INDEX idx_politicians_name_ja ON politicians (name_ja);

CREATE INDEX idx_activities_politician_date_desc ON activities (politician_id, session_date DESC);
CREATE INDEX idx_activities_type_date_desc ON activities (activity_type, session_date DESC);
CREATE INDEX idx_activities_session_id ON activities (session_id);
CREATE INDEX idx_activities_ingestion_run_id ON activities (ingestion_run_id);
CREATE INDEX idx_activities_metadata_gin ON activities USING GIN (metadata_json);

CREATE INDEX idx_ingestion_runs_source_started_desc ON ingestion_runs (source_name, started_at DESC);
CREATE INDEX idx_ingestion_runs_status_started_desc ON ingestion_runs (status, started_at DESC);

CREATE INDEX idx_bills_status_submitted_date_desc ON bills (status, submitted_date DESC);
CREATE INDEX idx_bills_passed_date_desc ON bills (passed_date DESC);

CREATE INDEX idx_bill_sponsors_politician_role ON bill_sponsors (politician_id, sponsor_role);
CREATE INDEX idx_bill_sponsors_bill_id ON bill_sponsors (bill_id);

CREATE INDEX idx_influence_roles_politician_active_window ON influence_roles (politician_id, end_date NULLS FIRST, start_date DESC);
CREATE INDEX idx_influence_roles_scope ON influence_roles (role_scope);

CREATE INDEX idx_llm_eval_status_evaluated_desc ON llm_evaluations (status, evaluated_at DESC);
CREATE INDEX idx_llm_eval_model_prompt ON llm_evaluations (model_name, prompt_version);

CREATE INDEX idx_score_components_politician_computed_desc ON score_components (politician_id, computed_at DESC);
CREATE INDEX idx_score_components_period ON score_components (period_start, period_end);
CREATE INDEX idx_score_components_weight_set_id ON score_components (weight_set_id);

CREATE INDEX idx_scores_computed_final_desc ON scores (computed_at DESC, final_score DESC);
CREATE INDEX idx_scores_politician_computed_desc ON scores (politician_id, computed_at DESC);
CREATE INDEX idx_scores_rank_snapshot ON scores (rank_snapshot);

-- Optional uniqueness: at most one active weight set.
CREATE UNIQUE INDEX uq_weight_sets_single_active
  ON weight_sets ((is_active))
  WHERE is_active = TRUE;

COMMIT;
