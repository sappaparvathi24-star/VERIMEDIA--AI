-- Migration 003: Finding reviews and extended finding status values
PRAGMA foreign_keys = ON;

-- Human review records for findings (append-only chain)
CREATE TABLE IF NOT EXISTS finding_reviews (
  id TEXT PRIMARY KEY,
  finding_id TEXT NOT NULL,
  investigation_id TEXT NOT NULL,
  reviewer_id TEXT NOT NULL,
  reviewer_email TEXT NOT NULL,
  decision TEXT NOT NULL CHECK (decision IN ('ACCEPT', 'REJECT', 'INCONCLUSIVE', 'REQUEST_FURTHER_INVESTIGATION')),
  rationale TEXT NOT NULL DEFAULT '',
  status_before TEXT NOT NULL,
  status_after TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY (finding_id) REFERENCES findings(id) ON DELETE CASCADE,
  FOREIGN KEY (investigation_id) REFERENCES investigations(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_finding_reviews_finding ON finding_reviews(finding_id);
CREATE INDEX IF NOT EXISTS idx_finding_reviews_inv ON finding_reviews(investigation_id);

-- findings.status CHECK constraint cannot be altered in SQLite; the application layer
-- enforces the extended set. The persistence layer maps unknown values to 'OBSERVED'.
-- New statuses used by the review system: PARTIALLY_SUPPORTED, CONTRADICTED, UNKNOWN,
-- UNASSESSED, RESOLVED (stored as text; SQLite does not enforce the old CHECK on updates
-- via ON CONFLICT DO UPDATE when the value is already present).
