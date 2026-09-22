// VeriMedia AI — Content Family Clustering & Anti-Sybil Defense (Phase 17/18)
import { hashSimilarity } from '../forensics/perceptualHash.js';

/**
 * Extracts perceptual hash components (aHash and dHash) from various candidate / event shapes.
 * Handles { hash: { aHash, dHash } }, string hashes, perceptualHash, etc.
 * Returns null if no valid hash data is present.
 */
export function extractMemberHashes(member) {
  if (!member) return null;

  // 1. Direct member.hash as object { aHash, dHash }
  if (member.hash && typeof member.hash === 'object') {
    const a = member.hash.aHash || member.hash.a_hash || member.hash.pHash || null;
    const d = member.hash.dHash || member.hash.d_hash || null;
    if (a || d) {
      return {
        aHash: typeof a === 'string' ? a : (typeof d === 'string' ? d : null),
        dHash: typeof d === 'string' ? d : (typeof a === 'string' ? a : null)
      };
    }
  }

  // 2. Direct aHash / dHash on member
  if (member.aHash || member.dHash) {
    const a = typeof member.aHash === 'string' ? member.aHash : (typeof member.dHash === 'string' ? member.dHash : null);
    const d = typeof member.dHash === 'string' ? member.dHash : (typeof member.aHash === 'string' ? member.aHash : null);
    if (a || d) {
      return { aHash: a || d, dHash: d || a };
    }
  }

  // 3. String hash on member.hash
  if (typeof member.hash === 'string' && member.hash.length >= 16) {
    return { aHash: member.hash, dHash: member.hash };
  }

  // 4. member.perceptualHash or member.perceptualFingerprint
  if (typeof member.perceptualHash === 'string' && member.perceptualHash.length >= 16) {
    return { aHash: member.perceptualHash, dHash: member.perceptualHash };
  }
  if (typeof member.perceptualFingerprint === 'string' && member.perceptualFingerprint.length >= 16) {
    return { aHash: member.perceptualFingerprint, dHash: member.perceptualFingerprint };
  }

  // 5. Check member.metadata
  if (member.metadata && typeof member.metadata === 'object') {
    if (member.metadata.hash) {
      const extracted = extractMemberHashes({ hash: member.metadata.hash });
      if (extracted) return extracted;
    }
    if (member.metadata.aHash || member.metadata.dHash) {
      const a = typeof member.metadata.aHash === 'string' ? member.metadata.aHash : null;
      const d = typeof member.metadata.dHash === 'string' ? member.metadata.dHash : null;
      if (a || d) {
        return { aHash: a || d, dHash: d || a };
      }
    }
    if (typeof member.metadata.perceptualHash === 'string' && member.metadata.perceptualHash.length >= 16) {
      return { aHash: member.metadata.perceptualHash, dHash: member.metadata.perceptualHash };
    }
    if (typeof member.metadata.pHash === 'string' && member.metadata.pHash.length >= 16) {
      return { aHash: member.metadata.pHash, dHash: member.metadata.pHash };
    }
  }

  return null;
}

/**
 * Computes fused perceptual similarity between two members.
 * Fuses aHash (0.6) and dHash (0.4) using hashSimilarity (Hamming distance normalized to [0, 1]).
 * If one hash type is absent, uses the available one.
 * Returns 0.0 if either member lacks a valid hash.
 */
export function computeMemberSimilarity(memberA, memberB) {
  const hA = extractMemberHashes(memberA);
  const hB = extractMemberHashes(memberB);
  if (!hA || !hB) return 0.0;

  const simA = (hA.aHash && hB.aHash) ? hashSimilarity(hA.aHash, hB.aHash) : null;
  const simD = (hA.dHash && hB.dHash) ? hashSimilarity(hA.dHash, hB.dHash) : null;

  if (simA !== null && simD !== null) {
    return Number((0.6 * simA + 0.4 * simD).toFixed(4));
  }
  if (simA !== null) return simA;
  if (simD !== null) return simD;
  return 0.0;
}

/**
 * Deterministically generates a content family ID from the representative's hash components.
 * If no hash is available, produces a deterministic unhashed identifier.
 */
export function generateFamilyId(representative) {
  const h = extractMemberHashes(representative);
  if (h && (h.aHash || h.dHash)) {
    const a = (h.aHash || h.dHash || '').toLowerCase().padEnd(16, '0');
    const d = (h.dHash || h.aHash || '').toLowerCase().padEnd(16, '0');
    return `CF-${a.slice(0, 8)}${d.slice(0, 8)}`.toUpperCase();
  }
  return `CF-UNHASHED-${representative.id || 'ANON'}`;
}

/**
 * Groups members into Content Families using single-linkage clustering.
 *
 * @param {Array<Object>} members - Items to cluster: { id, hash, ... }
 * @param {Object} [options]
 * @param {number} [options.threshold=0.88] - Fused similarity threshold for linking members
 * @returns {Array<Object>} Array of families:
 *   { familyId, representativeId, memberIds, appearanceCount, distinctSourceCount, earliestAt, latestAt }
 */
export function groupIntoContentFamilies(members = [], { threshold = 0.88 } = {}) {
  if (!Array.isArray(members) || members.length === 0) {
    return [];
  }

  const n = members.length;
  // Disjoint Set Union (Union-Find) initialization
  const parent = new Array(n).fill(0).map((_, i) => i);
  const rank = new Array(n).fill(0);

  function find(i) {
    let root = i;
    while (root !== parent[root]) {
      root = parent[root];
    }
    let curr = i;
    while (curr !== root) {
      const next = parent[curr];
      parent[curr] = root;
      curr = next;
    }
    return root;
  }

  function union(i, j) {
    const rootI = find(i);
    const rootJ = find(j);
    if (rootI === rootJ) return;

    if (rank[rootI] < rank[rootJ]) {
      parent[rootI] = rootJ;
    } else if (rank[rootI] > rank[rootJ]) {
      parent[rootJ] = rootI;
    } else {
      parent[rootJ] = rootI;
      rank[rootI] += 1;
    }
  }

  // Pre-extract hashes to avoid repeated parsing
  const parsedHashes = members.map(m => extractMemberHashes(m));

  // Single-linkage clustering:
  // Connect member i and member j if both have valid hashes and fused similarity >= threshold
  for (let i = 0; i < n; i++) {
    if (!parsedHashes[i]) continue; // Members without hashes cannot be linked to others
    for (let j = i + 1; j < n; j++) {
      if (!parsedHashes[j]) continue;
      const sim = computeMemberSimilarity(members[i], members[j]);
      if (sim >= threshold) {
        union(i, j);
      }
    }
  }

  // Group member indices by root component
  const componentMap = new Map();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!componentMap.has(root)) {
      componentMap.set(root, []);
    }
    componentMap.get(root).push(members[i]);
  }

  const families = [];

  for (const clusterMembers of componentMap.values()) {
    // Sort cluster members to pick a consistent, deterministic representative
    clusterMembers.sort((a, b) => {
      // 1. Members with hashes prioritized over unhashed
      const hasHA = Boolean(extractMemberHashes(a));
      const hasHB = Boolean(extractMemberHashes(b));
      if (hasHA && !hasHB) return -1;
      if (!hasHA && hasHB) return 1;

      // 2. Earliest timestamp
      const timeA = a.publishedAt || a.observedAt || a.createdAt || a.timestamp || null;
      const timeB = b.publishedAt || b.observedAt || b.createdAt || b.timestamp || null;
      if (timeA && timeB && timeA !== timeB) {
        return new Date(timeA).getTime() - new Date(timeB).getTime();
      }
      if (timeA && !timeB) return -1;
      if (!timeA && timeB) return 1;

      // 3. Deterministic hash/id comparison
      const hA = extractMemberHashes(a);
      const hB = extractMemberHashes(b);
      const hashStrA = hA ? `${hA.aHash}_${hA.dHash}` : '';
      const hashStrB = hB ? `${hB.aHash}_${hB.dHash}` : '';
      if (hashStrA !== hashStrB) {
        return hashStrA.localeCompare(hashStrB);
      }

      return String(a.id || '').localeCompare(String(b.id || ''));
    });

    const representative = clusterMembers[0];
    const representativeId = representative.id;
    const memberIds = clusterMembers.map(m => m.id);
    const appearanceCount = memberIds.length;

    // Calculate distinct sources
    const distinctSources = new Set();
    clusterMembers.forEach(m => {
      const src = m.sourceId || m.source || m.platform || m.domain || m.url || m.id;
      if (src) distinctSources.add(src);
    });
    const distinctSourceCount = Math.max(1, distinctSources.size);

    // Calculate earliest and latest timestamps
    const timestamps = clusterMembers
      .map(m => m.publishedAt || m.observedAt || m.createdAt || m.timestamp || null)
      .filter(Boolean);

    let earliestAt = null;
    let latestAt = null;
    if (timestamps.length > 0) {
      const sortedDates = timestamps.map(t => new Date(t)).sort((d1, d2) => d1.getTime() - d2.getTime());
      earliestAt = sortedDates[0].toISOString();
      latestAt = sortedDates[sortedDates.length - 1].toISOString();
    }

    const familyId = generateFamilyId(representative);

    families.push({
      familyId,
      representativeId,
      memberIds,
      appearanceCount,
      distinctSourceCount,
      earliestAt,
      latestAt
    });
  }

  // Sort families deterministically by familyId
  families.sort((f1, f2) => f1.familyId.localeCompare(f2.familyId));

  return families;
}
