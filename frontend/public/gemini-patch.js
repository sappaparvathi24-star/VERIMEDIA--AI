/**
 * VeriMedia AI — Gemini Patch
 * Replaces ALL Anthropic API calls with Gemini.
 * Drop this file in your frontend/public/ folder and add ONE script tag
 * at the very END of <body>, after all other scripts:
 *
 *   <script src="gemini-patch.js"></script>
 *
 * Then remove (or comment out) any existing <script src="gemini-integration.js">
 *
 * HOW TO SET YOUR GEMINI KEY (pick one):
 *   A) <meta name="gemini-key" content="AIza..."> in <head>
 *   B) window.GEMINI_API_KEY = "AIza..." before this script loads
 *   C) It will prompt you on first use and save to localStorage
 */

(function () {
  "use strict";

  // ─── Config ────────────────────────────────────────────────────────────────
  const GEMINI_MODEL   = "gemini-2.0-flash";
  const GEMINI_BASE    = "https://generativelanguage.googleapis.com/v1beta/models";
  const BACKEND_URL    = "https://verimedia-ai-backend.onrender.com";

  // ─── Key resolution ────────────────────────────────────────────────────────
  function getGeminiKey() {
    if (window.GEMINI_API_KEY) return window.GEMINI_API_KEY;
    const meta = document.querySelector('meta[name="gemini-key"]');
    if (meta && meta.content) return meta.content;
    return localStorage.getItem("vm_gemini_key") || "";
  }

  function requireGeminiKey() {
    let k = getGeminiKey();
    if (!k) {
      k = prompt("Enter your Gemini API key to activate VeriMedia AI:\n(Get one free at aistudio.google.com)");
      if (!k) throw new Error("No Gemini API key provided.");
      localStorage.setItem("vm_gemini_key", k.trim());
      window.GEMINI_API_KEY = k.trim();
    }
    return k.trim();
  }

  // ─── Core Gemini call ──────────────────────────────────────────────────────
  /**
   * callGemini(prompt, systemPrompt, history, maxTokens)
   * Returns the text response string.
   * history = [{role:"user"|"model", parts:[{text:"..."}]}]
   */
  async function callGemini(userText, systemPrompt, history = [], maxTokens = 1000) {
    const key = requireGeminiKey();

    const contents = [
      ...(history || []),
      { role: "user", parts: [{ text: userText }] },
    ];

    const body = {
      system_instruction: { parts: [{ text: systemPrompt || VERIMEDIA_SYSTEM }] },
      contents,
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: maxTokens,
      },
    };

    const url = `${BACKEND_URL}/analyze`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `Gemini HTTP ${res.status}`);
    }

    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
  }

  // ─── VeriMedia system prompt (matches backend) ─────────────────────────────
  const VERIMEDIA_SYSTEM = `You are VeriMedia AI, an expert AI content intelligence engine.
You specialize in media authenticity analysis, deepfake detection, content integrity scoring, and DMCA enforcement.
When asked to analyze content:
- Explain detection results clearly using exact percentages
- Reference trust_score = match_score × integrity_score formula
- Thresholds: >75% ALLOW · 40-75% REVIEW · <40% TAKEDOWN · <30% + viral>85 EMERGENCY
- Be concise and actionable. No filler words.`;

  // ─── Override callVeriMediaAI ──────────────────────────────────────────────
  // This is the function used throughout your index.html for all AI decisions.
  // We replace it to call Gemini instead of Anthropic.
  window.callVeriMediaAI = async function (prompt, maxT = 700) {
    // Update the AI status pill
    setAIStatusSafe("processing");
    try {
      const text = await callGemini(prompt, VERIMEDIA_SYSTEM, [], maxT);
      setAIStatusSafe("success");
      return text;
    } catch (e) {
      setAIStatusSafe("fallback");
      console.warn("[VeriMedia Gemini] callVeriMediaAI failed:", e.message);
      throw e;
    }
  };

  // Safe wrapper — won't crash if setAIStatus isn't defined yet
  function setAIStatusSafe(state) {
    if (typeof window.setAIStatus === "function") {
      window.setAIStatus(state);
    }
  }

  // ─── Override the /analyze fetch ──────────────────────────────────────────
  // Your frontend POSTs to VERIMEDIA_API_URL with Anthropic headers.
  // We intercept it and route to the backend /chat endpoint instead.
  // The backend calls Gemini server-side (API key stays safe).
  const _origFetch = window.fetch;
  window.fetch = async function (url, options = {}) {
    const urlStr = typeof url === "string" ? url : url?.url || "";

    // Intercept calls to the Anthropic API
    if (urlStr.includes("api.anthropic.com")) {
      console.log("[VeriMedia Gemini] Intercepted Anthropic call → routing to backend /chat");

      // Parse the original Anthropic request body
      let body = {};
      try { body = JSON.parse(options.body || "{}"); } catch (e) { /* ignore */ }

      // Extract the prompt from Anthropic's message format
      const messages = (body.messages || []).map(m => ({
        role: m.role === "assistant" ? "model" : "user",
        content: typeof m.content === "string"
          ? m.content
          : Array.isArray(m.content)
            ? m.content.filter(b => b.type === "text").map(b => b.text).join("\n")
            : "",
      }));

      // Call our backend /chat (which uses Gemini server-side)
      return _origFetch(`${BACKEND_URL}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages,
          system_prompt: VERIMEDIA_SYSTEM,
          max_tokens: body.max_tokens || 1000,
        }),
      });
    }

    // Everything else passes through normally
    return _origFetch.apply(this, arguments);
  };

  // ─── Update nav branding ───────────────────────────────────────────────────
  function updateBranding() {
    // AI status pill
    const pill = document.getElementById("aiStatusPill");
    if (pill) {
      pill.innerHTML = '<div class="dot g" style="width:5px;height:5px;border-radius:50%;background:#10B981;box-shadow:0 0 4px #10B981;animation:blink 2s infinite"></div><span>Gemini Ready</span>';
      pill.style.borderColor = "rgba(16,185,129,.35)";
      pill.style.background = "var(--greenDim, rgba(5,46,30,.5))";
      pill.style.color = "var(--green, #10B981)";
      pill.onclick = () => {
        const k = prompt("Gemini API key (leave blank to keep current):");
        if (k && k.trim()) {
          localStorage.setItem("vm_gemini_key", k.trim());
          window.GEMINI_API_KEY = k.trim();
          updateBranding();
        }
      };
    }

    // Update any "Powered by Claude/Anthropic" text
    document.querySelectorAll("*").forEach(el => {
      if (
        el.children.length === 0 &&
        el.textContent &&
        /powered by (claude|anthropic)/i.test(el.textContent)
      ) {
        el.textContent = el.textContent
          .replace(/powered by claude/gi, "Powered by Gemini")
          .replace(/powered by anthropic/gi, "Powered by Gemini");
      }
    });

    // Update .btag version
    const btag = document.querySelector(".btag");
    if (btag && btag.textContent.includes("v2")) {
      btag.textContent = btag.textContent.replace(/v\d+/, "v28") + " · Gemini";
    }
  }

  // ─── AI explanation upgrade in cards ─────────────────────────────────────
  // The existing injectAIExplanation calls Anthropic. We patch it to use Gemini.
  window._vmaGeminiExplainPatch = async function(cardKey, analysisData, fileInfo) {
    const bodyEl = document.getElementById("vm-ai-exp-body-" + cardKey);
    if (!bodyEl) return;

    const simP   = Math.round((analysisData.match_score || 0) * 100);
    const intP   = Math.round((analysisData.integrity_score || 0) * 100);
    const trustP = Math.round((analysisData.trust_score || 0) * 100);
    const viralP = Math.round((analysisData.viral_score || 0));
    const dec    = analysisData.decision || "REVIEW";
    const ct     = fileInfo.contentType || "general";
    const plat   = fileInfo.platform || "Unknown";

    const verdictTag = dec === "ALLOW"
      ? `<span class="vm-ai-exp-verdict allow">✅ VERIFIED CLEAN</span>`
      : dec === "REVIEW"
      ? `<span class="vm-ai-exp-verdict review">⚠️ REVIEW REQUIRED</span>`
      : dec === "EMERGENCY_TAKEDOWN"
      ? `<span class="vm-ai-exp-verdict emergency">🚨 EMERGENCY TAKEDOWN</span>`
      : `<span class="vm-ai-exp-verdict takedown">❌ TAKEDOWN</span>`;

    // Show loading state
    bodyEl.innerHTML = `${verdictTag}<div class="vm-ai-exp-loading"><span></span><span></span><span></span> Generating Gemini explanation…</div>`;

    try {
      const prompt = `Analyze this VeriMedia detection result and write a 2-3 sentence expert assessment:
- Platform: ${plat} · Content type: ${ct}
- Similarity: ${simP}% · Integrity: ${intP}% · Trust: ${trustP}% · Viral: ${viralP}/100
- Decision: ${dec}
Cite exact numbers. Explain the primary risk. Give one clear next action. Plain text only.`;

      const text = await callGemini(prompt, VERIMEDIA_SYSTEM, [], 220);
      if (text) {
        bodyEl.innerHTML = `${verdictTag}<p class="vm-ai-exp-text">${text}</p><div style="font-size:7px;color:var(--text3);font-family:var(--mono);margin-top:4px">✦ Gemini analysis</div>`;
      }
    } catch (e) {
      // Silently keep the loading state replaced with a fallback
      const fallback = `Trust score ${trustP}% (${simP}% similarity × ${intP}% integrity) indicates ${dec === "ALLOW" ? "authorized content" : "potential misuse"}. ${dec !== "ALLOW" ? `Primary risk: integrity degradation at ${intP}%.` : ""} ${dec === "ALLOW" ? "No action needed." : dec === "REVIEW" ? "Manual review before enforcement." : "File DMCA takedown immediately."}`;
      bodyEl.innerHTML = `${verdictTag}<p class="vm-ai-exp-text">${fallback}</p>`;
    }
  };

  // ─── VMA Assistant widget ────────────────────────────────────────────────
  // Patches the existing assistant to use Gemini directly (not Anthropic)
  window._vmaAssistantHistory = [];

  window._vmaGeminiChat = async function (userText, fileB64, fileMime) {
    const parts = [];
    if (fileB64 && fileMime && fileMime.startsWith("image/")) {
      parts.push({ inlineData: { mimeType: fileMime, data: fileB64 } });
    }
    parts.push({ text: userText });

    const key = requireGeminiKey();
    const assistantSystem = `You are VeriMedia Assistant, an expert in media authenticity, deepfake detection, and DMCA enforcement. Be concise and actionable. Use bullet points for lists.`;

    const body = {
      system_instruction: { parts: [{ text: assistantSystem }] },
      contents: [
        ...(window._vmaAssistantHistory || []),
        { role: "user", parts },
      ],
      generationConfig: { temperature: 0.4, maxOutputTokens: 1024 },
    };

    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "No response.";

    // Update conversation history
    window._vmaAssistantHistory = [
      ...(window._vmaAssistantHistory || []),
      { role: "user", parts: [{ text: userText }] },
      { role: "model", parts: [{ text: reply }] },
    ];

    return reply;
  };

  // Patch the existing vmaSend to use Gemini
  window._vmaOrigSend = window.vmaSend;
  window.vmaSend = async function () {
    const inp = document.getElementById("vma-input");
    if (!inp) { if (window._vmaOrigSend) return window._vmaOrigSend(); return; }
    const text = inp.value.trim();
    if (!text) return;

    inp.value = "";
    inp.style.height = "auto";

    const sugg = document.getElementById("vma-suggestions");
    if (sugg) sugg.style.display = "none";

    // Show user message
    if (typeof vmaUserMsg === "function") vmaUserMsg(text);

    // Get attached file
    let b64 = null, mime = null;
    if (window._vmaAttachedFileB64) { b64 = window._vmaAttachedFileB64; mime = window._vmaAttachedFileMime; window._vmaAttachedFileB64 = null; }

    const typingId = typeof vmaTyping === "function" ? vmaTyping() : null;
    const sendBtn = document.getElementById("vma-send");
    if (sendBtn) sendBtn.disabled = true;

    try {
      const reply = await window._vmaGeminiChat(text, b64, mime);
      if (typingId && typeof removeTyping === "function") removeTyping(typingId);
      if (typeof vmaBotMsg === "function") vmaBotMsg(reply);
    } catch (e) {
      if (typingId && typeof removeTyping === "function") removeTyping(typingId);
      if (typeof vmaBotMsg === "function") vmaBotMsg(`⚠️ Error: ${e.message}`);
    } finally {
      if (sendBtn) sendBtn.disabled = false;
      if (inp) inp.focus();
    }
  };

  // ─── V22 Decision Engine patch ─────────────────────────────────────────────
  // V22 calls Anthropic's API in callVeriMediaReasoning. We patch that too.
  // Since we already replaced window.fetch to intercept api.anthropic.com,
  // V22 calls will automatically route through our backend → Gemini.
  // No additional patching needed for V22.

  // ─── Init ─────────────────────────────────────────────────────────────────
  function init() {
    // Run branding update after DOM is ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", updateBranding);
    } else {
      updateBranding();
    }

    // Patch explanation injection after a short delay (lets existing code load first)
    setTimeout(() => {
      // If injectAIExplanation exists, wrap it so it uses our Gemini version
      if (typeof window.injectAIExplanation === "function") {
        const _orig = window.injectAIExplanation;
        window.injectAIExplanation = async function (cardKey, analysisData, fileInfo) {
          return window._vmaGeminiExplainPatch(cardKey, analysisData, fileInfo);
        };
      }
    }, 500);

    console.log("[VeriMedia Gemini Patch] ✅ Loaded — all Anthropic calls replaced with Gemini");
    console.log("[VeriMedia Gemini Patch] Key source:", getGeminiKey() ? "found" : "will prompt on first use");
  }

  init();
})();
