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
}

export const persistence = new SQLitePersistence();
export default persistence;
