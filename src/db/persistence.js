// VeriMedia AI — SQLite Persistence Layer
import { getDatabase } from './database.js';

export class SQLitePersistence {
  constructor() {
    this.db = getDatabase();
  }

  // Save investigation
  saveInvestigation(inv) {
    if (!inv || !inv.id) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO investigations (
          id, title, description, status, lead_investigator, is_demo,
          forensic_confidence, provenance_confidence, earliest_observed_appearance_id,
          metadata_json, limitations_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title,
          description=excluded.description,
          status=excluded.status,
          lead_investigator=excluded.lead_investigator,
          is_demo=excluded.is_demo,
          forensic_confidence=excluded.forensic_confidence,
          provenance_confidence=excluded.provenance_confidence,
          earliest_observed_appearance_id=excluded.earliest_observed_appearance_id,
          metadata_json=excluded.metadata_json,
          limitations_json=excluded.limitations_json,
          updated_at=excluded.updated_at
      `);
      stmt.run(
        inv.id,
        inv.title || 'Untitled Investigation',
        inv.description || '',
        inv.status || 'ACTIVE',
        inv.leadInvestigator || 'ANALYST',
        inv.isDemo ? 1 : 0,
        inv.forensicConfidence || null,
        inv.provenanceConfidence || null,
        inv.earliestObservedAppearanceId || null,
        JSON.stringify(inv.metadata || {}),
        JSON.stringify(inv.limitations || []),
        inv.createdAt || new Date().toISOString(),
        inv.updatedAt || new Date().toISOString()
      );
    } catch (err) {
      console.error('[SQLitePersistence] Error saving investigation:', err.message);
    }
  }

  // Load all investigations
  loadInvestigations() {
    try {
      const rows = this.db.prepare('SELECT * FROM investigations').all();
      return rows.map(r => ({
        id: r.id,
        title: r.title,
        description: r.description,
        status: r.status,
        leadInvestigator: r.lead_investigator,
        isDemo: Boolean(r.is_demo),
        forensicConfidence: r.forensic_confidence,
        provenanceConfidence: r.provenance_confidence,
        earliestObservedAppearanceId: r.earliest_observed_appearance_id,
        metadata: r.metadata_json ? JSON.parse(r.metadata_json) : {},
        limitations: r.limitations_json ? JSON.parse(r.limitations_json) : [],
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch (err) {
      console.error('[SQLitePersistence] Error loading investigations:', err.message);
      return [];
    }
  }

  // Save artifact
  saveArtifact(art) {
    if (!art || !art.id) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO media_artifacts (
          id, investigation_id, filename, byte_size, mime_type, sha256, phash,
          acquisition_method, is_primary, is_demo, metadata_json, limitations_json,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          filename=excluded.filename,
          byte_size=excluded.byte_size,
          mime_type=excluded.mime_type,
          sha256=excluded.sha256,
          phash=excluded.phash,
          metadata_json=excluded.metadata_json,
          updated_at=excluded.updated_at
      `);
      stmt.run(
        art.id,
        art.investigationId,
        art.filename || '',
        art.byteSize || 0,
        art.mimeType || 'application/octet-stream',
        art.sha256,
        art.perceptualHash || art.pHash || null,
        art.acquisitionMethod || 'UPLOAD',
        art.isReference ? 1 : 0,
        art.isDemo ? 1 : 0,
        JSON.stringify(art.metadata || {}),
        JSON.stringify(art.limitations || []),
        art.createdAt || new Date().toISOString(),
        art.updatedAt || new Date().toISOString()
      );
    } catch (err) {
      console.error('[SQLitePersistence] Error saving artifact:', err.message);
    }
  }

  // Load all artifacts
  loadArtifacts() {
    try {
      const rows = this.db.prepare('SELECT * FROM media_artifacts').all();
      return rows.map(r => ({
        id: r.id,
        investigationId: r.investigation_id,
        filename: r.filename,
        byteSize: r.byte_size,
        mimeType: r.mime_type,
        sha256: r.sha256,
        perceptualHash: r.phash,
        acquisitionMethod: r.acquisition_method,
        isReference: Boolean(r.is_primary),
        isDemo: Boolean(r.is_demo),
        metadata: r.metadata_json ? JSON.parse(r.metadata_json) : {},
        limitations: r.limitations_json ? JSON.parse(r.limitations_json) : [],
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch (err) {
      console.error('[SQLitePersistence] Error loading artifacts:', err.message);
      return [];
    }
  }

  // Save analysis run
  saveAnalysisRun(run) {
    if (!run || !run.id) return;
    try {
      const invId = run.investigationId || 'INV-SYSTEM';
      const invExists = this.db.prepare('SELECT id FROM investigations WHERE id = ?').get(invId);
      if (!invExists) {
        this.saveInvestigation({ id: invId, title: 'System Analysis Runs', status: 'ACTIVE', isDemo: run.isDemo });
      }

      const stmt = this.db.prepare(`
        INSERT INTO analysis_runs (
          id, investigation_id, artifact_id, method_name, method_version,
          parameters_json, start_time, end_time, status, error_message, is_demo,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          status=excluded.status,
          end_time=excluded.end_time,
          error_message=excluded.error_message,
          updated_at=excluded.updated_at
      `);
      stmt.run(
        run.id,
        invId,
        run.artifactId || null,
        run.method || 'DEFAULT_ANALYSIS',
        run.methodVersion || '1.0.0',
        JSON.stringify(run.parameters || run.metadata || {}),
        run.startedAt || new Date().toISOString(),
        run.completedAt || null,
        run.status || 'COMPLETED',
        run.errorMessage || null,
        run.isDemo ? 1 : 0,
        run.createdAt || new Date().toISOString(),
        run.updatedAt || new Date().toISOString()
      );
    } catch (err) {
      console.error('[SQLitePersistence] Error saving analysis run:', err.message);
    }
  }

  // Load all analysis runs
  loadAnalysisRuns() {
    try {
      const rows = this.db.prepare('SELECT * FROM analysis_runs').all();
      return rows.map(r => ({
        id: r.id,
        investigationId: r.investigation_id,
        artifactId: r.artifact_id,
        method: r.method_name,
        methodVersion: r.method_version,
        parameters: r.parameters_json ? JSON.parse(r.parameters_json) : {},
        startedAt: r.start_time,
        completedAt: r.end_time,
        status: r.status,
        errorMessage: r.error_message,
        isDemo: Boolean(r.is_demo),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch (err) {
      console.error('[SQLitePersistence] Error loading analysis runs:', err.message);
      return [];
    }
  }

  // Save observation
  saveObservation(obs) {
    if (!obs || !obs.id) return;
    try {
      const invId = obs.investigationId || 'INV-SYSTEM';
      const invExists = this.db.prepare('SELECT id FROM investigations WHERE id = ?').get(invId);
      if (!invExists) {
        this.saveInvestigation({ id: invId, title: 'System Observations', status: 'ACTIVE', isDemo: obs.isDemo });
      }

      const stmt = this.db.prepare(`
        INSERT INTO observations (
          id, investigation_id, analysis_run_id, artifact_id, observation_type,
          target_field, value_json, unit, confidence_score, confidence_band,
          limitations_json, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          target_field=excluded.target_field,
          value_json=excluded.value_json,
          confidence_score=excluded.confidence_score,
          confidence_band=excluded.confidence_band,
          limitations_json=excluded.limitations_json,
          updated_at=excluded.updated_at
      `);
      stmt.run(
        obs.id,
        invId,
        obs.runId || null,
        obs.artifactId || null,
        obs.observationType || 'GENERIC_OBSERVATION',
        obs.target || obs.targetField || null,
        JSON.stringify(obs.value !== undefined ? obs.value : null),
        obs.unit || null,
        obs.confidence !== undefined ? obs.confidence : 1.0,
        obs.confidenceBand || null,
        JSON.stringify(obs.limitations || []),
        obs.isDemo ? 1 : 0,
        obs.timestamp || obs.createdAt || new Date().toISOString(),
        obs.updatedAt || new Date().toISOString()
      );
    } catch (err) {
      console.error('[SQLitePersistence] Error saving observation:', err.message);
    }
  }

  // Load all observations
  loadObservations() {
    try {
      const rows = this.db.prepare('SELECT * FROM observations').all();
      return rows.map(r => ({
        id: r.id,
        investigationId: r.investigation_id,
        runId: r.analysis_run_id,
        artifactId: r.artifact_id,
        observationType: r.observation_type,
        target: r.target_field,
        value: r.value_json ? JSON.parse(r.value_json) : null,
        unit: r.unit,
        confidence: r.confidence_score,
        confidenceBand: r.confidence_band,
        limitations: r.limitations_json ? JSON.parse(r.limitations_json) : [],
        isDemo: Boolean(r.is_demo),
        timestamp: r.created_at,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch (err) {
      console.error('[SQLitePersistence] Error loading observations:', err.message);
      return [];
    }
  }

  // Save evidence
  saveEvidence(ev) {
    if (!ev || !ev.id) return;
    try {
      const invId = ev.investigationId || 'INV-SYSTEM';
      const invExists = this.db.prepare('SELECT id FROM investigations WHERE id = ?').get(invId);
      if (!invExists) {
        this.saveInvestigation({ id: invId, title: 'System Evidence', status: 'ACTIVE', isDemo: ev.isDemo });
      }

      const stmt = this.db.prepare(`
        INSERT INTO evidence (
          id, investigation_id, title, evidence_type, category, strength_score,
          strength_band, basis_json, limitations_json, is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title,
          strength_score=excluded.strength_score,
          strength_band=excluded.strength_band,
          basis_json=excluded.basis_json,
          limitations_json=excluded.limitations_json,
          updated_at=excluded.updated_at
      `);
      stmt.run(
        ev.id,
        invId,
        ev.title || ev.description || 'Evidence Record',
        ev.evidenceType || 'FORENSIC_SIGNAL',
        ev.category || 'TECHNICAL',
        ev.confidence !== undefined ? ev.confidence : (ev.strengthScore || 1.0),
        ev.strengthBand || null,
        JSON.stringify({
          description: ev.description,
          independenceGroupId: ev.independenceGroupId,
          polarity: ev.polarity,
          verified: ev.verified,
          metadata: ev.metadata || {}
        }),
        JSON.stringify(ev.limitations || []),
        ev.isDemo ? 1 : 0,
        ev.createdAt || new Date().toISOString(),
        ev.updatedAt || new Date().toISOString()
      );

      // Save evidence_observations links
      if (Array.isArray(ev.observationIds) && ev.observationIds.length > 0) {
        const linkStmt = this.db.prepare(`
          INSERT OR IGNORE INTO evidence_observations (evidence_id, observation_id)
          VALUES (?, ?)
        `);
        for (const obsId of ev.observationIds) {
          try {
            linkStmt.run(ev.id, obsId);
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('[SQLitePersistence] Error saving evidence:', err.message);
    }
  }

  // Load all evidence
  loadEvidence() {
    try {
      const rows = this.db.prepare('SELECT * FROM evidence').all();
      const linkRows = this.db.prepare('SELECT * FROM evidence_observations').all();
      const obsMap = new Map();
      for (const link of linkRows) {
        if (!obsMap.has(link.evidence_id)) {
          obsMap.set(link.evidence_id, []);
        }
        obsMap.get(link.evidence_id).push(link.observation_id);
      }

      return rows.map(r => {
        const basis = r.basis_json ? JSON.parse(r.basis_json) : {};
        return {
          id: r.id,
          investigationId: r.investigation_id,
          title: r.title,
          description: basis.description || r.title,
          evidenceType: r.evidence_type,
          category: r.category,
          confidence: r.strength_score,
          strengthScore: r.strength_score,
          strengthBand: r.strength_band,
          independenceGroupId: basis.independenceGroupId || `IG-${r.id}`,
          polarity: basis.polarity || 'SUPPORTING',
          verified: basis.verified !== undefined ? basis.verified : true,
          observationIds: obsMap.get(r.id) || [],
          limitations: r.limitations_json ? JSON.parse(r.limitations_json) : [],
          isDemo: Boolean(r.is_demo),
          metadata: basis.metadata || {},
          createdAt: r.created_at,
          updatedAt: r.updated_at
        };
      });
    } catch (err) {
      console.error('[SQLitePersistence] Error loading evidence:', err.message);
      return [];
    }
  }

  // Save finding
  saveFinding(fnd) {
    if (!fnd || !fnd.id) return;
    try {
      const invId = fnd.investigationId || 'INV-SYSTEM';
      const invExists = this.db.prepare('SELECT id FROM investigations WHERE id = ?').get(invId);
      if (!invExists) {
        this.saveInvestigation({ id: invId, title: 'System Findings', status: 'ACTIVE', isDemo: fnd.isDemo });
      }

      const stmt = this.db.prepare(`
        INSERT INTO findings (
          id, investigation_id, title, statement, category, status,
          confidence_score, confidence_band, basis_json, limitations_json,
          is_demo, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          title=excluded.title,
          statement=excluded.statement,
          status=excluded.status,
          confidence_score=excluded.confidence_score,
          confidence_band=excluded.confidence_band,
          basis_json=excluded.basis_json,
          limitations_json=excluded.limitations_json,
          updated_at=excluded.updated_at
      `);
      stmt.run(
        fnd.id,
        invId,
        fnd.title || 'Forensic Finding',
        fnd.summary || fnd.statement || fnd.title || '',
        fnd.category || 'PROVENANCE',
        fnd.status || 'OBSERVED',
        fnd.confidence !== undefined ? fnd.confidence : 0.85,
        fnd.confidenceBand || null,
        JSON.stringify(fnd.metadata || {}),
        JSON.stringify(fnd.limitations || []),
        fnd.isDemo ? 1 : 0,
        fnd.createdAt || new Date().toISOString(),
        fnd.updatedAt || new Date().toISOString()
      );

      // Save finding_evidence links
      if (Array.isArray(fnd.evidenceIds) && fnd.evidenceIds.length > 0) {
        const linkStmt = this.db.prepare(`
          INSERT OR IGNORE INTO finding_evidence (finding_id, evidence_id, relationship_type)
          VALUES (?, ?, 'SUPPORTS')
        `);
        for (const evId of fnd.evidenceIds) {
          try {
            linkStmt.run(fnd.id, evId);
          } catch (_) {}
        }
      }
    } catch (err) {
      console.error('[SQLitePersistence] Error saving finding:', err.message);
    }
  }

  // Load all findings
  loadFindings() {
    try {
      const rows = this.db.prepare('SELECT * FROM findings').all();
      const linkRows = this.db.prepare('SELECT * FROM finding_evidence').all();
      const evMap = new Map();
      for (const link of linkRows) {
        if (!evMap.has(link.finding_id)) {
          evMap.set(link.finding_id, []);
        }
        evMap.get(link.finding_id).push(link.evidence_id);
      }

      return rows.map(r => ({
        id: r.id,
        investigationId: r.investigation_id,
        title: r.title,
        summary: r.statement,
        statement: r.statement,
        category: r.category,
        status: r.status,
        confidence: r.confidence_score,
        confidenceBand: r.confidence_band,
        evidenceIds: evMap.get(r.id) || [],
        metadata: r.basis_json ? JSON.parse(r.basis_json) : {},
        limitations: r.limitations_json ? JSON.parse(r.limitations_json) : [],
        isDemo: Boolean(r.is_demo),
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
    } catch (err) {
      console.error('[SQLitePersistence] Error loading findings:', err.message);
      return [];
    }
  }

  // Save audit event (12_SECURITY_SPEC.md §10)
  saveAuditEvent(event) {
    if (!event || !event.id) return;
    try {
      const stmt = this.db.prepare(`
        INSERT INTO audit_events (
          id, investigation_id, actor, action, object_type, object_id,
          before_state_json, after_state_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      stmt.run(
        event.id,
        event.investigationId || null,
        event.actor || 'SYSTEM',
        event.action || 'UNKNOWN',
        event.objectType || 'GENERAL',
        event.objectId || null,
        event.beforeState ? JSON.stringify(event.beforeState) : null,
        event.afterState ? JSON.stringify(event.afterState) : null,
        event.createdAt || new Date().toISOString()
      );
    } catch (err) {
      console.error('[SQLitePersistence] Error saving audit event:', err.message);
    }
  }

  // Load audit events with pagination and filters
  loadAuditEvents({ investigationId = null, action = null, objectType = null, limit = 100, offset = 0 } = {}) {
    try {
      let query = 'SELECT * FROM audit_events WHERE 1=1';
      const params = [];

      if (investigationId) {
        query += ' AND investigation_id = ?';
        params.push(investigationId);
      }
      if (action) {
        query += ' AND action = ?';
        params.push(action);
      }
      if (objectType) {
        query += ' AND object_type = ?';
        params.push(objectType);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(limit, offset);

      const rows = this.db.prepare(query).all(...params);
      return rows.map(r => ({
        id: r.id,
        investigationId: r.investigation_id,
        actor: r.actor,
        action: r.action,
        objectType: r.object_type,
        objectId: r.object_id,
        beforeState: r.before_state_json ? JSON.parse(r.before_state_json) : null,
        afterState: r.after_state_json ? JSON.parse(r.after_state_json) : null,
        createdAt: r.created_at
      }));
    } catch (err) {
      console.error('[SQLitePersistence] Error loading audit events:', err.message);
      return [];
    }
  }
}

export const persistence = new SQLitePersistence();
export default persistence;
