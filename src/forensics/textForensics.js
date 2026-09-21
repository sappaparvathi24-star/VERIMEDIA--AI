// VeriMedia AI — Text Forensics & NLP Engine
// Analyzes textual statements, documents, and transcripts
// Performs encoding detection, language identification, NER, claim extraction, and semantic embeddings.

import crypto from 'crypto';
import { detectLanguage } from '../../ml/nlp/langDetect.js';
import { extractEntities } from '../../ml/nlp/ner.js';
import { embedText } from '../../ml/nlp/embeddings.js';
import { createEngineResult, EngineStatus } from './analysisContract.js';

/**
 * Extracts salient claims from raw text by sentence splitting and filtering.
 */
function extractClaims(text) {
  if (!text) return [];
  // Split into sentences
  const sentences = text
    .replace(/([.?!])\s*(?=[A-Z])/g, "$1|")
    .split("|")
    .map(s => s.trim())
    .filter(s => s.length > 15 && s.length < 500);

  return sentences.slice(0, 10).map((sentence, idx) => ({
    id: `claim_${idx + 1}`,
    text: sentence,
    wordCount: sentence.split(/\s+/).length
  }));
}

/**
 * Executes comprehensive Text Forensic and NLP Analysis.
 * @param {string|Buffer} input - Text string or Buffer
 * @param {object} [opts]
 * @returns {Promise<object>} Canonical analysis contract result
 */
export async function analyzeText(input, opts = {}) {
  const startedAt = new Date().toISOString();

  try {
    let rawText = '';
    let buffer = null;

    if (Buffer.isBuffer(input)) {
      buffer = input;
      rawText = buffer.toString('utf-8');
    } else if (typeof input === 'string') {
      rawText = input;
      buffer = Buffer.from(rawText, 'utf-8');
    } else {
      return createEngineResult({
        engine: 'TEXT_FORENSICS',
        status: EngineStatus.FAILED,
        applicable: true,
        startedAt,
        completedAt: new Date().toISOString(),
        errors: ['Invalid text input: string or Buffer required'],
        realAnalysis: false
      });
    }

    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    const byteSize = buffer.length;
    const charCount = rawText.length;
    const wordCount = rawText.trim() ? rawText.trim().split(/\s+/).length : 0;
    const lineCount = rawText.split('\n').length;

    // 1. Language detection
    const langResult = detectLanguage(rawText);

    // 2. Named Entity Recognition (NER)
    let entities = [];
    try {
      const entResult = await extractEntities(rawText);
      if (entResult) {
        if (Array.isArray(entResult.people)) entities.push(...entResult.people.map(p => ({ text: p, type: 'PERSON' })));
        if (Array.isArray(entResult.organizations)) entities.push(...entResult.organizations.map(o => ({ text: o, type: 'ORGANIZATION' })));
        if (Array.isArray(entResult.locations)) entities.push(...entResult.locations.map(l => ({ text: l, type: 'LOCATION' })));
        if (Array.isArray(entResult.dates)) entities.push(...entResult.dates.map(d => ({ text: d, type: 'DATE' })));
      }
    } catch (nerErr) {
      console.warn('[textForensics] NER warning:', nerErr.message);
    }

    // 3. Claim extraction
    const claims = extractClaims(rawText);

    // 4. Semantic Embedding
    let embedding = null;
    try {
      const emb = await embedText(rawText.slice(0, 1000));
      if (Array.isArray(emb) && emb.length > 0) {
        embedding = emb;
      }
    } catch (embErr) {
      console.warn('[textForensics] Embedding warning:', embErr.message);
    }

    // 5. Build structured measurements and observations
    const measurements = [
      { name: 'sha256', value: sha256, type: 'CRYPTOGRAPHIC_HASH' },
      { name: 'byteSize', value: byteSize, unit: 'bytes' },
      { name: 'characterCount', value: charCount, unit: 'count' },
      { name: 'wordCount', value: wordCount, unit: 'count' },
      { name: 'lineCount', value: lineCount, unit: 'count' },
      { name: 'language', value: langResult.iso639_1 || langResult.language, type: 'LINGUISTIC_CODE' },
      { name: 'languageConfidence', value: langResult.confidence, unit: 'ratio' },
      { name: 'extractedEntityCount', value: entities.length, unit: 'count' },
      { name: 'extractedClaimCount', value: claims.length, unit: 'count' }
    ];

    if (embedding) {
      measurements.push({
        name: 'embeddingDimensions',
        value: embedding.length,
        unit: 'dimensions'
      });
    }

    const observations = [
      {
        category: 'LINGUISTIC_STRUCTURE',
        title: 'Language Identification',
        detail: `Identified language: ${langResult.language.toUpperCase()} (${langResult.iso639_1}) with confidence ${Number(langResult.confidence).toFixed(2)}`
      },
      {
        category: 'TEXT_VOLUME',
        title: 'Corpus Metrics',
        detail: `${wordCount} words across ${lineCount} lines (${charCount} characters)`
      }
    ];

    if (entities.length > 0) {
      const entityTypes = [...new Set(entities.map(e => e.type || e.category || 'ENTITY'))];
      observations.push({
        category: 'ENTITIES',
        title: 'Named Entities Extracted',
        detail: `Identified ${entities.length} named entities spanning [${entityTypes.join(', ')}]: ${entities.slice(0, 5).map(e => `${e.text} (${e.type || 'ENTITY'})`).join(', ')}`
      });
    }

    if (claims.length > 0) {
      observations.push({
        category: 'CLAIMS',
        title: 'Factual Claims Extracted',
        detail: `Isolated ${claims.length} candidate factual assertion statements for verification.`
      });
    }

    const limitations = [
      'Textual polarity and claim extraction based on NLP sentence structures and zero-shot transformer heuristics.',
      'Corpus analysis does not assert external historical accuracy without corroborated source records.'
    ];

    return createEngineResult({
      engine: 'TEXT_FORENSICS',
      status: EngineStatus.COMPLETED,
      applicable: true,
      startedAt,
      completedAt: new Date().toISOString(),
      observations,
      measurements,
      evidenceIds: [`ev_txt_${sha256.substring(0, 12)}`],
      limitations,
      source: 'LOCAL_NLP_TEXT_ENGINE',
      realAnalysis: true,
      extra: {
        language: langResult,
        entities,
        claims,
        hasEmbedding: Boolean(embedding),
        embedding: embedding ? embedding.slice(0, 32) : null // Store truncated preview in contract
      }
    });
  } catch (err) {
    return createEngineResult({
      engine: 'TEXT_FORENSICS',
      status: EngineStatus.FAILED,
      applicable: true,
      startedAt,
      completedAt: new Date().toISOString(),
      errors: [err.message],
      realAnalysis: true
    });
  }
}
