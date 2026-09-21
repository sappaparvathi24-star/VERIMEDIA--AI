/**
 * VeriMedia AI — Named Entity Recognition (NER)
 * Uses @xenova/transformers token-classification with Xenova/bert-base-NER.
 * Extracts: people, organizations, locations, and dates.
 *
 * Epistemic & Operational Guarantees:
 * - Lazy-loaded and cached singleton pipeline.
 * - Robust subtoken recombination (handles B-/I- prefixes and ## WordPiece tokens).
 * - Safe rule-based regex fallback if model inference is unavailable.
 */

let nerPipeline = null;
let isInitializing = false;

/**
 * Lazy loads and caches the BERT NER pipeline singleton.
 */
async function getNERPipeline() {
  if (nerPipeline) return nerPipeline;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (nerPipeline) return nerPipeline;
  }

  isInitializing = true;
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowRemoteModels = true;
    const loadPromise = pipeline('token-classification', 'Xenova/bert-base-NER');
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Model fetch timeout')), 2500)
    );
    nerPipeline = await Promise.race([loadPromise, timeoutPromise]);
    return nerPipeline;
  } catch (err) {
    console.warn('[NER Engine] Pipeline initialization notice, will use fallback:', err.message);
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Extracts date patterns from text via standard regex patterns.
 */
function extractDatesFromText(text = '') {
  const dates = new Set();
  if (!text) return [];

  // Patterns for ISO dates, Month Day Year, Day Month Year, and 4-digit years in context
  const datePatterns = [
    /\b(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2}(?:st|nd|rd|th)?(?:,?\s+\d{4})?\b/gi,
    /\b\d{1,2}\s+(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}\b/gi,
    /\b\d{4}-\d{2}-\d{2}\b/g,
    /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/g,
    /\b(?:19|20)\d{2}\b/g
  ];

  for (const pattern of datePatterns) {
    const matches = text.match(pattern);
    if (matches) {
      for (const m of matches) {
        const clean = m.trim();
        if (clean.length >= 4) {
          dates.add(clean);
        }
      }
    }
  }

  return Array.from(dates);
}

/**
 * Heuristic entity extraction fallback.
 */
function fallbackExtractEntities(text = '') {
  const people = new Set();
  const organizations = new Set();
  const locations = new Set();
  const dates = extractDatesFromText(text);

  if (!text || typeof text !== 'string') {
    return { people: [], organizations: [], locations: [], dates: [] };
  }

  // Common organization suffixes
  const orgPattern = /\b([A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*\s+(?:Corp|Inc|Ltd|LLC|GmbH|Foundation|Agency|Department|Police|Military|News|Times|Post|Reuters|AP|BBC|CNN|UN|NATO|EU))\b/g;
  let match;
  while ((match = orgPattern.exec(text)) !== null) {
    organizations.add(match[1].trim());
  }

  // Common known locations
  const knownLocations = [
    'United States', 'US', 'USA', 'UK', 'United Kingdom', 'Russia', 'Ukraine', 'China',
    'Israel', 'Gaza', 'Palestine', 'France', 'Germany', 'Paris', 'London', 'Washington',
    'New York', 'Tokyo', 'Beijing', 'Moscow', 'Kyiv', 'Berlin', 'Rome', 'Madrid', 'Atlantic'
  ];
  for (const loc of knownLocations) {
    const reg = new RegExp(`\\b${loc}\\b`, 'g');
    if (reg.test(text)) {
      locations.add(loc);
    }
  }

  // Capitalized multi-word phrases as candidate persons
  const namePattern = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+))\b/g;
  while ((match = namePattern.exec(text)) !== null) {
    const candidate = match[1].trim();
    if (!locations.has(candidate) && !organizations.has(candidate)) {
      people.add(candidate);
    }
  }

  return {
    people: Array.from(people),
    organizations: Array.from(organizations),
    locations: Array.from(locations),
    dates
  };
}

/**
 * Extracts named entities (people, organizations, locations, dates) from input text.
 *
 * @param {string} text - The input statement or document excerpt.
 * @param {object} [options]
 * @returns {Promise<{
 *   people: string[],
 *   organizations: string[],
 *   locations: string[],
 *   dates: string[]
 * }>}
 */
export async function extractEntities(text, options = {}) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) {
    return { people: [], organizations: [], locations: [], dates: [] };
  }

  const dates = extractDatesFromText(clean);

  try {
    const classifier = await getNERPipeline();
    if (!classifier) {
      return fallbackExtractEntities(clean);
    }

    const tokens = await classifier(clean);
    if (!Array.isArray(tokens) || tokens.length === 0) {
      return { people: [], organizations: [], locations: [], dates };
    }

    const people = new Set();
    const organizations = new Set();
    const locations = new Set();

    let currentEntity = null;
    let currentType = null;

    function flushCurrent() {
      if (currentEntity && currentType) {
        const entityName = currentEntity.replace(/\s*##/g, '').trim();
        if (entityName.length > 1) {
          if (currentType === 'PER') people.add(entityName);
          else if (currentType === 'ORG') organizations.add(entityName);
          else if (currentType === 'LOC') locations.add(entityName);
        }
      }
      currentEntity = null;
      currentType = null;
    }

    for (const t of tokens) {
      const entityTag = t.entity || '';
      const word = t.word || '';

      if (entityTag.startsWith('B-')) {
        flushCurrent();
        currentType = entityTag.slice(2);
        currentEntity = word;
      } else if (entityTag.startsWith('I-') && currentType === entityTag.slice(2)) {
        if (word.startsWith('##')) {
          currentEntity += word.slice(2);
        } else {
          currentEntity += ' ' + word;
        }
      } else {
        flushCurrent();
      }
    }
    flushCurrent();

    return {
      people: Array.from(people),
      organizations: Array.from(organizations),
      locations: Array.from(locations),
      dates
    };
  } catch (err) {
    console.warn('[NER Engine] Inference exception, using fallback:', err.message);
    return fallbackExtractEntities(clean);
  }
}
