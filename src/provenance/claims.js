// VeriMedia AI — Context & Claim Verification Engine (Phase G & 17)
import { ClaimStatus, EvidencePolarity } from './core.js';
import { isPrivateOrBlockedIP } from '../proxy/requestProxy.js';

export function validateSourceUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('URL must be a non-empty string');
  }
  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch (err) {
    throw new Error(`Invalid URL format: ${err.message}`);
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are permitted');
  }
  if (isPrivateOrBlockedIP(parsed.hostname)) {
    throw new Error('Target IP or hostname is restricted, local, or private');
  }
  return { valid: true, url: parsed.href };
}

export function decomposeClaim(statement) {
  if (!statement || typeof statement !== 'string') {
    return [];
  }
  return statement
    .split(/(?:;|\. |\band\b|\bwhile\b|\bwhereas\b)/i)
    .map(s => s.trim())
    .filter(s => s.length > 5);
}

export function countIndependentEvidenceGroups(store, evidenceIds = []) {
  const groupsMap = new Map();

  for (const eid of evidenceIds) {
    const ev = store.getEvidence(eid);
    if (!ev) continue;

    const groupId = ev.independenceGroupId || `IG-DEFAULT-${ev.id}`;
    if (!groupsMap.has(groupId)) {
      groupsMap.set(groupId, {
        groupId,
        count: 0,
        evidenceIds: []
      });
    }
    const grp = groupsMap.get(groupId);
    grp.count += 1;
    grp.evidenceIds.push(eid);
  }

  const groups = Array.from(groupsMap.values());
  return {
    groupCount: groups.length,
    groups
  };
}

export function assessClaim(store, claimId, options = {}) {
  const claim = store.getClaim(claimId);
  if (!claim) {
    throw new Error(`Claim not found: ${claimId}`);
  }

  const supportingIds = claim.evidenceIds || [];
  const contradictingIds = claim.contradictionIds || [];

  const supportingGroups = countIndependentEvidenceGroups(store, supportingIds);
  const contradictingGroups = countIndependentEvidenceGroups(store, contradictingIds);

  const limitations = [];
  let status = ClaimStatus.UNASSESSED;
  let confidence = 0.50;

  if (contradictingIds.length > 0 && supportingIds.length > 0) {
    status = ClaimStatus.INCONCLUSIVE;
    confidence = 0.50;
    limitations.push('Conflicting independent evidence observed across sources.');
  } else if (contradictingIds.length > 0) {
    status = ClaimStatus.CONTRADICTED;
    confidence = Math.min(0.95, 0.70 + (contradictingGroups.groupCount * 0.08));
  } else if (supportingIds.length > 0) {
    status = ClaimStatus.SUPPORTED;
    if (supportingGroups.groupCount <= 1) {
      confidence = 0.85; // Capped single-source / single-channel ceiling
      if (supportingIds.length > 1) {
        limitations.push('Multiple supporting sources share the same independence group and do not multiply independent confirmation.');
      }
    } else if (supportingGroups.groupCount === 2) {
      confidence = 0.90;
    } else {
      confidence = 0.94; // Multi-group independent corroboration
    }
  }

  // Update claim in store
  claim.status = status;
  claim.confidence = confidence;

  return {
    claim,
    status,
    confidence,
    independentGroupCount: supportingGroups.groupCount,
    supportingGroups: supportingGroups.groups,
    contradictingGroups: contradictingGroups.groups,
    limitations,
    assessedAt: new Date().toISOString()
  };
}
