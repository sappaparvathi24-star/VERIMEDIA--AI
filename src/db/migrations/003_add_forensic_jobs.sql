-- Migration 003: Ensure forensic_jobs table exists with stage and all required columns
CREATE TABLE IF NOT EXISTS forensic_jobs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER DEFAULT 0,
  stage TEXT,
  investigation_id TEXT,
  artifact_id TEXT,
  filename TEXT,
  mime_type TEXT,
  result TEXT,
  logs TEXT,
  error TEXT,
  created_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_forensic_jobs_artifact ON forensic_jobs(artifact_id);
CREATE INDEX IF NOT EXISTS idx_forensic_jobs_status ON forensic_jobs(status);
