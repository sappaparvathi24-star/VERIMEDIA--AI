/**
 * VeriMedia AI — Frontend API Client
 * 
 * ALL analysis calls go to YOUR backend (Render).
 * No AI API keys are ever used in the browser.
 * This fixes the CORS error completely.
 */

const BACKEND_URL = "https://verimedia-ai-backend.onrender.com";

/**
 * Analyze media content for authenticity
 * @param {File|string} input - File object or URL string
 * @returns {Promise<AnalysisResult>}
 */
export async function analyzeMedia(input) {
  let body;

  if (input instanceof File) {
    // Convert file to base64
    const b64 = await fileToBase64(input);
    body = {
      content_type: "image",
      data: b64,
      mime_type: input.type,
      filename: input.name,
    };
  } else if (typeof input === "string" && input.startsWith("http")) {
    body = {
      content_type: "url",
      url: input,
    };
  } else if (typeof input === "string") {
    body = {
      content_type: "text",
      text: input,
    };
  } else {
    throw new Error("Invalid input: must be a File, URL string, or text string");
  }

  const res = await fetch(`${BACKEND_URL}/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // NO anthropic headers here — those stay on the server
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: "Unknown error" }));
    throw new Error(err.detail || `Server error ${res.status}`);
  }

  return res.json();
}

/**
 * Generate a DMCA takedown notice
 */
export async function generateDMCA({ ownerName, ownerEmail, originalWork, infringingUrl, platform }) {
  const res = await fetch(`${BACKEND_URL}/dmca/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      owner_name: ownerName,
      owner_email: ownerEmail,
      original_work_description: originalWork,
      infringing_url: infringingUrl,
      platform: platform || "unknown",
    }),
  });

  if (!res.ok) throw new Error(`DMCA generation failed: ${res.status}`);
  return res.json();
}

/**
 * Health check
 */
export async function checkBackendHealth() {
  const res = await fetch(`${BACKEND_URL}/health`);
  return res.json();
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
