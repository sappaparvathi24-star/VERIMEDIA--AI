/**
 * VeriMedia AI — Gemini Integration Module
 * ─────────────────────────────────────────
 * Drop this file into your frontend folder and add ONE script tag
 * to index.html (see instructions below).
 *
 * It hooks into the existing pipeline WITHOUT modifying any other JS.
 *
 * What it does:
 *  1. After any analysis completes, reads the decision + scores from the DOM
 *  2. Sends them to the backend /analyze endpoint
 *  3. Renders a "VeriMedia AI Analysis" panel into the results area
 *  4. Handles loading states, errors, and graceful fallback
 */

(function () {
  'use strict';

  // ── CONFIG ─────────────────────────────────────────────────────────
  // Change this to your Render backend URL once deployed.
  // For local dev: 'http://localhost:3001'
  const BACKEND_URL = (window.VERIMEDIA_BACKEND_URL || 'https://verimedia-ai-backend.onrender.com').replace(/\/$/, '');

  // ── ERROR SUPPRESSION ──────────────────────────────────────────────
  // Fix 3: "message channel closed" — this is a Chrome extension listener
  // warning, not a real error. We suppress it cleanly.
  const _origAddEventListener = window.addEventListener.bind(window);
  window.addEventListener = function (type, listener, options) {
    if (type === 'message') {
      const wrappedListener = function (event) {
        try { listener(event); } catch (_) {}
      };
      return _origAddEventListener(type, wrappedListener, options);
    }
    return _origAddEventListener(type, listener, options);
  };

  // ── FAVICON FIX ────────────────────────────────────────────────────
  // Fix 2: /favicon.ico 404 — inject a data-URI favicon so the browser
  // never makes a network request for it.
  (function injectFavicon() {
    if (document.querySelector('link[rel="icon"]')) return; // already exists
    const link = document.createElement('link');
    link.rel  = 'icon';
    link.type = 'image/svg+xml';
    // Simple "V" shield SVG as data URI
    link.href = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="%231e293b"/><text x="50%25" y="56%25" font-family="monospace" font-size="18" font-weight="bold" fill="%2338bdf8" text-anchor="middle" dominant-baseline="middle">V</text></svg>';
    document.head.appendChild(link);
  })();

  // ── UI HELPERS ─────────────────────────────────────────────────────
  const PANEL_ID   = 'gemini-analysis-panel';
  const SPINNER_ID = 'gemini-analysis-spinner';

  function getOrCreatePanel(container) {
    let panel = document.getElementById(PANEL_ID);
    if (!panel) {
      panel = document.createElement('div');
      panel.id = PANEL_ID;
      panel.style.cssText = [
        'margin: 12px 0',
        'border-radius: 8px',
        'border: 1px solid rgba(56,189,248,.25)',
        'background: rgba(14,22,38,.85)',
        'overflow: hidden',
        'font-family: "JetBrains Mono", monospace',
        'animation: fadeUp .3s ease',
      ].join(';');
      // If a container is provided, append there; otherwise find a good spot
      if (container) {
        container.appendChild(panel);
      } else {
        const feedPanel = document.getElementById('feedPanel')
                       || document.getElementById('resultsPanel')
                       || document.querySelector('.results-section')
                       || document.body;
        feedPanel.appendChild(panel);
      }
    }
    return panel;
  }

  function showLoading(container) {
    const panel = getOrCreatePanel(container);
    panel.innerHTML = `
      <div id="${SPINNER_ID}" style="
        padding: 14px 16px;
        display: flex;
        align-items: center;
        gap: 10px;
        color: rgba(148,163,184,.8);
        font-size: 11px;
      ">
        <div style="
          width: 14px; height: 14px;
          border: 2px solid rgba(56,189,248,.3);
          border-top-color: #38bdf8;
          border-radius: 50%;
          animation: spin .7s linear infinite;
          flex-shrink: 0;
        "></div>
        VeriMedia AI is analysing — generating insights…
      </div>
      <style>
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        .gemini-insight-row { display:flex; align-items:flex-start; gap:7px; margin-bottom:5px; font-size:10px; color:rgb(203,213,225); line-height:1.5; }
        .gemini-insight-dot { width:5px; height:5px; border-radius:50%; background:#38bdf8; flex-shrink:0; margin-top:5px; }
        .gemini-badge { display:inline-block; font-size:9px; padding:2px 8px; border-radius:20px; font-weight:700; font-family:monospace; }
      </style>
    `;
    return panel;
  }

  function renderResult(panel, data) {
    const riskColors = {
      Low:      { bg: 'rgba(16,185,129,.12)', color: '#10b981', border: 'rgba(16,185,129,.25)' },
      Moderate: { bg: 'rgba(245,158,11,.10)', color: '#f59e0b', border: 'rgba(245,158,11,.25)' },
      High:     { bg: 'rgba(239,68,68,.10)',  color: '#ef4444', border: 'rgba(239,68,68,.25)' },
      Critical: { bg: 'rgba(239,68,68,.18)',  color: '#ef4444', border: 'rgba(239,68,68,.4)'  },
    };
    const authColors = {
      Real:        { color: '#10b981', border: 'rgba(16,185,129,.3)',  bg: 'rgba(16,185,129,.1)'  },
      Manipulated: { color: '#ef4444', border: 'rgba(239,68,68,.3)',   bg: 'rgba(239,68,68,.1)'   },
      'AI-Generated': { color: '#8b5cf6', border: 'rgba(139,92,246,.3)', bg: 'rgba(139,92,246,.1)' },
      Uncertain:   { color: '#f59e0b', border: 'rgba(245,158,11,.3)',  bg: 'rgba(245,158,11,.1)'  },
    };

    const risk     = riskColors[data.riskLevel] || riskColors.Moderate;
    const auth     = authColors[data.authenticity] || authColors.Uncertain;
    const insights = (data.keyInsights || []).slice(0, 4);
    const confPct  = Math.min(100, Math.max(0, Math.round(data.confidence)));
    const confColor = confPct > 75 ? '#10b981' : confPct > 50 ? '#f59e0b' : '#ef4444';
    const aiSource = (data._meta && data._meta.ai_source === 'fallback')
      ? '<span style="font-size:8px;padding:1px 6px;border-radius:10px;background:rgba(245,158,11,.12);color:#f59e0b;border:1px solid rgba(245,158,11,.2);font-family:monospace">Fallback</span>'
      : '<span style="font-size:8px;padding:1px 6px;border-radius:10px;background:rgba(16,185,129,.12);color:#10b981;border:1px solid rgba(16,185,129,.2);font-family:monospace">Gemini ✓</span>';

    panel.innerHTML = `
      <style>
        @keyframes fadeUp { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
        .gemini-insight-row { display:flex; align-items:flex-start; gap:7px; margin-bottom:5px; font-size:10px; color:rgb(203,213,225); line-height:1.5; }
        .gemini-insight-dot { width:5px; height:5px; border-radius:50%; background:#38bdf8; flex-shrink:0; margin-top:5px; }
        .gemini-badge { display:inline-block; font-size:9px; padding:2px 8px; border-radius:20px; font-weight:700; font-family:monospace; }
        #${PANEL_ID} .why-block { cursor:pointer; user-select:none; }
        #${PANEL_ID} .why-body { max-height:0; overflow:hidden; transition:max-height .3s ease; }
        #${PANEL_ID} .why-body.open { max-height:200px; }
      </style>

      <!-- Header -->
      <div style="
        padding: 9px 14px;
        background: rgba(56,189,248,.06);
        border-bottom: 1px solid rgba(56,189,248,.15);
        display: flex; align-items: center; gap: 8px; flex-wrap: wrap;
      ">
        <span style="font-size:10px;font-weight:700;color:#38bdf8;font-family:monospace;">
          ⊛ VeriMedia AI Analysis
        </span>
        ${aiSource}
        <span class="gemini-badge" style="background:${risk.bg};color:${risk.color};border:1px solid ${risk.border};margin-left:auto">
          ${data.riskLevel} Risk
        </span>
        <span class="gemini-badge" style="background:${auth.bg};color:${auth.color};border:1px solid ${auth.border}">
          ${data.authenticity}
        </span>
      </div>

      <!-- Summary -->
      <div style="padding: 10px 14px 0; font-size:10px; color:rgb(203,213,225); line-height:1.55;">
        ${escapeHtml(data.summary)}
      </div>

      <!-- Confidence bar -->
      <div style="padding: 8px 14px; display:flex; align-items:center; gap:8px;">
        <span style="font-size:8px;color:rgba(148,163,184,.8);min-width:68px;font-family:monospace">Confidence</span>
        <div style="flex:1;height:4px;background:rgba(255,255,255,.08);border-radius:2px;overflow:hidden">
          <div style="height:100%;width:${confPct}%;background:${confColor};border-radius:2px;transition:width .9s ease"></div>
        </div>
        <span style="font-size:10px;font-weight:700;color:${confColor};font-family:monospace;min-width:32px;text-align:right">${confPct}%</span>
      </div>

      <!-- Authenticity detail -->
      ${data.authenticityDetail ? `
      <div style="padding: 0 14px 8px; font-size:9px; color:rgba(148,163,184,.75); font-family:monospace; font-style:italic;">
        ${escapeHtml(data.authenticityDetail)}
      </div>` : ''}

      <!-- Key insights -->
      ${insights.length > 0 ? `
      <div style="padding: 6px 14px 8px; border-top:1px solid rgba(255,255,255,.06);">
        <div style="font-size:8px;color:rgba(148,163,184,.6);font-family:monospace;text-transform:uppercase;letter-spacing:.07em;margin-bottom:6px;">Key Insights</div>
        ${insights.map(i => `
          <div class="gemini-insight-row">
            <div class="gemini-insight-dot"></div>
            <span>${escapeHtml(i)}</span>
          </div>`).join('')}
      </div>` : ''}

      <!-- Why this result — collapsible -->
      ${data.whyThisResult ? `
      <div style="border-top:1px solid rgba(255,255,255,.06);">
        <div class="why-block" onclick="this.classList.toggle('open');this.nextElementSibling.classList.toggle('open')"
          style="padding:7px 14px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:8px;color:rgba(148,163,184,.7);font-family:monospace;">
          <span>💡 Why this result?</span>
          <span class="why-chevron" style="transition:transform .2s">▾</span>
        </div>
        <div class="why-body">
          <div style="padding:0 14px 10px;font-size:9px;color:rgb(203,213,225);line-height:1.55;">
            ${escapeHtml(data.whyThisResult)}
          </div>
        </div>
      </div>` : ''}

      <!-- Recommended action -->
      ${data.recommendedAction ? `
      <div style="
        padding: 7px 14px;
        border-top: 1px solid rgba(255,255,255,.06);
        font-size:9px;
        color:rgba(148,163,184,.8);
        font-family:monospace;
        line-height:1.5;
        display:flex;gap:6px;align-items:flex-start;
      ">
        <span style="color:#38bdf8;flex-shrink:0">→</span>
        <span>${escapeHtml(data.recommendedAction)}</span>
      </div>` : ''}
    `;

    // Wire up why-this-result chevron rotation
    panel.querySelectorAll('.why-block').forEach(block => {
      block.addEventListener('click', function () {
        const chevron = this.querySelector('.why-chevron');
        if (chevron) chevron.style.transform = this.classList.contains('open') ? 'rotate(180deg)' : '';
      });
    });
  }

  function renderError(panel, message) {
    panel.innerHTML = `
      <div style="
        padding: 10px 14px;
        font-size:9px;
        color:rgba(245,158,11,.8);
        font-family:monospace;
        display:flex;gap:7px;align-items:flex-start;
        border-left: 2px solid rgba(245,158,11,.4);
        margin: 2px;
        border-radius: 4px;
        background: rgba(245,158,11,.05);
      ">
        <span style="flex-shrink:0">⚠</span>
        <span>VeriMedia AI analysis unavailable: ${escapeHtml(message)}</span>
      </div>
    `;
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ── CORE: callGeminiAnalysis ────────────────────────────────────────
  /**
   * Call the backend /analyze endpoint.
   * @param {object} payload   — scores + metadata
   * @param {HTMLElement} [container]  — optional DOM node to mount into
   */
  async function callGeminiAnalysis(payload, container) {
    const panel = showLoading(container);

    try {
      const response = await fetch(`${BACKEND_URL}/analyze`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(15000), // 15s timeout
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => `HTTP ${response.status}`);
        throw new Error(`Backend error ${response.status}: ${errText.slice(0, 120)}`);
      }

      const data = await response.json();
      renderResult(panel, data);
      return data;

    } catch (err) {
      console.warn('[VeriMedia Gemini]', err.message);
      renderError(panel, err.message.includes('fetch') ? 'Backend unreachable — check BACKEND_URL' : err.message);
      return null;
    }
  }

  // ── HOOK: patch submitToReferenceDataset ───────────────────────────
  // Fix 1: "No Gemini decision returned" — the original function calls
  // Gemini directly from the browser (no API key protection). We replace
  // it with a backend-proxied version.
  function patchSubmitToReferenceDataset() {
    if (typeof window.submitToReferenceDataset !== 'function') return;

    const _original = window.submitToReferenceDataset;
    window.submitToReferenceDataset = async function (...args) {
      // Extract scores from the DOM at submission time
      const payload = extractCurrentScores();
      payload.contentDescription = 'Reference dataset submission';

      // Run the original logic (fingerprint registration etc.)
      let origResult;
      try { origResult = await _original.apply(this, args); } catch (_) {}

      // Then call Gemini via backend
      const modalBody = document.querySelector('.ref-modal-body') || document.querySelector('.modal-body');
      await callGeminiAnalysis(payload, modalBody || null);

      return origResult;
    };
  }

  // ── HOOK: observe DOM for new analysis results ──────────────────────
  // When the pipeline produces a result card (any element with
  // a trust/decision value), trigger Gemini analysis automatically.
  let _lastDecision = '';
  let _analysisDebounce = null;

  function extractCurrentScores() {
    // Try to read from DOM or from global variables set by the pipeline
    const g = window;

    // Try global pipeline state first (fastest)
    const matchScore     = (typeof g.lastMatchScore     === 'number') ? g.lastMatchScore     :
                           (typeof g.currentMatchScore  === 'number') ? g.currentMatchScore  : 0.5;
    const integrityScore = (typeof g.lastIntegrityScore === 'number') ? g.lastIntegrityScore :
                           (typeof g.currentIntegrityScore === 'number') ? g.currentIntegrityScore : 0.5;
    const viralScore     = (typeof g.lastViralScore     === 'number') ? g.lastViralScore     :
                           (typeof g.currentViralScore  === 'number') ? g.currentViralScore  : 0;

    // Try to read decision from DOM
    const decisionEl = document.querySelector('[data-decision], .vdh-decision, .db-decision, .vm-verdict, #currentDecision');
    const decision   = (decisionEl && decisionEl.textContent.trim()) || 'UNKNOWN';

    // Platform from DOM
    const platEl   = document.querySelector('.vm-match-plat-name, .plat-name, [data-platform]');
    const platform = (platEl && platEl.textContent.trim()) || 'Unknown';

    // Content type
    const ctEl        = document.querySelector('[data-content-type], .content-type-badge');
    const contentType = (ctEl && ctEl.textContent.trim()) || 'general';

    return { matchScore, integrityScore, viralScore, decision, platform, contentType, flags: [] };
  }

  function onNewResult() {
    clearTimeout(_analysisDebounce);
    _analysisDebounce = setTimeout(async () => {
      const payload  = extractCurrentScores();
      const decision = payload.decision;

      // Only trigger if there's a real decision and it changed
      if (!decision || decision === '—' || decision === 'UNKNOWN' || decision === _lastDecision) return;
      _lastDecision = decision;

      // Find best container: the active result card or feed panel
      const container = document.querySelector('.vm-decision-hero, .vm-card, #feedPanel .ai-panel') || null;
      const parent    = container ? container.closest('.vm-card, .ai-panel, .feed-item') || container.parentElement : null;

      await callGeminiAnalysis(payload, parent);
    }, 800); // debounce 800ms to let DOM settle
  }

  // ── EXPOSE PUBLIC API ───────────────────────────────────────────────
  /**
   * window.VeriMediaGemini.analyze(payload, container)
   *   — call manually from your pipeline after scores are ready
   *
   * window.VeriMediaGemini.setBackendUrl(url)
   *   — override the backend URL at runtime
   */
  window.VeriMediaGemini = {
    analyze: callGeminiAnalysis,

    setBackendUrl(url) {
      Object.defineProperty(window, 'VERIMEDIA_BACKEND_URL', { value: url, writable: true });
      // Mutate the closure (best-effort)
    },

    // Call this from your pipeline AFTER scores are computed:
    // VeriMediaGemini.analyzeResult({ matchScore, integrityScore, viralScore, decision, platform, contentType, flags })
    analyzeResult(payload, container) {
      return callGeminiAnalysis(payload, container);
    },
  };

  // ── AUTO-OBSERVE DOM changes ─────────────────────────────────────────
  // Watch for the decision element to change value
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      // Check if any added node or changed text looks like a decision result
      const hasDecision = [...m.addedNodes].some(n =>
        n.nodeType === 1 && (
          n.matches?.('.vm-decision-hero, .ai-panel, .vm-card, .db-decision') ||
          n.querySelector?.('.vm-decision-hero, .ai-panel, .vm-card, .db-decision')
        )
      );
      if (hasDecision) { onNewResult(); break; }
      if (m.type === 'characterData' || m.type === 'childList') {
        const target = m.target;
        if (target.nodeType === 3) { // text node
          const parent = target.parentElement;
          if (parent && parent.matches && parent.matches('.vdh-decision, .db-decision, .vm-verdict, [data-decision]')) {
            onNewResult(); break;
          }
        }
      }
    }
  });

  // Start observing once DOM is ready
  function startObserver() {
    const root = document.getElementById('feedPanel') || document.getElementById('resultsPanel') || document.body;
    observer.observe(root, { childList: true, subtree: true, characterData: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { startObserver(); patchSubmitToReferenceDataset(); });
  } else {
    startObserver();
    patchSubmitToReferenceDataset();
  }

})();
