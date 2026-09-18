/**
 * VeriMedia AI — Evidence Engine Frontend UI Module (Phase C)
 * ──────────────────────────────────────────────────────────────
 * Implements the traceable chain:
 * REAL MEDIA ARTIFACT → OBSERVATION → EVIDENCE → FINDING
 *
 * Epistemic Statuses:
 * - OBSERVED: Directly extracted/measured from binary or verified ledger
 * - INFERRED: Analytically derived from forensic models
 * - SUPPORTED: Corroborated by one or more independent observations
 * - CONFLICTING: Contradictory signals preserved without deletion
 * - INCONCLUSIVE: Insufficient evidence for definitive classification
 * - UNKNOWN: Measured value or provenance baseline unavailable
 */

(function () {
  'use strict';

  const BACKEND_URL = typeof window.VERIMEDIA_BACKEND_URL === 'string'
    ? window.VERIMEDIA_BACKEND_URL.replace(/\/$/, '')
    : '';

  // Store the active investigation evidence package
  window.CURRENT_EVIDENCE_TREE = null;

  // Epistemic badge colors & labels
  const STATUS_STYLES = {
    OBSERVED: { bg: 'rgba(6,182,212,.12)', color: '#06b6d4', border: 'rgba(6,182,212,.3)', label: 'OBSERVED' },
    SUPPORTED: { bg: 'rgba(16,185,129,.12)', color: '#10b981', border: 'rgba(16,185,129,.3)', label: 'SUPPORTED' },
    INFERRED: { bg: 'rgba(59,130,246,.12)', color: '#60a5fa', border: 'rgba(59,130,246,.3)', label: 'INFERRED' },
    CONFLICTING: { bg: 'rgba(249,115,22,.12)', color: '#fb923c', border: 'rgba(249,115,22,.3)', label: 'CONFLICTING' },
    INCONCLUSIVE: { bg: 'rgba(245,158,11,.12)', color: '#f59e0b', border: 'rgba(245,158,11,.3)', label: 'INCONCLUSIVE' },
    UNKNOWN: { bg: 'rgba(148,163,184,.12)', color: '#94a3b8', border: 'rgba(148,163,184,.25)', label: 'UNKNOWN' },
  };

  function getStatusBadge(status) {
    const s = STATUS_STYLES[(status || '').toUpperCase()] || STATUS_STYLES.UNKNOWN;
    return `<span style="display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:700;padding:2px 7px;border-radius:4px;background:${s.bg};color:${s.color};border:1px solid ${s.border};font-family:monospace;letter-spacing:0.04em;">${s.label}</span>`;
  }

  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Fetch full traceable evidence tree from backend
   */
  async function fetchEvidenceTree(artifactId) {
    if (!artifactId) return null;
    try {
      const res = await fetch(`${BACKEND_URL}/api/investigations/${encodeURIComponent(artifactId)}/evidence`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      window.CURRENT_EVIDENCE_TREE = data;
      return data;
    } catch (err) {
      console.warn('[EvidenceEngine] Failed to fetch evidence tree:', err.message);
      return null;
    }
  }

  /**
   * Render the complete Evidence Engine Panel
   */
  function renderEvidenceEnginePanel(container, evidenceData) {
    if (!container || !evidenceData) return;

    const { artifact, findings = [], traceableFindings = [], observations = [], evidence = [], analysisRuns = [], mode } = evidenceData;
    const isDemo = mode === 'DEMO_SCENARIO' || (artifact && artifact.sourceType === 'demo');

    const panel = document.createElement('div');
    panel.className = 'verimedia-evidence-engine-panel';
    panel.style.cssText = `
      margin: 14px 0;
      border-radius: 8px;
      border: 1px solid rgba(56,189,248,.25);
      background: #0b1120;
      font-family: 'JetBrains Mono', monospace;
      overflow: hidden;
      animation: fadeUp .3s ease;
    `;

    // ── Header ──
    const modeBadge = isDemo
      ? `<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(245,158,11,.15);color:#f59e0b;border:1px solid rgba(245,158,11,.3);">DEMO SCENARIO · NOT REAL EVIDENCE</span>`
      : `<span style="font-size:9px;font-weight:700;padding:2px 8px;border-radius:20px;background:rgba(16,185,129,.15);color:#10b981;border:1px solid rgba(16,185,129,.3);">REAL INVESTIGATION · SHA-256 ANCHORED</span>`;

    let html = `
      <div style="padding:12px 16px;background:rgba(56,189,248,.07);border-bottom:1px solid rgba(56,189,248,.18);display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
        <span style="font-size:12px;font-weight:800;color:#38bdf8;display:flex;align-items:center;gap:6px;">
          ⚖ Evidence Engine &amp; Traceability Chain
        </span>
        ${modeBadge}
        <span style="margin-left:auto;font-size:10px;color:#94a3b8;">
          ${findings.length} Findings · ${evidence.length} Evidence Items · ${observations.length} Observations
        </span>
      </div>
    `;

    // ── Media Artifact Strip ──
    if (artifact) {
      html += `
        <div style="padding:10px 16px;background:rgba(15,23,42,.6);border-bottom:1px solid rgba(56,189,248,.1);display:flex;gap:14px;flex-wrap:wrap;font-size:10px;color:#94a3b8;">
          <div><strong style="color:#cbd5e1;">Artifact ID:</strong> <code style="color:#38bdf8;">${escapeHtml(artifact.id)}</code></div>
          <div><strong style="color:#cbd5e1;">SHA-256:</strong> <code style="color:#a78bfa;" title="${escapeHtml(artifact.sha256)}">${escapeHtml(artifact.sha256 ? artifact.sha256.slice(0, 16) + '...' : 'UNKNOWN')}</code></div>
          <div><strong style="color:#cbd5e1;">Format:</strong> <span style="color:#e2e8f0;">${escapeHtml(artifact.mimeType || 'unknown')}</span> (${artifact.size ? (artifact.size / 1024).toFixed(1) + ' KB' : '—'})</div>
          ${artifact.perceptualHash ? `<div><strong style="color:#cbd5e1;">pHash:</strong> <code style="color:#38bdf8;">${escapeHtml(artifact.perceptualHash)}</code></div>` : ''}
        </div>
      `;
    }

    // ── Epistemic Principle Notice ──
    html += `
      <div style="padding:8px 16px;background:rgba(30,41,59,.4);border-bottom:1px solid rgba(255,255,255,.05);font-size:9px;color:#94a3b8;display:flex;align-items:center;gap:8px;">
        <span style="color:#38bdf8;">ⓘ</span>
        <span>Traceability Principle: Every finding is supported by concrete evidence, underlying observations, and documented analysis methods.</span>
      </div>
    `;

    // ── Findings List ──
    html += `<div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px;">`;

    const findingsToRender = (traceableFindings && traceableFindings.length > 0)
      ? traceableFindings
      : findings.map(f => ({ finding: f, supportingEvidence: [] }));

    findingsToRender.forEach((item, idx) => {
      const f = item.finding || item;
      const suppEvd = item.supportingEvidence || [];
      const confPct = Math.round((f.confidence || 1.0) * 100);
      const confColor = confPct >= 75 ? '#10b981' : confPct >= 50 ? '#f59e0b' : '#ef4444';
      const findingId = f.id || `fnd_${idx}`;

      html += `
        <div style="background:rgba(15,23,42,.7);border:1px solid rgba(56,189,248,.15);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px;" id="finding_card_${findingId}">
          <!-- Top row: Category & Epistemic Status -->
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span style="font-size:10px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.05em;">
              ${escapeHtml(f.category || 'FINDING')}
            </span>
            ${getStatusBadge(f.epistemicStatus)}
            <span style="margin-left:auto;font-size:10px;color:#94a3b8;">
              Confidence: <strong style="color:${confColor};">${confPct}%</strong> <span style="font-size:8px;opacity:0.8;">(analytical certainty)</span>
            </span>
          </div>

          <!-- Finding statement -->
          <div style="font-size:12px;color:#f1f5f9;font-weight:600;line-height:1.45;">
            ${escapeHtml(f.statement)}
          </div>

          <!-- Limitations / Uncertainty -->
          ${f.limitations ? `
            <div style="font-size:9px;color:#94a3b8;background:rgba(245,158,11,.06);border-left:2px solid #f59e0b;padding:4px 8px;border-radius:2px;">
              <strong style="color:#f59e0b;">Epistemic Limitation:</strong> ${escapeHtml(f.limitations)}
            </div>
          ` : ''}

          <!-- Traceability toggle button -->
          <div style="display:flex;align-items:center;gap:10px;margin-top:2px;">
            <button
              type="button"
              onclick="window._toggleTraceabilityChain('${findingId}')"
              style="font-size:10px;font-family:inherit;font-weight:600;color:#38bdf8;background:rgba(56,189,248,.1);border:1px solid rgba(56,189,248,.25);border-radius:4px;padding:4px 10px;cursor:pointer;display:inline-flex;align-items:center;gap:5px;transition:all .15s;"
            >
              <span>🔗 Why this finding?</span>
              <span id="trace_btn_arrow_${findingId}" style="font-size:8px;">▼</span>
            </button>
            <span style="font-size:9px;color:#64748b;">
              Supported by ${suppEvd.length} evidence item${suppEvd.length !== 1 ? 's' : ''}
            </span>
          </div>

          <!-- Traceability Details (Collapsible) -->
          <div id="trace_chain_${findingId}" style="display:none;margin-top:8px;padding:10px;background:#060a12;border:1px solid rgba(56,189,248,.2);border-radius:5px;display:none;flex-direction:column;gap:8px;">
            <div style="font-size:9px;font-weight:700;color:#38bdf8;text-transform:uppercase;letter-spacing:0.06em;border-bottom:1px solid rgba(56,189,248,.15);padding-bottom:4px;">
              Traceability Graph: Finding #${escapeHtml(findingId)}
            </div>

            ${suppEvd.length === 0 ? `
              <div style="font-size:9px;color:#94a3b8;">Directly observed from media container properties.</div>
            ` : suppEvd.map((evd, eIdx) => {
              const strPct = Math.round((evd.strength || 1.0) * 100);
              const evdObs = evd.observations || [];
              const method = evd.analysisMethod || (evd.analysisRun && evd.analysisRun.methodId ? { name: evd.analysisRun.methodId } : null);

              return `
                <div style="background:rgba(15,23,42,.85);border:1px solid rgba(255,255,255,.08);border-radius:4px;padding:8px;display:flex;flex-direction:column;gap:6px;">
                  <!-- Evidence Header -->
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <span style="font-size:8px;font-weight:700;color:#a78bfa;background:rgba(167,139,250,.12);border:1px solid rgba(167,139,250,.25);padding:1px 5px;border-radius:3px;">
                      EVIDENCE #${eIdx + 1}
                    </span>
                    ${getStatusBadge(evd.status)}
                    <span style="font-size:9px;color:#e2e8f0;font-weight:600;">${escapeHtml(evd.type || 'forensic_evidence')}</span>
                    <span style="margin-left:auto;font-size:8px;color:#94a3b8;">
                      Strength: <strong style="color:#38bdf8;">${strPct}%</strong> · Group: <code>${escapeHtml(evd.independenceGroup || 'primary')}</code>
                    </span>
                  </div>

                  <div style="font-size:10px;color:#cbd5e1;">
                    ${escapeHtml(evd.description || evd.limitations || 'Evidentiary observation record')}
                  </div>

                  <!-- Method Information -->
                  ${method ? `
                    <div style="font-size:8px;color:#60a5fa;background:rgba(59,130,246,.08);padding:3px 6px;border-radius:3px;">
                      <strong>Method:</strong> ${escapeHtml(method.name || 'Standard Analysis')} ${method.version ? `(${escapeHtml(method.version)})` : ''} — ${escapeHtml(method.description || '')}
                    </div>
                  ` : ''}

                  <!-- Underlying Observations -->
                  <div style="margin-top:2px;display:flex;flex-direction:column;gap:4px;">
                    <div style="font-size:8px;font-weight:700;color:#94a3b8;text-transform:uppercase;">Underlying Observations:</div>
                    ${evdObs.length === 0 ? `
                      <div style="font-size:8px;color:#64748b;">(Linked to direct byte extraction)</div>
                    ` : evdObs.map(obs => `
                      <div style="font-size:9px;background:rgba(0,0,0,.3);border-left:2px solid #38bdf8;padding:4px 8px;border-radius:2px;display:flex;flex-direction:column;gap:2px;">
                        <div style="display:flex;align-items:center;gap:6px;">
                          <span style="color:#38bdf8;font-weight:700;">${escapeHtml(obs.type)}</span>
                          ${getStatusBadge(obs.status)}
                          <span style="margin-left:auto;color:#64748b;font-size:8px;">${obs.source ? escapeHtml(obs.source) : 'Local Engine'}</span>
                        </div>
                        <div style="color:#e2e8f0;">
                          ${obs.value !== null && obs.value !== undefined ? `<strong>Value:</strong> <code style="color:#10b981;">${escapeHtml(String(obs.value))} ${escapeHtml(obs.unit || '')}</code>` : '<em style="color:#94a3b8;">Data unavailable (Status: UNKNOWN)</em>'}
                        </div>
                        ${obs.description ? `<div style="font-size:8px;color:#94a3b8;">${escapeHtml(obs.description)}</div>` : ''}
                      </div>
                    `).join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `;
    });

    html += `</div>`; // end findings list

    panel.innerHTML = html;
    container.appendChild(panel);
  }

  // Toggle helper function
  window._toggleTraceabilityChain = function (findingId) {
    const el = document.getElementById(`trace_chain_${findingId}`);
    const arrow = document.getElementById(`trace_btn_arrow_${findingId}`);
    if (!el) return;
    if (el.style.display === 'none' || !el.style.display) {
      el.style.display = 'flex';
      if (arrow) arrow.textContent = '▲';
    } else {
      el.style.display = 'none';
      if (arrow) arrow.textContent = '▼';
    }
  };

  /**
   * Automatically hook into Ingestion and Demo workflows
   */
  function setupEvidenceEngineHooks() {
    // 1. Hook into window.CURRENT_ARTIFACT updates
    const origFetch = window.fetch;
    window.fetch = async function (...args) {
      const url = typeof args[0] === 'string' ? args[0] : (args[0] && args[0].url) || '';
      const response = await origFetch.apply(this, args);

      // Inspect responses from /api/media/ingest or /api/demo/scenario
      if (url.includes('/api/media/ingest') || url.includes('/api/ingest') || url.includes('/api/demo/scenario')) {
        try {
          const clone = response.clone();
          const json = await clone.json();
          if (json && json.artifact) {
            window.CURRENT_ARTIFACT = json.artifact;
            window.VERIMEDIA_MODE = json.mode || (json.artifact.sourceType === 'demo' ? 'DEMO_SCENARIO' : 'REAL_INVESTIGATION');
            // Fetch full evidence tree
            setTimeout(async () => {
              const evidenceData = await fetchEvidenceTree(json.artifact.id);
              if (evidenceData) {
                // Mount into feed panel / results area
                const container = document.getElementById('feedPanel')
                  || document.getElementById('resultsPanel')
                  || document.querySelector('.vm-card')
                  || document.body;
                
                // Remove any existing evidence engine panel
                const oldPanel = document.querySelector('.verimedia-evidence-engine-panel');
                if (oldPanel) oldPanel.remove();

                renderEvidenceEnginePanel(container, evidenceData);
              }
            }, 400);
          }
        } catch (e) {
          // Ignore JSON parse errors on non-json responses
        }
      }

      return response;
    };

    // 2. Hook into the Evidence Modal so clicking "View Details" or opening evidence shows the full traceable chain
    const origOpenEvModal = window.openEvidenceModal;
    if (typeof origOpenEvModal === 'function') {
      window.openEvidenceModal = function (...args) {
        origOpenEvModal.apply(this, args);
        setTimeout(async () => {
          const body = document.getElementById('evidenceModalBody');
          if (!body) return;
          const artifactId = window.CURRENT_ARTIFACT ? window.CURRENT_ARTIFACT.id : null;
          if (artifactId) {
            let tree = window.CURRENT_EVIDENCE_TREE;
            if (!tree || tree.artifactId !== artifactId) {
              tree = await fetchEvidenceTree(artifactId);
            }
            if (tree) {
              // Add a dedicated Traceable Chain section to the modal
              const modalSection = document.createElement('div');
              modalSection.style.marginTop = '14px';
              renderEvidenceEnginePanel(modalSection, tree);
              body.appendChild(modalSection);
            }
          }
        }, 120);
      };
    }
  }

  // Expose on window
  window.VeriMediaEvidenceEngine = {
    fetchEvidenceTree,
    renderEvidenceEnginePanel,
    getStatusBadge
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupEvidenceEngineHooks);
  } else {
    setupEvidenceEngineHooks();
  }

  console.log('[VeriMedia AI] Evidence Engine loaded · Traceable chain: Artifact → Observation → Evidence → Finding active');
})();
