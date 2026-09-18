// VeriMedia AI — Wayback Machine (archive.org) Provider (Phase 15)
import { searchArchiveOrg } from '../../proxy/searchProxy.js';

export class ArchiveOrgDiscoveryProvider {
  constructor(config = {}) {
    this.id = 'archiveOrg';
    this.name = 'Wayback Machine (archive.org)';
    this.kind = 'EXTERNAL_API';
    this.authRequired = false;
  }

  isConfigured() {
    return true;
  }

  status() {
    return {
      status: 'AVAILABLE',
      reason: null
    };
  }

  async search(signals, opts = {}) {
    const targetUrl = typeof signals === 'string' ? signals : signals?.url || signals?.query || signals?.[0]?.term;
    if (!targetUrl || !targetUrl.startsWith('http')) {
      return {
        providerId: this.id,
        status: 'SKIPPED',
        reason: 'Wayback search requires a valid URL target',
        candidates: []
      };
    }

    try {
      const rawSnapshots = await searchArchiveOrg(targetUrl);
      const candidates = rawSnapshots.map(snap => ({
        url: snap.archivedUrl,
        originalUrl: snap.originalUrl,
        title: `Wayback Snapshot: ${snap.originalUrl} (${snap.timestamp})`,
        platform: 'Wayback Machine',
        author: 'Internet Archive',
        sourceType: 'EXTERNAL_API_VERIFIED',
        publishedAt: snap.publishedAt,
        timestampType: 'PUBLICATION_OBSERVED',
        timestampQuality: 'HIGH',
        retrievedAt: new Date().toISOString(),
        mimeType: snap.mimeType,
        statusCode: snap.statusCode,
        digest: snap.digest,
        similarityStatus: 'TEXT_MATCH_ONLY',
        metadata: {
          snapshotTimestamp: snap.timestamp,
          archiveDigest: snap.digest
        }
      }));

      return {
        providerId: this.id,
        status: 'AVAILABLE',
        count: candidates.length,
        candidates
      };
    } catch (err) {
      return {
        providerId: this.id,
        status: 'ERROR',
        reason: err.message,
        candidates: []
      };
    }
  }
}

export default ArchiveOrgDiscoveryProvider;
