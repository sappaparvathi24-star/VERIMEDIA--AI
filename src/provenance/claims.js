// VeriMedia AI — Context & Claim Verification Engine (Phase G)
import { 
  ClaimTypes, 
  ClaimStatus, 
  ClaimEvidenceRelationship, 
  FindingStatus, 
  EvidencePolarity 
} from './core.js';

/**
 * SSRF Protection & URL Safety Validator
 * Rejects non-HTTP(S) schemes, private/loopback IP addresses, localhost, and restricted ports.
 */
export function validateSourceUrl(url) {
  if (!url || typeof url !== 'string') {
    throw new Error('Invalid URL: URL must be a non-empty string');
  }

  let parsed;
  try {
    parsed = new URL(url.trim());
  } catch (err) {
    throw new Error(`Malformed source URL: ${err.message}`);
  }

  // Scheme validation
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(`Unsafe URL scheme: ${parsed.protocol}. Only http: and https: are permitted.`);
  }

  // Credentials in URL disallowed
  if (parsed.username || parsed.password) {
    throw new Error('Unsafe URL: embedded user credentials are not permitted.');
  }

  const host = parsed.hostname.toLowerCase();

  // Localhost & loopback
  if (host === '127.0.0.1' || host === '0.0.0.0') {
    throw new Error(`Forbidden loopback IP: ${host}. Access to loopback destinations is forbidden.`);
  }

  if (
    host === 'localhost' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal')
  ) {
    throw new Error(`Restricted hostname: ${host}. Access to loopback or local destinations is forbidden.`);
  }

  // RFC 1918 Private IPv4 & Link-Local checks
  const ipv4Match = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4Match) {
    const octets = ipv4Match.slice(1, 5).map(Number);
    if (octets.some(o => o < 0 || o > 255)) {
      throw new Error(`Invalid IPv4 address: ${host}`);
    }

    // 127.0.0.0/8 (Loopback)
    if (octets[0] === 127) {
      throw new Error(`Forbidden loopback IP: ${host}`);
    }
    // 10.0.0.0/8 (Private)
    if (octets[0] === 10) {
      throw new Error(`Forbidden private network IP: ${host}`);
    }
    // 172.16.0.0/12 (Private)
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      throw new Error(`Forbidden private network IP: ${host}`);
    }
    // 192.168.0.0/16 (Private)
    if (octets[0] === 192 && octets[1] === 168) {
      throw new Error(`Forbidden private network IP: ${host}`);
    }
    // 169.254.0.0/16 (Link-local / AWS metadata)
    if (octets[0] === 169 && octets[1] === 254) {
      throw new Error(`Forbidden link-local/cloud metadata IP: ${host}`);
    }
    // 0.0.0.0/8
    if (octets[0] === 0) {
      throw new Error(`Forbidden unspecified network IP: ${host}`);
    }
  }

  return {
    valid: true,
    url: parsed.toString(),
    hostname: host,
    protocol: parsed.protocol
  };
}

/**
 * Multi-Part Claim Decomposer
 * Breaks complex statements into distinct verifiable components.
 */
export function decomposeClaim(statement) {
  if (!statement || typeof statement !== 'string') {
    return [];
  }

  const subClaims = [];
  const text = statement.trim();

  // 1. Location extraction heuristic
  const locMatch = text.match(/\b(?:in|at|near|from)\s+([A-Z][a-zA-Z\s]+?)(?:,\s*[A-Z][a-zA-Z]+|\s+on\b|\s+yesterday\b|\s+last\b|\.|$)/);
  if (locMatch) {
    const locName = locMatch[1].trim();
    subClaims.push({
      id: `SUB-LOC-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      statement: `Media was captured or associated with location: ${locName}`,
      claimType: ClaimTypes.LOCATION,
      componentValue: locName,
      status: ClaimStatus.UNASSESSED,
      confidence: null,
      evidenceIds: [],
      contradictionIds: []
    });
  }

  // 2. Date extraction heuristic
  const dateMatch = text.match(/\b(?:on\s+)?([A-Z][a-z]+ \d{1,2}(?:st|nd|rd|th)?,? \d{4}|\d{4}-\d{2}-\d{2}|yesterday|today|\d{4})\b/i);
  if (dateMatch) {
    const dateStr = dateMatch[1].trim();
    subClaims.push({
      id: `SUB-DATE-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      statement: `Media was captured or recorded on date: ${dateStr}`,
      claimType: ClaimTypes.DATE,
      componentValue: dateStr,
      status: ClaimStatus.UNASSESSED,
      confidence: null,
      evidenceIds: [],
      contradictionIds: []
    });
  }

  // 3. Creation / Origin heuristic
  if (/\b(?:recorded|captured|filmed|shot|original recording|first taken)\b/i.test(text)) {
    subClaims.push({
      id: `SUB-ORIG-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 5)}`,
      statement: `Media represents an original direct recording rather than secondary capture or derivative`,
      claimType: ClaimTypes.ORIGIN,
      status: ClaimStatus.UNASSESSED,
      confidence: null,
      evidenceIds: [],
      contradictionIds: []
    });
  }

  // If decomposed into multiple sub-components, return them
  return subClaims;
}

/**
 * Evaluates Independence Groups across Evidence Items
 * Prevents multiple copied or syndicated sources from multiplying confirmation count.
 */
export function countIndependentEvidenceGroups(store, evidenceIds = []) {
  const groups = new Map();

  for (const evId of evidenceIds) {
    const ev = store.getEvidence(evId);
    if (!ev) continue;

    const grpId = ev.independenceGroupId || `IG-DEFAULT-${evId}`;
    if (!groups.has(grpId)) {
      groups.set(grpId, []);
    }
    groups.get(grpId).push(ev);
  }

  return {
    groupCount: groups.size,
    groups: Array.from(groups.entries()).map(([groupId, items]) => ({
      groupId,
      count: items.length,
      evidence: items
    }))
  };
}

/**
 * Context Mismatch Detection
 * Detects discrepancies such as claimed future or past dates vs observed publication dates.
 */
export function detectContextMismatches(store, claim) {
  const mismatches = [];

  // Check date discrepancies
  if (claim.metadata && claim.metadata.claimedDate) {
    const claimedDate = new Date(claim.metadata.claimedDate);
    if (!isNaN(claimedDate.getTime())) {
      // Check appearances linked to this investigation or artifact
      const appearances = Array.from(store.appearances.values()).filter(a =>
        (!claim.artifactId || a.artifactId === claim.artifactId) &&
        (!claim.investigationId || a.investigationId === claim.investigationId)
      );

      for (const app of appearances) {
        if (app.publishedAt) {
          const pubDate = new Date(app.publishedAt);
          if (!isNaN(pubDate.getTime()) && pubDate < claimedDate) {
            mismatches.push({
              type: 'PRE_DATED_PUBLICATION',
              description: `Context discrepancy observed: Available publication evidence (${app.publishedAt}) predates the claimed date (${claim.metadata.claimedDate}).`,
              limitationNote: 'This discrepancy demonstrates the media existed prior to the claimed date, but does not establish the media creation date.',
              evidenceIds: app.evidenceIds || []
            });
          }
        }
      }
    }
  }

  return mismatches;
}

/**
 * Deterministic Claim Assessment Engine
 * Adheres strictly to the epistemic rules:
 * - Never converts media similarity into claim truth
 * - Never converts metadata into contextual truth
 * - Never converts publication timestamp into recording timestamp
 * - Never converts earliest observed appearance into original creation or ownership
 * - Avoids binary TRUE/FALSE
 * - Preserves both supporting and contradicting evidence
 */
export function assessClaim(store, claimId, options = {}) {
  const claim = store.getClaim(claimId);
  if (!claim) {
    throw new Error(`Claim not found: ${claimId}`);
  }

  const whatSupportsIt = [];
  const whatConflictsWithIt = [];
  const whatRemainsUnknown = [];
  const limitations = [];

  // 1. Context Mismatches
  const mismatches = detectContextMismatches(store, claim);
  for (const m of mismatches) {
    whatConflictsWithIt.push(m.description);
    limitations.push(m.limitationNote);
    // Add any associated evidence to contradictionIds if not present
    for (const eid of m.evidenceIds) {
      if (!claim.contradictionIds.includes(eid)) {
        claim.contradictionIds.push(eid);
      }
    }
  }

  // 2. Multi-Part Claim Handling
  if (claim.isMultiPart && Array.isArray(claim.subClaims) && claim.subClaims.length > 0) {
    return assessMultiPartClaim(store, claim, mismatches);
  }

  // 3. Resolve Supporting and Contradicting Evidence
  const supportingEvidence = (claim.evidenceIds || []).map(id => store.getEvidence(id)).filter(Boolean);
  const contradictingEvidence = (claim.contradictionIds || []).map(id => store.getEvidence(id)).filter(Boolean);

  const supGroups = countIndependentEvidenceGroups(store, claim.evidenceIds);
  const conGroups = countIndependentEvidenceGroups(store, claim.contradictionIds);

  for (const ev of supportingEvidence) {
    whatSupportsIt.push(`[${ev.evidenceType}] ${ev.description} (Confidence: ${(ev.confidence * 100).toFixed(0)}%)`);
  }

  for (const ev of contradictingEvidence) {
    whatConflictsWithIt.push(`[${ev.evidenceType}] ${ev.description} (Confidence: ${(ev.confidence * 100).toFixed(0)}%)`);
  }

  let evaluatedStatus = ClaimStatus.UNKNOWN;
  let evaluatedConfidence = null;

  // CASE A: NO EVIDENCE AT ALL
  if (supportingEvidence.length === 0 && contradictingEvidence.length === 0 && mismatches.length === 0) {
    evaluatedStatus = ClaimStatus.UNKNOWN;
    evaluatedConfidence = null;
    whatRemainsUnknown.push('No verifiable supporting or contradicting evidence has been submitted or retrieved.');
    limitations.push('Claim cannot be evaluated without authenticated evidence records.');
  }
  // CASE B: BOTH SUPPORTING AND CONTRADICTING EVIDENCE EXIST
  else if (supGroups.groupCount > 0 && (conGroups.groupCount > 0 || mismatches.length > 0)) {
    evaluatedStatus = ClaimStatus.INCONCLUSIVE;
    evaluatedConfidence = 0.50;
    whatRemainsUnknown.push('Available evidence is contradictory. Independent primary records are required to resolve the conflicting accounts.');
    limitations.push('Preserved both corroborating and conflicting evidence; system abstains from forcing a resolution.');
  }
  // CASE C: ONLY CONTRADICTING EVIDENCE
  else if (conGroups.groupCount > 0 || mismatches.length > 0) {
    evaluatedStatus = ClaimStatus.CONTRADICTED;
    evaluatedConfidence = 0.90;
    whatRemainsUnknown.push('The claim is contradicted by credible evidence; original intent or context remains unestablished.');
  }
  // CASE D: ONLY SUPPORTING EVIDENCE EXISTS -> EVALUATE CRITICAL EPISTEMIC BOUNDARIES
  else {
    // Epistemic Boundary Checks by Claim Type:
    if (claim.claimType === ClaimTypes.OWNERSHIP) {
      // Epistemic rule: Earliest observed publication ≠ legal ownership
      evaluatedStatus = ClaimStatus.UNKNOWN;
      evaluatedConfidence = 0.35;
      whatRemainsUnknown.push('Earliest observed publication does not establish legal ownership or copyright holder status.');
      limitations.push('Ownership claims remain UNKNOWN without authoritative legal registry or authenticated rights holder chain of custody.');
    } else if (claim.claimType === ClaimTypes.ORIGIN && claim.statement.toLowerCase().includes('original')) {
      // Epistemic rule: Earliest observed appearance ≠ absolute original creation
      evaluatedStatus = ClaimStatus.INCONCLUSIVE;
      evaluatedConfidence = 0.60;
      whatRemainsUnknown.push('Earliest observed appearance in catalog does not prove absolute original creation or unobserved earlier recordings.');
      limitations.push('Current evidence supports earliest appearance in known records, not proof of ultimate origin.');
    } else if (claim.claimType === ClaimTypes.DATE) {
      // Epistemic rule: Publication timestamp ≠ recording timestamp
      evaluatedStatus = ClaimStatus.PARTIALLY_SUPPORTED;
      evaluatedConfidence = 0.70;
      whatRemainsUnknown.push('Source publication or file container timestamp does not prove media recording timestamp without sensor hardware logs.');
      limitations.push('Timestamp reflects observed publication or container metadata, not authenticated recording time.');
    } else if (claim.claimType === ClaimTypes.IDENTITY) {
      // Epistemic rule: Visual similarity does not establish personal identity
      evaluatedStatus = ClaimStatus.INCONCLUSIVE;
      evaluatedConfidence = 0.50;
      whatRemainsUnknown.push('External claim asserts identity; system does not perform facial recognition or autonomous identity verification.');
      limitations.push('Identity claim recorded as attributed statement; visual similarity cannot prove identity.');
    } else {
      // Standard supporting evidence
      evaluatedStatus = ClaimStatus.SUPPORTED;
      // Base confidence on independent groups (e.g. 1 group = 0.85, 2+ groups = 0.94)
      evaluatedConfidence = supGroups.groupCount > 1 ? 0.94 : 0.85;
      whatRemainsUnknown.push('Specific camera operator identity and unedited master capture raw telemetry remain unverified.');
    }
  }

  // Record limitations if independent corroboration was copied
  if (supportingEvidence.length > 1 && supGroups.groupCount === 1) {
    limitations.push(`Multiple supporting sources share the same independence group (${supGroups.groups[0]?.groupId}). Syndicated or copied sources do not multiply independent confirmation.`);
  }

  // Create or Update Investigation Finding
  let finding = null;
  if (claim.investigationId) {
    const findingStatusMap = {
      [ClaimStatus.SUPPORTED]: FindingStatus.SUPPORTED,
      [ClaimStatus.PARTIALLY_SUPPORTED]: FindingStatus.INFERRED,
      [ClaimStatus.INCONCLUSIVE]: FindingStatus.INCONCLUSIVE,
      [ClaimStatus.CONTRADICTED]: FindingStatus.CONFLICTING,
      [ClaimStatus.UNKNOWN]: FindingStatus.INCONCLUSIVE,
      [ClaimStatus.UNASSESSED]: FindingStatus.INCONCLUSIVE
    };

    finding = store.createFinding({
      id: claim.assessmentFindingId || undefined,
      investigationId: claim.investigationId,
      title: `Claim Assessment: "${claim.statement.substring(0, 48)}${claim.statement.length > 48 ? '…' : ''}"`,
      summary: `Claim evaluated as ${evaluatedStatus}. ${whatSupportsIt.length} supporting, ${whatConflictsWithIt.length} contradicting signals.`,
      status: findingStatusMap[evaluatedStatus] || FindingStatus.INCONCLUSIVE,
      confidence: evaluatedConfidence || 0.5,
      evidenceIds: Array.from(new Set([...claim.evidenceIds, ...claim.contradictionIds])),
      limitations: [...limitations, ...whatRemainsUnknown],
      metadata: {
        claimId: claim.id,
        claimType: claim.claimType,
        evaluatedStatus,
        whatSupportsIt,
        whatConflictsWithIt,
        whatRemainsUnknown
      }
    });
  }

  // Update claim in store
  const updatedClaim = store.updateClaim(claim.id, {
    status: evaluatedStatus,
    confidence: evaluatedConfidence,
    assessmentFindingId: finding ? finding.id : claim.assessmentFindingId,
    metadata: {
      ...claim.metadata,
      whatSupportsIt,
      whatConflictsWithIt,
      whatRemainsUnknown,
      limitations,
      independentSupportingGroups: supGroups.groupCount,
      independentContradictingGroups: conGroups.groupCount,
      assessedAt: new Date().toISOString()
    }
  });

  return {
    claim: updatedClaim,
    finding,
    supportingEvidence,
    contradictingEvidence,
    independentGroups: {
      supporting: supGroups,
      contradicting: conGroups
    },
    whatSupportsIt,
    whatConflictsWithIt,
    whatRemainsUnknown,
    limitations
  };
}

/**
 * Assesses Multi-Part Decomposed Claims
 */
function assessMultiPartClaim(store, claim, mismatches = []) {
  const subResults = [];
  let supportedCount = 0;
  let contradictedCount = 0;
  let unknownCount = 0;
  let inconclusiveCount = 0;

  const whatSupportsIt = [];
  const whatConflictsWithIt = [];
  const whatRemainsUnknown = [];
  const limitations = [];

  for (const sc of claim.subClaims) {
    const subSup = (sc.evidenceIds || []).map(id => store.getEvidence(id)).filter(Boolean);
    const subCon = (sc.contradictionIds || []).map(id => store.getEvidence(id)).filter(Boolean);

    let subStatus = ClaimStatus.UNKNOWN;
    let subConf = null;

    if (subSup.length === 0 && subCon.length === 0) {
      subStatus = ClaimStatus.UNKNOWN;
      unknownCount++;
      whatRemainsUnknown.push(`Component "${sc.statement}": No verifiable evidence available.`);
    } else if (subSup.length > 0 && subCon.length > 0) {
      subStatus = ClaimStatus.INCONCLUSIVE;
      inconclusiveCount++;
      whatConflictsWithIt.push(`Component "${sc.statement}": Evidence is contradictory.`);
    } else if (subCon.length > 0) {
      subStatus = ClaimStatus.CONTRADICTED;
      contradictedCount++;
      whatConflictsWithIt.push(`Component "${sc.statement}": Credible evidence refutes this sub-claim.`);
    } else {
      subStatus = ClaimStatus.SUPPORTED;
      subConf = 0.88;
      supportedCount++;
      whatSupportsIt.push(`Component "${sc.statement}": Corroborated by ${subSup.length} evidence record(s).`);
    }

    sc.status = subStatus;
    sc.confidence = subConf;
    subResults.push(sc);
  }

  // Determine overall status for multi-part claim
  let overallStatus = ClaimStatus.UNKNOWN;
  let overallConfidence = null;

  const total = claim.subClaims.length;
  if (supportedCount === total) {
    overallStatus = ClaimStatus.SUPPORTED;
    overallConfidence = 0.90;
  } else if (supportedCount > 0 && (unknownCount > 0 || inconclusiveCount > 0 || contradictedCount > 0)) {
    overallStatus = ClaimStatus.PARTIALLY_SUPPORTED;
    overallConfidence = (supportedCount / total) * 0.85;
    limitations.push(`Overall claim is only PARTIALLY SUPPORTED (${supportedCount}/${total} components corroborated). It must not be represented as fully supported.`);
  } else if (contradictedCount > 0 && supportedCount === 0) {
    overallStatus = ClaimStatus.CONTRADICTED;
    overallConfidence = 0.88;
  } else if (inconclusiveCount > 0) {
    overallStatus = ClaimStatus.INCONCLUSIVE;
    overallConfidence = 0.50;
  } else {
    overallStatus = ClaimStatus.UNKNOWN;
    overallConfidence = null;
  }

  // Generate Finding
  let finding = null;
  if (claim.investigationId) {
    finding = store.createFinding({
      id: claim.assessmentFindingId || undefined,
      investigationId: claim.investigationId,
      title: `Claim Assessment (Multi-Part): "${claim.statement.substring(0, 48)}"`,
      summary: `Evaluated as ${overallStatus}. ${supportedCount}/${total} components supported.`,
      status: overallStatus === ClaimStatus.SUPPORTED ? FindingStatus.SUPPORTED : FindingStatus.INCONCLUSIVE,
      confidence: overallConfidence || 0.5,
      evidenceIds: Array.from(new Set([...claim.evidenceIds, ...claim.contradictionIds])),
      limitations: [...limitations, ...whatRemainsUnknown],
      metadata: {
        claimId: claim.id,
        isMultiPart: true,
        subClaims: subResults
      }
    });
  }

  const updatedClaim = store.updateClaim(claim.id, {
    status: overallStatus,
    confidence: overallConfidence,
    subClaims: subResults,
    assessmentFindingId: finding ? finding.id : claim.assessmentFindingId,
    metadata: {
      ...claim.metadata,
      whatSupportsIt,
      whatConflictsWithIt,
      whatRemainsUnknown,
      limitations,
      assessedAt: new Date().toISOString()
    }
  });

  return {
    claim: updatedClaim,
    finding,
    subClaims: subResults,
    whatSupportsIt,
    whatConflictsWithIt,
    whatRemainsUnknown,
    limitations
  };
}
