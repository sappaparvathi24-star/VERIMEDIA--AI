-- Migration 001: Initial Schema for VeriMedia AI Durable Storage
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  role TEXT NOT NULL DEFAULT 'ANALYST',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS investigations (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  lead_investigator TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  forensic_confidence REAL,
  provenance_confidence REAL,
  earliest_observed_appearance_id TEXT,
  metadata_json TEXT,
  limitations_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_investigations_created_at ON investigations(created_at);
CREATE INDEX IF NOT EXISTS idx_investigations_is_demo ON investigations(is_demo);
CREATE INDEX IF NOT EXISTS idx_investigations_org ON investigations(organization_id);

CREATE TABLE IF NOT EXISTS media_artifacts (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  filename TEXT,
  byte_size INTEGER,
  mime_type TEXT,
  sha256 TEXT NOT NULL,
  phash TEXT,
  storage_path TEXT,
  acquisition_method TEXT NOT NULL DEFAULT 'UPLOAD',
  acquisition_source TEXT,
  acquisition_timestamp TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  is_primary INTEGER NOT NULL DEFAULT 1 CHECK (is_primary IN (0, 1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  duplicate_of TEXT,
  metadata_json TEXT,
  limitations_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (duplicate_of) REFERENCES media_artifacts(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_media_artifacts_sha256 ON media_artifacts(sha256);
CREATE INDEX IF NOT EXISTS idx_media_artifacts_inv ON media_artifacts(investigation_id);

CREATE TABLE IF NOT EXISTS media_versions (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  artifact_id TEXT NOT NULL,
  version_label TEXT NOT NULL,
  aspect_ratio TEXT,
  width INTEGER,
  height INTEGER,
  duration_seconds REAL,
  frame_rate REAL,
  codec TEXT,
  quality_estimate REAL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES media_artifacts(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analysis_runs (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  artifact_id TEXT,
  method_name TEXT NOT NULL,
  method_version TEXT NOT NULL,
  parameters_json TEXT,
  start_time TEXT NOT NULL,
  end_time TEXT,
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('RUNNING', 'COMPLETED', 'ERROR', 'INCONCLUSIVE', 'SKIPPED')),
  error_message TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES media_artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS observations (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  analysis_run_id TEXT,
  artifact_id TEXT,
  observation_type TEXT NOT NULL,
  target_field TEXT,
  value_json TEXT,
  unit TEXT,
  confidence_score REAL,
  confidence_band TEXT,
  limitations_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (analysis_run_id) REFERENCES analysis_runs(id) ON DELETE SET NULL,
  FOREIGN KEY (artifact_id) REFERENCES media_artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS evidence (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  evidence_type TEXT NOT NULL,
  category TEXT NOT NULL,
  strength_score REAL,
  strength_band TEXT,
  basis_json TEXT,
  limitations_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS evidence_observations (
  evidence_id TEXT NOT NULL,
  observation_id TEXT NOT NULL,
  PRIMARY KEY (evidence_id, observation_id),
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE,
  FOREIGN KEY (observation_id) REFERENCES observations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS findings (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  title TEXT NOT NULL,
  statement TEXT NOT NULL,
  category TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OBSERVED' CHECK (status IN ('OBSERVED', 'SUPPORTED', 'INFERRED', 'CONFLICTING', 'INCONCLUSIVE', 'UNKNOWN')),
  confidence_score REAL,
  confidence_band TEXT,
  basis_json TEXT,
  limitations_json TEXT NOT NULL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS finding_evidence (
  finding_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  relationship_type TEXT DEFAULT 'SUPPORTS',
  PRIMARY KEY (finding_id, evidence_id),
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  investigation_id TEXT,
  source_type TEXT NOT NULL,
  name TEXT NOT NULL,
  domain TEXT,
  canonical_url TEXT,
  independence_group_id TEXT,
  is_verified INTEGER DEFAULT 0 CHECK (is_verified IN (0, 1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  handle TEXT NOT NULL,
  display_name TEXT,
  source_id TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS appearances (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  artifact_id TEXT,
  platform TEXT,
  url TEXT,
  published_at TEXT,
  retrieved_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  timestamp_type TEXT NOT NULL DEFAULT 'PUBLICATION_OBSERVED' CHECK (timestamp_type IN ('CAPTURE_CLAIMED', 'PUBLICATION_OBSERVED', 'RETRIEVAL', 'EMBEDDED_CLAIMED', 'INFERRED', 'UNKNOWN')),
  timestamp_quality TEXT DEFAULT 'MODERATE',
  is_earliest INTEGER DEFAULT 0 CHECK (is_earliest IN (0, 1)),
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  metadata_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE CASCADE,
  FOREIGN KEY (artifact_id) REFERENCES media_artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS claims (
  id TEXT PRIMARY KEY,
  investigation_id TEXT,
  target_artifact_id TEXT,
  parent_claim_id TEXT,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('LOCATION', 'DATE', 'EVENT', 'IDENTITY', 'AUTHORSHIP', 'AUTHENTICITY', 'TRANSFORMATION', 'ATTRIBUTION', 'CONTEXT')),
  statement TEXT NOT NULL,
  source_attribution TEXT,
  assessment TEXT NOT NULL DEFAULT 'UNVERIFIED' CHECK (assessment IN ('SUPPORTED', 'PARTIALLY_SUPPORTED', 'CONTRADICTED', 'INCONCLUSIVE', 'UNVERIFIED', 'UNKNOWN')),
  limitations_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (target_artifact_id) REFERENCES media_artifacts(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_claim_id) REFERENCES claims(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS claim_evidence (
  claim_id TEXT NOT NULL,
  evidence_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL DEFAULT 'SUPPORTS' CHECK (relationship_type IN ('SUPPORTS', 'CONTRADICTS', 'INCONCLUSIVE')),
  PRIMARY KEY (claim_id, evidence_id),
  FOREIGN KEY (claim_id) REFERENCES claims(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_id) REFERENCES evidence(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  event_timestamp TEXT,
  location_name TEXT,
  latitude REAL,
  longitude REAL,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  country_code TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS transformations (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  source_version_id TEXT,
  target_version_id TEXT,
  transformation_type TEXT NOT NULL,
  measurements_json TEXT,
  status TEXT NOT NULL DEFAULT 'MEASURED',
  limitations_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  relationship_basis TEXT NOT NULL DEFAULT 'INFERRED' CHECK (relationship_basis IN ('OBSERVED', 'INFERRED', 'UNKNOWN')),
  status TEXT NOT NULL DEFAULT 'SUPPORTED' CHECK (status IN ('SUPPORTED', 'CONFLICTING', 'INCONCLUSIVE', 'UNKNOWN')),
  confidence_score REAL,
  basis_json TEXT,
  limitations_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discovery_jobs (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'RUNNING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED', 'UNAVAILABLE')),
  provider_name TEXT NOT NULL,
  parameters_json TEXT,
  result_count INTEGER DEFAULT 0,
  error_message TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS discovery_candidates (
  id TEXT PRIMARY KEY,
  job_id TEXT NOT NULL,
  investigation_id TEXT NOT NULL,
  url TEXT NOT NULL,
  source_type TEXT NOT NULL,
  match_strategy TEXT NOT NULL,
  similarity_score REAL,
  candidate_metadata_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (job_id) REFERENCES discovery_jobs(id) ON DELETE CASCADE,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS propagation_events (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  source_id TEXT,
  account_id TEXT,
  artifact_id TEXT,
  event_timestamp TEXT,
  epistemic_status TEXT NOT NULL DEFAULT 'OBSERVED',
  details_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (source_id) REFERENCES sources(id) ON DELETE SET NULL,
  FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE SET NULL,
  FOREIGN KEY (artifact_id) REFERENCES media_artifacts(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS propagation_relationships (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  from_event_id TEXT NOT NULL,
  to_event_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  relationship_basis TEXT NOT NULL DEFAULT 'INFERRED' CHECK (relationship_basis IN ('OBSERVED', 'INFERRED', 'UNKNOWN')),
  limitations_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (from_event_id) REFERENCES propagation_events(id) ON DELETE CASCADE,
  FOREIGN KEY (to_event_id) REFERENCES propagation_events(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS independence_groups (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  name TEXT NOT NULL,
  reason TEXT NOT NULL,
  primary_domain TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS monitoring_jobs (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  target_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED', 'COMPLETED', 'FAILED', 'UNAVAILABLE')),
  schedule_interval_minutes INTEGER DEFAULT 60,
  last_check_at TEXT,
  next_check_at TEXT,
  limitations_json TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  monitoring_job_id TEXT,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'REVIEWED', 'DISMISSED', 'ACKNOWLEDGED')),
  summary TEXT NOT NULL,
  evidence_snapshot_id TEXT,
  limitations_json TEXT,
  acknowledged_at TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (monitoring_job_id) REFERENCES monitoring_jobs(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS evidence_snapshots (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  investigation_id TEXT NOT NULL,
  evidence_snapshot_id TEXT,
  title TEXT NOT NULL,
  report_format TEXT NOT NULL DEFAULT 'HTML' CHECK (report_format IN ('HTML', 'JSON', 'PDF')),
  content_text TEXT NOT NULL,
  evidence_snapshot_hash TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE,
  FOREIGN KEY (evidence_snapshot_id) REFERENCES evidence_snapshots(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS audit_events (
  id TEXT PRIMARY KEY,
  investigation_id TEXT,
  actor TEXT NOT NULL DEFAULT 'SYSTEM',
  action TEXT NOT NULL,
  object_type TEXT NOT NULL,
  object_id TEXT,
  before_state_json TEXT,
  after_state_json TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE SET NULL
);
