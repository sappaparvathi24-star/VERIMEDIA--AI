// VeriMedia AI — Investigation Reporting & Forensic Export Engine (Phases L & M)
import { buildMediaTimeline } from './timeline.js';

export function generateInvestigationReport(store, investigationId, options = {}) {
  const inv = store.getInvestigation(investigationId);
  if (!inv) {
    throw new Error(`Investigation not found: ${investigationId}`);
  }

  const artifacts = (inv.artifactIds || []).map(id => store.getArtifact(id)).filter(Boolean);
  const findings = (inv.findingIds || []).map(id => store.getFinding(id)).filter(Boolean);
  const timeline = buildMediaTimeline(store, investigationId);
  const claims = Array.from(store.claims.values()).filter(c => c.investigationId === investigationId);
  const candidates = store.getDiscoveryCandidatesByInvestigation?.(investigationId) || [];

  const evidenceIds = new Set();
  findings.forEach(f => (f.evidenceIds || []).forEach(eid => evidenceIds.add(eid)));
  timeline.events.forEach(e => (e.evidenceIds || []).forEach(eid => evidenceIds.add(eid)));
  const evidenceLedger = Array.from(evidenceIds).map(eid => store.getEvidence(eid)).filter(Boolean);

  const reportId = `RPT-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
  const now = new Date().toISOString();

  const report = {
    id: reportId,
    investigationId,
    title: `Forensic & Provenance Investigation Report: ${inv.title}`,
    generatedAt: now,
    generatedBy: options.generatedBy || 'VeriMedia AI Automated Provenance Engine',
    investigation: {
      id: inv.id,
      title: inv.title,
      description: inv.description,
      status: inv.status,
      isDemo: Boolean(inv.isDemo),
      createdAt: inv.createdAt
    },
    executiveSummary: {
      status: timeline.status || 'OBSERVED',
      forensicConfidence: inv.forensicConfidence || 0.85,
      provenanceConfidence: timeline.provenanceConfidence,
      artifactCount: artifacts.length,
      findingCount: findings.length,
      evidenceNodeCount: evidenceLedger.length,
      claimCount: claims.length,
      earliestObservedAppearance: timeline.earliestAppearance
    },
    artifacts,
    findings,
    timeline: timeline.events,
    claims,
    candidates,
    evidenceLedger,
    whatWeKnow: timeline.whatWeKnow,
    whatRemainsUnknown: timeline.whatRemainsUnknown,
    legalDisclaimer: 'This technical report documents empirical forensic measurements, perceptual comparisons, and indexed provenance timelines. Technical similarity and earliest observed timestamps do not constitute judicial determinations of authorship, intent, or exclusive ownership without independent corroborating legal chain-of-custody.'
  };

  store.createReportRecord({
    id: reportId,
    investigationId,
    title: report.title,
    findingsCount: findings.length,
    artifactCount: artifacts.length,
    evidenceIds: Array.from(evidenceIds),
    exportFormat: options.exportFormat || 'JSON',
    content: report,
    isDemo: Boolean(inv.isDemo)
  });

  return report;
}

export function exportReportHTML(report) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>${report.title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #0b0f19; color: #f1f5f9; padding: 40px; margin: 0; }
    .container { max-width: 900px; margin: 0 auto; background: #131b2e; border: 1px solid #1e293b; border-radius: 12px; padding: 32px; }
    h1 { color: #38bdf8; margin-top: 0; font-size: 24px; border-bottom: 1px solid #1e293b; padding-bottom: 16px; }
    h2 { color: #94a3b8; font-size: 18px; margin-top: 24px; border-bottom: 1px solid #1e293b; padding-bottom: 8px; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; background: #0f172a; padding: 16px; border-radius: 8px; margin-bottom: 24px; }
    .meta-item { font-size: 14px; }
    .meta-label { color: #64748b; font-weight: 600; text-transform: uppercase; font-size: 11px; }
    .meta-val { color: #e2e8f0; font-weight: bold; margin-top: 4px; }
    .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: 600; }
    .badge-blue { background: rgba(56, 189, 248, 0.15); color: #38bdf8; }
    .card { background: #0f172a; border: 1px solid #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 12px; }
    .card-title { font-weight: 600; color: #f8fafc; font-size: 15px; }
    .card-body { color: #94a3b8; font-size: 13px; margin-top: 6px; }
    .disclaimer { margin-top: 32px; padding: 16px; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); border-radius: 8px; font-size: 12px; color: #fca5a5; }
  </style>
</head>
<body>
  <div class="container">
    <h1>${report.title}</h1>
    <div class="meta-grid">
      <div class="meta-item"><div class="meta-label">Investigation ID</div><div class="meta-val">${report.investigation.id}</div></div>
      <div class="meta-item"><div class="meta-label">Generated At</div><div class="meta-val">${report.generatedAt}</div></div>
      <div class="meta-item"><div class="meta-label">Forensic Confidence</div><div class="meta-val">${(report.executiveSummary.forensicConfidence * 100).toFixed(0)}%</div></div>
      <div class="meta-item"><div class="meta-label">Provenance Confidence</div><div class="meta-val">${report.executiveSummary.provenanceConfidence}</div></div>
    </div>

    <h2>Artifacts Ingested (${report.artifacts.length})</h2>
    ${report.artifacts.map(a => `
      <div class="card">
        <div class="card-title">${a.filename || a.id} <span class="badge badge-blue">${a.mimeType}</span></div>
        <div class="card-body">SHA-256: <code>${a.sha256}</code></div>
      </div>
    `).join('')}

    <h2>Forensic Findings (${report.findings.length})</h2>
    ${report.findings.map(f => `
      <div class="card">
        <div class="card-title">${f.title} <span class="badge badge-blue">${f.status}</span></div>
        <div class="card-body">${f.summary}</div>
      </div>
    `).join('')}

    <h2>What We Know</h2>
    <ul>
      ${report.whatWeKnow.map(k => `<li>${k}</li>`).join('')}
    </ul>

    <h2>What Remains Unknown</h2>
    <ul>
      ${report.whatRemainsUnknown.map(u => `<li>${u}</li>`).join('')}
    </ul>

    <div class="disclaimer">
      <strong>Epistemic Demarcation & Legal Notice:</strong><br />
      ${report.legalDisclaimer}
    </div>
  </div>
</body>
</html>`;
}

export function exportReportJSON(report) {
  return JSON.stringify(report, null, 2);
}
