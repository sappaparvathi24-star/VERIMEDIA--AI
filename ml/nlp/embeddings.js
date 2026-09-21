/**
 * VeriMedia AI — Text Embedding & Semantic Independence Grouping
 * Uses @xenova/transformers feature-extraction with Xenova/all-MiniLM-L6-v2.
 * Mean-pooled and L2-normalized 384-dimensional dense vectors.
 *
 * Provides Sybil / Repost Defense by merging reworded or syndicated
 * textual evidence into identical independence groups.
 */

import { cosineSimilarity } from '../embeddings/similarity.js';

export const INDEPENDENCE_TEXT_SIMILARITY_THRESHOLD = 0.88;

let embeddingPipeline = null;
let isInitializing = false;

/**
 * Lazy loads and caches the MiniLM-L6-v2 embedding pipeline singleton.
 */
async function getEmbeddingPipeline() {
  if (embeddingPipeline) return embeddingPipeline;
  if (isInitializing) {
    while (isInitializing) {
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    if (embeddingPipeline) return embeddingPipeline;
  }

  isInitializing = true;
  try {
    const { pipeline, env } = await import('@xenova/transformers');
    env.allowRemoteModels = true;
    embeddingPipeline = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2');
    return embeddingPipeline;
  } catch (err) {
    console.warn('[Embeddings] Transformer embedding pipeline initialization notice, will use fallback:', err.message);
    return null;
  } finally {
    isInitializing = false;
  }
}

/**
 * Deterministic pseudo-embedding fallback vector (384 dimensions, normalized).
 */
function fallbackEmbedText(text = '') {
  const clean = String(text || '').trim().toLowerCase();
  const vec = new Float32Array(384);
  if (!clean) {
    return Array.from(vec);
  }

  // Generate deterministic pseudo-embedding via character n-grams and polynomial rolling hash
  for (let i = 0; i < clean.length; i++) {
    const charCode = clean.charCodeAt(i);
    const bucket = (charCode * 31 + i * 17) % 384;
    vec[bucket] += (charCode / 255.0);
  }

  // L2 normalize
  let norm = 0;
  for (let i = 0; i < 384; i++) {
    norm += vec[i] * vec[i];
  }
  norm = Math.sqrt(norm);
  if (norm > 0) {
    for (let i = 0; i < 384; i++) {
      vec[i] /= norm;
    }
  }

  return Array.from(vec);
}

/**
 * Generates a mean-pooled, normalized 384-dimensional dense embedding for input text.
 *
 * @param {string} text
 * @param {object} [options]
 * @returns {Promise<number[]>}
 */
export async function embedText(text, options = {}) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean) {
    return fallbackEmbedText('');
  }

  try {
    const embedder = await getEmbeddingPipeline();
    if (!embedder) {
      return fallbackEmbedText(clean);
    }

    const output = await embedder(clean, {
      pooling: 'mean',
      normalize: true
    });

    if (output && output.data) {
      return Array.from(output.data);
    }
    return fallbackEmbedText(clean);
  } catch (err) {
    console.warn('[Embeddings] Inference error, using fallback embedding:', err.message);
    return fallbackEmbedText(clean);
  }
}

/**
 * Groups evidence items into semantic independence groups using pairwise embedding cosine similarity.
 * Evidence items exceeding INDEPENDENCE_TEXT_SIMILARITY_THRESHOLD (0.88) are merged into the same group.
 *
 * @param {Array<object>} evidenceList - Array of evidence objects with text/description/metadata.
 * @param {number} [threshold=INDEPENDENCE_TEXT_SIMILARITY_THRESHOLD]
 * @returns {Promise<{
 *   groups: Array<{ groupId: string, count: number, evidenceIds: string[] }>,
 *   groupCount: number,
 *   repostCollapses: Array<{ primaryId: string, duplicateId: string, similarity: number }>
 * }>}
 */
export async function groupEvidenceBySemanticIndependence(
  evidenceList = [],
  threshold = INDEPENDENCE_TEXT_SIMILARITY_THRESHOLD
) {
  if (!Array.isArray(evidenceList) || evidenceList.length === 0) {
    return { groups: [], groupCount: 0, repostCollapses: [] };
  }

  // 1. Extract text for each evidence item
  const items = evidenceList.map(ev => {
    const text = ev.metadata?.caption ||
      ev.metadata?.sourceText ||
      ev.metadata?.postText ||
      ev.description ||
      ev.title ||
      '';
    const baseGroupId = ev.independenceGroupId || `IG-${ev.id}`;
    return {
      id: ev.id,
      text: text.trim(),
      baseGroupId,
      embedding: null,
      assignedGroupId: baseGroupId
    };
  });

  // 2. Compute embeddings for items with substantial text
  for (const item of items) {
    if (item.text.length >= 15) {
      try {
        item.embedding = await embedText(item.text);
      } catch (_) {
        item.embedding = fallbackEmbedText(item.text);
      }
    }
  }

  // 3. Pairwise cosine similarity clustering & merging
  const repostCollapses = [];
  const parentMap = new Map();

  function getRoot(id) {
    if (!parentMap.has(id)) return id;
    const parent = parentMap.get(id);
    if (parent === id) return id;
    const root = getRoot(parent);
    parentMap.set(id, root);
    return root;
  }

  function union(idA, idB) {
    const rootA = getRoot(idA);
    const rootB = getRoot(idB);
    if (rootA !== rootB) {
      // Tie-break alphabetically for deterministic stability
      if (rootA < rootB) {
        parentMap.set(rootB, rootA);
      } else {
        parentMap.set(rootA, rootB);
      }
    }
  }

  // Compare all pairs
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      const itemA = items[i];
      const itemB = items[j];

      // If already same base group, union them
      if (itemA.baseGroupId === itemB.baseGroupId) {
        union(itemA.id, itemB.id);
        continue;
      }

      // Check semantic embedding similarity
      if (itemA.embedding && itemB.embedding) {
        const sim = cosineSimilarity(itemA.embedding, itemB.embedding);
        if (sim >= threshold) {
          union(itemA.id, itemB.id);
          repostCollapses.push({
            primaryId: itemA.id,
            duplicateId: itemB.id,
            similarity: Number(sim.toFixed(4)),
            threshold
          });
        }
      }
    }
  }

  // 4. Assemble final collapsed groups
  const groupsMap = new Map();
  for (const item of items) {
    const rootId = getRoot(item.id);
    const primaryItem = items.find(it => it.id === rootId) || item;
    const finalGroupId = primaryItem.baseGroupId || `IG-${rootId}`;

    if (!groupsMap.has(finalGroupId)) {
      groupsMap.set(finalGroupId, {
        groupId: finalGroupId,
        count: 0,
        evidenceIds: []
      });
    }

    const grp = groupsMap.get(finalGroupId);
    grp.count += 1;
    grp.evidenceIds.push(item.id);
  }

  const groups = Array.from(groupsMap.values());

  return {
    groups,
    groupCount: groups.length,
    repostCollapses
  };
}
