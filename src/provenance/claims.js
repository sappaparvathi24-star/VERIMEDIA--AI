// VeriMedia AI — Context & Claim Verification Engine (Phase G & 17)
import { ClaimStatus, EvidencePolarity } from './core.js';
import { isPrivateOrBlockedIP } from '../proxy/requestProxy.js';
import { classifyEntailment } from '../../ml/nlp/entailment.js';
import { groupEvidenceBySemanticIndependence, INDEPENDENCE_TEXT_SIMILARITY_THRESHOLD } from '../../ml/nlp/embeddings.js';

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

/**
 * Synchronous base count of independent evidence groups.
 */
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

/**
 * Asynchronous semantic count of independent evidence groups using embedding similarity.
 * Evidence items exceeding INDEPENDENCE_TEXT_SIMILARITY_THRESHOLD (0.88) collapse to 1 channel.
 */
export async function countIndependentEvidenceGroupsSemantic(store, evidenceIds = [], threshold = INDEPENDENCE_TEXT_SIMILARITY_THRESHOLD) {
  const evList = evidenceIds.map(eid => store.getEvidence(eid)).filter(Boolean);
  if (evList.length === 0) {
    return { groupCount: 0, groups: [], repostCollapses: [] };
  }

  return await groupEvidenceBySemanticIndependence(evList, threshold);
}

/**
 * Assesses a claim against associated evidence.
 * Integrates classifyEntailment for model-driven polarity and embedding-based Sybil/repost collapsing.
 */
export async function assessClaim(store, claimId, options = {}) {
  const claim = store.getClaim(claimId);
  if (!claim) {
    throw new Error(`Claim not found: ${claimId}`);
  }

  // 1. Classify linked evidence with NLI entailment if requested or if polarity is unassigned
  const allLinkedIds = Array.from(new Set([
    ...(claim.evidenceIds || []),
    ...(claim.contradictionIds || []),
    ...(claim.contextualizingIds || [])
  ]));

  const supportingIds = [];
  const contradictingIds = [];
  const neutralIds = [];
  const entailmentAssessments = [];

  for (const eid of allLinkedIds) {
    const ev = store.getEvidence(eid);
    if (!ev) continue;

    const hasExplicitPolarity = ev.polarity === EvidencePolarity.SUPPORTING || ev.polarity === EvidencePolarity.REFUTING;
    const evText = ev.description || ev.metadata?.sourceText || ev.metadata?.caption || ev.title || '';

    if (!hasExplicitPolarity && options.useEntailment !== false && evText && claim.statement) {
      const nliResult = await classifyEntailment(claim.statement, evText);
      entailmentAssessments.push({
        evidenceId: eid,
        polarity: nliResult.polarity,
        confidence: nliResult.confidence,
        label: nliResult.label,
        isFallback: nliResult.isFallback
      });

      // Update evidence polarity if model gave a clear signal
      if (nliResult.polarity === 'SUPPORTING') {
        supportingIds.push(eid);
        ev.polarity = EvidencePolarity.SUPPORTING;
      } else if (nliResult.polarity === 'CONTRADICTING') {
        contradictingIds.push(eid);
        ev.polarity = EvidencePolarity.REFUTING;
      } else {
        neutralIds.push(eid);
        ev.polarity = EvidencePolarity.INCONCLUSIVE;
      }
    } else {
      // Retain existing pre-assigned polarity
      if (ev.polarity === EvidencePolarity.SUPPORTING || (claim.evidenceIds || []).includes(eid)) {
        supportingIds.push(eid);
      } else if (ev.polarity === EvidencePolarity.REFUTING || (claim.contradictionIds || []).includes(eid)) {
        contradictingIds.push(eid);
      } else {
        neutralIds.push(eid);
      }
    }
  }

  // Update claim's mapped IDs
  claim.evidenceIds = Array.from(new Set(supportingIds));
  claim.contradictionIds = Array.from(new Set(contradictingIds));
  claim.contextualizingIds = Array.from(new Set(neutralIds));

  // 2. Semantic Independence Group collapsing for Sybil / Repost Defense
  const supportingGroups = await countIndependentEvidenceGroupsSemantic(store, supportingIds);
  const contradictingGroups = await countIndependentEvidenceGroupsSemantic(store, contradictingIds);

  const limitations = [];
  let status = ClaimStatus.UNASSESSED;
  let confidence = 0.50;

  if (contradictingIds.length > 0 && supportingIds.length > 0) {
    status = ClaimStatus.INCONCLUSIVE;
    confidence = 0.50;
    limitations.push('Conflicting independent evidence observed across sources.');
  } else if (contradictingIds.length > 0) {
    status = ClaimStatus.CONTRADICTED;
    confidence = Math.min(0.92, 0.70 + (contradictingGroups.groupCount * 0.08));
  } else if (supportingIds.length > 0) {
    status = ClaimStatus.SUPPORTED;
    if (supportingGroups.groupCount <= 1) {
      confidence = 0.85; // Capped single-source / single-channel ceiling (§6)
      if (supportingIds.length > 1) {
        limitations.push('Multiple supporting sources share the same independence group or semantic content and do not multiply independent confirmation.');
      }
    } else if (supportingGroups.groupCount === 2) {
      confidence = 0.88;
    } else {
      confidence = 0.94; // Multi-group independent corroboration (3+ distinct independent groups)
    }
  }

  if (supportingGroups.repostCollapses && supportingGroups.repostCollapses.length > 0) {
    limitations.push(`${supportingGroups.repostCollapses.length} reworded or syndicated repost(s) collapsed to single independence channel via semantic embedding similarity.`);
  }

  // Hard clamp output to calibrated band [0.15, 0.95]
  confidence = Number(Math.max(0.15, Math.min(0.95, confidence)).toFixed(2));

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
    repostCollapses: supportingGroups.repostCollapses || [],
    entailmentAssessments,
    limitations,
    assessedAt: new Date().toISOString()
  };
}
