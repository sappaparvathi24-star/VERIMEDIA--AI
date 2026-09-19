// VeriMedia AI — Supabase Persistence Engine
// Supports async hydrateAll() and snapshotAll() across all 19 entity models.
import { supabaseAdmin, isSupabaseConfigured } from './supabaseClient.js';

export class PersistenceManager {
  constructor() {
    this.isConfigured = isSupabaseConfigured;
    this.isHydrated = false;
    this.inMemoryStore = new Map();
  }

  // ---------------------------------------------------------------------------
  // Full Async Hydration of all 19 entity collections
  // ---------------------------------------------------------------------------
  async hydrateAll(store) {
    if (!store) return;
    if (!this.isConfigured || !supabaseAdmin) {
      this.isHydrated = true;
      return;
    }

    try {
      // 1. Investigations
      const { data: invRows } = await supabaseAdmin.from('investigations').select('*');
      if (invRows && invRows.length > 0) {
        for (const r of invRows) {
          store.investigations.set(r.id, {
            id: r.id,
            orgId: r.org_id,
            title: r.title,
            description: r.description,
            status: r.status,
            leadInvestigator: r.lead_investigator,
            isDemo: Boolean(r.is_demo),
            forensicConfidence: r.forensic_confidence ? Number(r.forensic_confidence) : null,
            provenanceConfidence: r.provenance_confidence ? Number(r.provenance_confidence) : null,
            earliestObservedAppearanceId: r.earliest_observed_appearance_id,
            metadata: r.metadata_json || {},
            limitations: r.limitations_json || [],
            createdAt: r.created_at,
            updatedAt: r.updated_at
          });
        }
      }

      // 2. Media Artifacts
      const { data: artRows } = await supabaseAdmin.from('media_artifacts').select('*');
      if (artRows && artRows.length > 0) {
        for (const r of artRows) {
          store.artifacts.set(r.id, {
            id: r.id,
            investigationId: r.investigation_id,
            filename: r.filename,
            byteSize: Number(r.byte_size || 0),
            mimeType: r.mime_type,
            sha256: r.sha256,
            phash: r.phash,
            acquisitionMethod: r.acquisition_method,
            isPrimary: Boolean(r.is_primary),
            isDemo: Boolean(r.is_demo),
            metadata: r.metadata_json || {},
            limitations: r.limitations_json || [],
            createdAt: r.created_at,
            updatedAt: r.updated_at
          });
        }
      }

      // Helper for JSONB tables
      const genericTables = [
        { table: 'analysis_runs', map: store.analysisRuns },
        { table: 'observations', map: store.observations },
        { table: 'evidence', map: store.evidence },
        { table: 'findings', map: store.findings },
        { table: 'sources', map: store.sources },
        { table: 'appearances', map: store.appearances },
        { table: 'media_versions', map: store.versions },
        { table: 'artifact_relationships', map: store.relationships },
        { table: 'claims', map: store.claims },
        { table: 'discovery_jobs', map: store.discoveryJobs },
        { table: 'discovery_candidates', map: store.discoveryCandidates },
        { table: 'transformations', map: store.transformations },
        { table: 'propagation_events', map: store.propagationEvents },
        { table: 'propagation_relationships', map: store.propagationRelationships },
        { table: 'monitoring_jobs', map: store.monitoringJobs },
        { table: 'alerts', map: store.alerts },
        { table: 'report_audit_records', map: store.reportAuditRecords }
      ];

      await Promise.all(
        genericTables.map(async ({ table, map }) => {
          if (!map) return;
          const { data, error } = await supabaseAdmin.from(table).select('*');
          if (!error && data && data.length > 0) {
            for (const item of data) {
              map.set(item.id, item.data || item);
            }
          }
        })
      );

      this.isHydrated = true;
      console.log('⚡ [Persistence] Successfully hydrated store from Supabase PostgreSQL.');
    } catch (err) {
      console.warn('[Persistence] Hydration warning:', err.message);
      this.isHydrated = true;
    }
  }

  // ---------------------------------------------------------------------------
  // Full Async Snapshotting of all 19 entity collections to Supabase
  // ---------------------------------------------------------------------------
  async snapshotAll(store) {
    if (!store || !this.isConfigured || !supabaseAdmin) return;

    try {
      // 1. Investigations
      const invRecords = Array.from(store.investigations.values()).map(inv => ({
        id: inv.id,
        org_id: inv.orgId || null,
        title: inv.title || 'Untitled Investigation',
        description: inv.description || '',
        status: inv.status || 'ACTIVE',
        lead_investigator: inv.leadInvestigator || 'ANALYST',
        is_demo: Boolean(inv.isDemo),
        forensic_confidence: inv.forensicConfidence || null,
        provenance_confidence: inv.provenanceConfidence || null,
        earliest_observed_appearance_id: inv.earliestObservedAppearanceId || null,
        metadata_json: inv.metadata || {},
        limitations_json: inv.limitations || [],
        created_at: inv.createdAt || new Date().toISOString(),
        updated_at: inv.updatedAt || new Date().toISOString()
      }));

      if (invRecords.length > 0) {
        await supabaseAdmin.from('investigations').upsert(invRecords, { onConflict: 'id' });
      }

      // 2. Media Artifacts
      const artRecords = Array.from(store.artifacts.values()).map(art => ({
        id: art.id,
        investigation_id: art.investigationId || null,
        filename: art.filename || '',
        byte_size: art.byteSize || 0,
        mime_type: art.mimeType || 'application/octet-stream',
        sha256: art.sha256,
        phash: art.phash || null,
        acquisition_method: art.acquisitionMethod || 'DIRECT_UPLOAD',
        is_primary: Boolean(art.isPrimary),
        is_demo: Boolean(art.isDemo),
        metadata_json: art.metadata || {},
        limitations_json: art.limitations || [],
        created_at: art.createdAt || new Date().toISOString(),
        updated_at: art.updatedAt || new Date().toISOString()
      }));

      if (artRecords.length > 0) {
        await supabaseAdmin.from('media_artifacts').upsert(artRecords, { onConflict: 'id' });
      }

      // Generic JSONB tables
      const genericTables = [
        { table: 'analysis_runs', map: store.analysisRuns },
        { table: 'observations', map: store.observations },
        { table: 'evidence', map: store.evidence },
        { table: 'findings', map: store.findings },
        { table: 'sources', map: store.sources },
        { table: 'appearances', map: store.appearances },
        { table: 'media_versions', map: store.versions },
        { table: 'artifact_relationships', map: store.relationships },
        { table: 'claims', map: store.claims },
        { table: 'discovery_jobs', map: store.discoveryJobs },
        { table: 'discovery_candidates', map: store.discoveryCandidates },
        { table: 'transformations', map: store.transformations },
        { table: 'propagation_events', map: store.propagationEvents },
        { table: 'propagation_relationships', map: store.propagationRelationships },
        { table: 'monitoring_jobs', map: store.monitoringJobs },
        { table: 'alerts', map: store.alerts },
        { table: 'report_audit_records', map: store.reportAuditRecords }
      ];

      for (const { table, map } of genericTables) {
        if (!map || map.size === 0) continue;
        const rows = Array.from(map.values()).map(item => ({
          id: item.id,
          investigation_id: item.investigationId || item.targetInvestigationId || null,
          data: item,
          updated_at: item.updatedAt || new Date().toISOString()
        }));
        await supabaseAdmin.from(table).upsert(rows, { onConflict: 'id' });
      }
    } catch (err) {
      console.error('[Persistence] Snapshot error:', err.message);
    }
  }

  // ---------------------------------------------------------------------------
  // Backwards compatibility helper methods
  // ---------------------------------------------------------------------------
  saveInvestigation(inv) {
    if (!inv || !inv.id) return;
    this.inMemoryStore.set(`inv_${inv.id}`, inv);
  }

  loadInvestigations() {
    return Array.from(this.inMemoryStore.values()).filter(x => x.id?.startsWith('INV-'));
  }

  saveArtifact(art) {
    if (!art || !art.id) return;
    this.inMemoryStore.set(`art_${art.id}`, art);
  }

  loadArtifacts() {
    return Array.from(this.inMemoryStore.values()).filter(x => x.id?.startsWith('ART-'));
  }

  saveAnalysisRun(run) { if (run?.id) this.inMemoryStore.set(`run_${run.id}`, run); }
  loadAnalysisRuns() { return Array.from(this.inMemoryStore.values()).filter(x => x.id?.startsWith('RUN-')); }

  saveObservation(obs) { if (obs?.id) this.inMemoryStore.set(`obs_${obs.id}`, obs); }
  loadObservations() { return Array.from(this.inMemoryStore.values()).filter(x => x.id?.startsWith('OBS-')); }

  saveEvidence(ev) { if (ev?.id) this.inMemoryStore.set(`ev_${ev.id}`, ev); }
  loadEvidence() { return Array.from(this.inMemoryStore.values()).filter(x => x.id?.startsWith('EVD-')); }

  saveFinding(fnd) { if (fnd?.id) this.inMemoryStore.set(`fnd_${fnd.id}`, fnd); }
  loadFindings() { return Array.from(this.inMemoryStore.values()).filter(x => x.id?.startsWith('FND-')); }
}

export const persistence = new PersistenceManager();
export default persistence;
