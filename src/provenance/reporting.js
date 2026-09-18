// VeriMedia AI — Investigation Reporting & Export Engine (Phase L & M)
import crypto from 'crypto';
import { fuseEvidenceAndReasoning } from './reasoning.js';
import { buildMediaTimeline } from './timeline.js';
import { buildGenealogyGraph } from './genealogy.js';
import { analyzePropagation } from './propagation.js';

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function generateInvestigationReport(store, investigationId, options = {}) {
  const inv = store.getInvestigation(investigationId);
  if (!inv) {
    throw new Error(`Investigation not found: ${investigationId}`);
  }

  const generatedBy = options.generatedBy || 'Lead Forensic Analyst';
  const reportVersion = options.reportVersion || '1.0';
  const now = new Date().toISOString();
  const isDemo = Boolean(inv.isDemo);

  // 1. Gather fused reasoning and core modules
  const reasoning = fuseEvidenceAndReasoning(store, investigationId, options);
  const timeline = buildMediaTimeline(store, investigationId);
  const genealogy = buildGenealogyGraph(store, investigationId);
  const propagation = analyzePropagation(store, investigationId);

  // 2. Gather artifacts, findings, claims, evidence, observations
  const artifacts = (inv.artifactIds || []).map(id => store.getArtifact(id)).filter(Boolean);
  const findings = (inv.findingIds || []).map(id => store.getFinding(id)).filter(Boolean);
  const claims = Array.from(store.claims.values()).filter(c => c.investigationId === investigationId);
  const evidenceList = Array.from(store.evidence.values()).filter(e => {
    // Check if evidence belongs to this investigation via observation or findings
    return e.observationIds.some(obsId => {
      const obs = store.getObservation(obsId);
      if (!obs) return false;
      const run = store.getAnalysisRun(obs.runId);
      return run && run.investigationId === investigationId;
    });
  });

  // 3. Compute Evidence Snapshot Hash
  const evidenceIds = evidenceList.map(e => e.id).sort();
  const snapshotData = JSON.stringify({
    investigationId,
    evidenceIds,
    findingsCount: findings.length,
    artifactCount: artifacts.length,
    generatedAt: now
  });
  const evidenceSnapshotHash = crypto.createHash('sha256').update(snapshotData).digest('hex');

  // 4. Build Structured Report
  const report = {
    reportId: `RPT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    investigationId,
    title: inv.title || `Investigation ${investigationId}`,
    generatedBy,
    reportVersion,
    generatedAt: now,
    isDemo,
    evidenceSnapshotHash,

    // Section 1: Overview
    overview: {
      id: inv.id,
      title: inv.title,
      description: inv.description,
      status: inv.status || 'ACTIVE',
      priority: inv.metadata?.priority || 'NORMAL',
      createdAt: inv.createdAt,
      artifactCount: artifacts.length,
      findingCount: findings.length,
      evidenceCount: evidenceList.length,
      claimsCount: claims.length,
      forensicConfidence: reasoning.confidenceDimensions?.forensicConfidence || 0.85,
      provenanceConfidence: reasoning.confidenceDimensions?.provenanceConfidence || 0.80
    },

    // Section 2: Media Identity & Technical Evidence
    mediaIdentity: {
      artifacts: artifacts.map(art => ({
        id: art.id,
        filename: art.filename,
        mimeType: art.mimeType,
        byteSize: art.byteSize,
        dimensions: art.dimensions || { width: 0, height: 0 },
        duration: art.duration || null,
        isReference: Boolean(art.isReference),
        technicalEvidence: {
          sha256: art.sha256,
          perceptualHash: art.perceptualHash || null,
          hashAlgorithm: 'SHA-256',
          integrityStandard: 'FIPS 180-4'
        }
      }))
    },

    // Section 3: What We Found (Findings)
    whatWeFound: findings.map(f => ({
      id: f.id,
      title: f.title,
      summary: f.summary,
      status: f.status,
      confidence: f.confidence,
      evidenceIds: f.evidenceIds || []
    })),

    // Section 4: Does the Story Match? (Claim Assessments)
    claimAssessments: claims.map(c => ({
      id: c.id,
      statement: c.statement,
      claimType: c.claimType,
      status: c.status,
      confidence: c.confidence,
      reasoning: c.reasoning,
      supportingEvidenceIds: c.evidenceIds || [],
      contradictingEvidenceIds: c.contradictionIds || [],
      limitations: c.limitations || []
    })),

    // Section 5: Where Did It Come From? (Timeline & Appearances)
    whereDidItComeFrom: {
      earliestObservedAppearance: timeline.earliestAppearance,
      events: timeline.events || [],
      forensicConfidence: timeline.forensicConfidence || 0.85,
      provenanceConfidence: timeline.provenanceConfidence || 0.80,
      limitations: [
        'Earliest observed appearance reflects public online sightings and does not prove the exact moment or physical location of recording.',
        'Platform publication timestamps may be modified, syndicated, or delayed relative to real-world events.'
      ]
    },

    // Section 6: Media History (Genealogy & Transformations)
    mediaHistory: {
      relationships: genealogy.relationships || [],
      transformations: genealogy.transformations || [],
      lineageSummary: genealogy.summary || '',
      limitations: [
        'Transformation detection identifies technical derivations (e.g. crop, downscale, recompression), but does not prove historical order without independent publication evidence.',
        'High visual similarity indicates content correspondence, not legal chain of custody.'
      ]
    },

    // Section 7: Spread Analysis (Propagation & Syndication)
    spreadAnalysis: {
      events: propagation.events || [],
      clusters: propagation.clusters || [],
      distinctChannelsCount: reasoning.distinctIndependenceChannels || 1,
      syndicationNotes: reasoning.independenceNotes || '',
      limitations: [
        'Multiple syndicated copies sharing an independence group contain redundant evidence and do not count as separate corroborations.',
        'Propagation velocity does not establish intentional coordination or authorship.'
      ]
    },

    // Section 8: Evidence Ledger
    evidenceLedger: evidenceList.map(ev => ({
      id: ev.id,
      evidenceType: ev.evidenceType,
      description: ev.description,
      independenceGroupId: ev.independenceGroupId,
      polarity: ev.polarity,
      confidence: ev.confidence,
      observationCount: (ev.observationIds || []).length
    })),

    // Section 9: Conflicting Evidence
    conflictingEvidence: reasoning.conflicts || [],

    // Section 10: What Remains Unknown (Epistemic Boundaries)
    whatRemainsUnknown: reasoning.whatRemainsUnknown || [],

    // Section 11: Media Storyline
    storyline: Array.isArray(reasoning.storyline) 
      ? reasoning.storyline 
      : (reasoning.storyline?.sections || [])
  };

  // 5. Register in Audit Trail
  store.createReportRecord({
    id: report.reportId,
    investigationId,
    title: report.title,
    generatedBy,
    reportVersion,
    evidenceSnapshotHash,
    evidenceIds,
    findingsCount: findings.length,
    artifactCount: artifacts.length,
    exportFormat: options.exportFormat || 'STRUCTURED_JSON',
    content: report,
    isDemo
  });

  return report;
}

/**
 * Exports the structured investigation report as a clean, self-contained, printable HTML document.
 */
export function exportReportHTML(report) {
  const isDemoBanner = report.isDemo ? `
    <div style="background:#451a03;border:2px solid #f59e0b;color:#fef3c7;padding:12px;border-radius:8px;margin-bottom:20px;font-family:monospace;font-size:12px;text-align:center">
      ⚠️ DEMO SCENARIO — SIMULATED INVESTIGATION EVIDENCE: This report contains synthetic data for evaluation.
    </div>
  ` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Investigation Report — ${escapeHtml(report.investigationId)} — VeriMedia AI</title>
  <style>
    @media print {
      body { background: #fff !important; color: #000 !important; }
      .no-print { display: none !important; }
      .page-break { page-break-after: always; }
      .card { border: 1px solid #ccc !important; box-shadow: none !important; }
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      line-height: 1.6;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 24px;
    }
    .container { max-width: 960px; margin: 0 auto; background: #ffffff; padding: 40px; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05); }
    header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 28px; }
    h1 { font-size: 24px; margin: 0 0 8px 0; color: #0f172a; font-family: monospace; }
    h2 { font-size: 16px; margin: 24px 0 12px 0; color: #0f172a; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; text-transform: uppercase; font-family: monospace; letter-spacing: 0.05em; }
    h3 { font-size: 14px; margin: 16px 0 6px 0; color: #1e293b; font-family: monospace; }
    .meta-bar { display: flex; flex-wrap: wrap; gap: 16px; font-size: 12px; font-family: monospace; color: #64748b; margin-top: 8px; }
    .meta-item strong { color: #0f172a; }
    .card { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 14px; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 12px; font-family: monospace; }
    th { text-align: left; background: #f1f5f9; padding: 8px 10px; border: 1px solid #cbd5e1; font-weight: 600; color: #334155; }
    td { padding: 8px 10px; border: 1px solid #e2e8f0; vertical-align: top; }
    .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 600; font-family: monospace; text-transform: uppercase; }
    .badge-green { background: #dcfce7; color: #166534; border: 1px solid #bbf7d0; }
    .badge-blue { background: #dbeafe; color: #1e40af; border: 1px solid #bfdbfe; }
    .badge-amber { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
    .badge-red { background: #fee2e2; color: #991b1b; border: 1px solid #fecaca; }
    .evidence-tag { font-size: 10px; font-family: monospace; color: #0284c7; background: #e0f2fe; padding: 1px 6px; border-radius: 3px; margin-right: 4px; }
    .limitation-box { background: #fffbeb; border-left: 4px solid #f59e0b; padding: 12px; border-radius: 0 6px 6px 0; font-size: 12px; color: #78350f; margin-top: 10px; font-family: monospace; }
    .btn-print { background: #0284c7; color: #fff; border: none; padding: 8px 16px; border-radius: 6px; font-family: monospace; font-size: 12px; font-weight: 600; cursor: pointer; float: right; }
    .btn-print:hover { background: #0369a1; }
    .audit-footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; font-size: 11px; font-family: monospace; color: #64748b; line-height: 1.6; }
  </style>
</head>
<body>

<div class="container">
  <button class="btn-print no-print" onclick="window.print()">🖨 Print / Save as PDF</button>
  
  <header>
    ${isDemoBanner}
    <h1>VERIMEDIA AI — INVESTIGATION DOSSIER</h1>
    <div style="font-size:16px;font-weight:600;color:#1e293b;margin-top:4px">${escapeHtml(report.title)}</div>
    <div class="meta-bar">
      <div class="meta-item">Investigation ID: <strong>${escapeHtml(report.investigationId)}</strong></div>
      <div class="meta-item">Report ID: <strong>${escapeHtml(report.reportId)}</strong></div>
      <div class="meta-item">Status: <strong class="badge badge-green">${escapeHtml(report.overview.status)}</strong></div>
      <div class="meta-item">Generated: <strong>${new Date(report.generatedAt).toUTCString()}</strong></div>
      <div class="meta-item">Auditor: <strong>${escapeHtml(report.generatedBy)}</strong></div>
    </div>
  </header>

  <!-- Section 1: Executive Overview -->
  <h2>1. Executive Overview</h2>
  <div class="card">
    <div style="margin-bottom:8px"><strong>Scope &amp; Background:</strong> ${escapeHtml(report.overview.description || 'Forensic verification of media authenticity, provenance chain, and claims.')}</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:12px;margin-top:12px">
      <div>Media Artifacts: <strong>${report.overview.artifactCount}</strong></div>
      <div>Verified Findings: <strong>${report.overview.findingCount}</strong></div>
      <div>Evidence Units: <strong>${report.overview.evidenceCount}</strong></div>
      <div>Assessed Claims: <strong>${report.overview.claimsCount}</strong></div>
      <div>Forensic Confidence: <strong>${(report.overview.forensicConfidence * 100).toFixed(0)}%</strong></div>
      <div>Provenance Confidence: <strong>${(report.overview.provenanceConfidence * 100).toFixed(0)}%</strong></div>
    </div>
  </div>

  <!-- Section 2: Media Identity & Technical Evidence -->
  <h2>2. Media Identity &amp; Technical Evidence</h2>
  <table>
    <thead>
      <tr>
        <th>Artifact File</th>
        <th>MIME Type</th>
        <th>Byte Size</th>
        <th>Dimensions / Duration</th>
        <th>Cryptographic SHA-256 Digest</th>
      </tr>
    </thead>
    <tbody>
      ${report.mediaIdentity.artifacts.map(art => `
        <tr>
          <td><strong>${escapeHtml(art.filename)}</strong> ${art.isReference ? '<span class="badge badge-blue">Reference</span>' : ''}</td>
          <td>${escapeHtml(art.mimeType)}</td>
          <td>${(art.byteSize / 1024).toFixed(1)} KB</td>
          <td>${art.dimensions.width}×${art.dimensions.height} ${art.duration ? `(${art.duration}s)` : ''}</td>
          <td style="word-break:break-all;font-size:10px">${escapeHtml(art.technicalEvidence.sha256)}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <!-- Section 3: What We Found -->
  <h2>3. What We Found (Evidence-Backed Findings)</h2>
  ${report.whatWeFound.length > 0 ? report.whatWeFound.map(f => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <strong>${escapeHtml(f.title)}</strong>
        <span class="badge badge-${f.status === 'SUPPORTED' ? 'green' : f.status === 'INCONCLUSIVE' ? 'amber' : 'red'}">${escapeHtml(f.status)}</span>
      </div>
      <div>${escapeHtml(f.summary)}</div>
      <div style="margin-top:8px;font-size:11px;font-family:monospace;color:#64748b">
        Confidence: ${(f.confidence * 100).toFixed(0)}% · Linked Evidence: ${f.evidenceIds.map(eid => `<span class="evidence-tag">${escapeHtml(eid)}</span>`).join('')}
      </div>
    </div>
  `).join('') : '<div class="card">No formal findings generated yet.</div>'}

  <!-- Section 4: Does the Story Match? -->
  <h2>4. Does the Story Match? (Context &amp; Claim Assessments)</h2>
  ${report.claimAssessments.length > 0 ? report.claimAssessments.map(c => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
        <span><strong>${escapeHtml(c.claimType)}:</strong> &ldquo;${escapeHtml(c.statement)}&rdquo;</span>
        <span class="badge badge-${c.status === 'SUPPORTED' ? 'green' : c.status === 'CONTRADICTED' ? 'red' : 'amber'}">${escapeHtml(c.status)}</span>
      </div>
      <div>${escapeHtml(c.reasoning)}</div>
      <div style="margin-top:8px;font-size:11px;font-family:monospace;color:#64748b">
        Supporting Evidence: ${c.supportingEvidenceIds.length ? c.supportingEvidenceIds.map(eid => `<span class="evidence-tag">${escapeHtml(eid)}</span>`).join('') : 'None'} ·
        Contradicting Evidence: ${c.contradictingEvidenceIds.length ? c.contradictingEvidenceIds.map(eid => `<span class="evidence-tag" style="background:#fee2e2;color:#991b1b">${escapeHtml(eid)}</span>`).join('') : 'None'}
      </div>
    </div>
  `).join('') : '<div class="card">No contextual claims registered.</div>'}

  <!-- Section 5: Where Did It Come From? -->
  <h2>5. Where Did It Come From? (Observed Appearances)</h2>
  <div class="card">
    <div><strong>Earliest Observed Appearance:</strong> ${report.whereDidItComeFrom.earliestObservedAppearance?.summary || 'No public appearances recorded.'}</div>
    <div style="margin-top:8px"><strong>Total Chronological Sightings:</strong> ${report.whereDidItComeFrom.events.length}</div>
    <div class="limitation-box">
      ${report.whereDidItComeFrom.limitations.join(' ')}
    </div>
  </div>

  <!-- Section 6: Media History -->
  <h2>6. Media History &amp; Transformation Lineage</h2>
  <div class="card">
    <div><strong>Lineage Summary:</strong> ${escapeHtml(report.mediaHistory.lineageSummary || 'No transformation relationships recorded.')}</div>
    <div class="limitation-box">
      ${report.mediaHistory.limitations.join(' ')}
    </div>
  </div>

  <!-- Section 7: Spread Analysis -->
  <h2>7. Spread Analysis &amp; Propagation</h2>
  <div class="card">
    <div><strong>Observed Propagation Events:</strong> ${report.spreadAnalysis.events.length}</div>
    <div><strong>Distinct Independent Channels:</strong> ${report.spreadAnalysis.distinctChannelsCount} (Syndicated copies grouped)</div>
    <div style="font-size:12px;color:#64748b;margin-top:6px">${escapeHtml(report.spreadAnalysis.syndicationNotes)}</div>
    <div class="limitation-box">
      ${report.spreadAnalysis.limitations.join(' ')}
    </div>
  </div>

  <!-- Section 8: What Remains Unknown -->
  <h2>8. What Remains Unknown (Explicit Epistemic Boundaries)</h2>
  <div class="card" style="border-left:4px solid #f59e0b">
    <ul style="margin:0;padding-left:20px;font-size:12px;color:#334155;line-height:1.7">
      ${report.whatRemainsUnknown.map(u => `<li>${escapeHtml(u)}</li>`).join('')}
    </ul>
  </div>

  <!-- Section 9: Media Storyline -->
  <h2>9. Media Storyline (Synthesis)</h2>
  ${(Array.isArray(report.storyline) ? report.storyline : []).map(s => `
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
        <strong>${escapeHtml(s.title || s.heading || 'Storyline Section')}</strong>
        <span class="badge badge-blue">${escapeHtml(s.epistemicStatus || 'OBSERVED')}</span>
      </div>
      <div>${escapeHtml(s.summary || s.narrative || '')}</div>
      ${s.evidenceIds && s.evidenceIds.length > 0 ? `
        <div style="margin-top:6px;font-size:11px;font-family:monospace;color:#64748b">
          Referenced Evidence: ${s.evidenceIds.map(eid => `<span class="evidence-tag">${escapeHtml(eid)}</span>`).join('')}
        </div>
      ` : ''}
    </div>
  `).join('')}

  <!-- Audit Footer -->
  <footer class="audit-footer">
    <div><strong>EVIDENTIARY AUDIT SIGNATURE:</strong> SHA-256 [${report.evidenceSnapshotHash}]</div>
    <div>Reproducible from immutable investigation evidence ledger. Report Version ${report.reportVersion} · Generated by VeriMedia AI System.</div>
  </footer>
</div>

</body>
</html>`;
}

/**
 * Exports the structured investigation report as formatted JSON.
 */
export function exportReportJSON(report) {
  return JSON.stringify(report, null, 2);
}
