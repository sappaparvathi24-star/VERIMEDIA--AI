/**
 * VeriMedia AI — Language Detection Module
 * Uses `franc` for statistical n-gram language identification with ISO 639 code output.
 */

import { franc } from 'franc';

const ISO3_TO_ISO1 = {
  eng: 'en',
  spa: 'es',
  fra: 'fr',
  deu: 'de',
  ita: 'it',
  por: 'pt',
  rus: 'ru',
  ukr: 'uk',
  ara: 'ar',
  cmn: 'zh',
  zho: 'zh',
  jpn: 'ja',
  kor: 'ko',
  hin: 'hi',
  nld: 'nl',
  pol: 'pl',
  tur: 'tr',
  pes: 'fa',
  heb: 'he',
  vie: 'vi',
  tha: 'th',
  ind: 'id',
  swe: 'sv',
  ell: 'el'
};

/**
 * Detects the language of input text and returns standard ISO 639 codes.
 *
 * @param {string} text - Input text statement.
 * @param {object} [options]
 * @returns {{
 *   language: string,
 *   iso639_3: string,
 *   iso639_1: string,
 *   isReliable: boolean,
 *   confidence: number
 * }}
 */
export function detectLanguage(text, options = {}) {
  const clean = typeof text === 'string' ? text.trim() : '';
  if (!clean || clean.length < 5) {
    return {
      language: 'und',
      iso639_3: 'und',
      iso639_1: 'und',
      isReliable: false,
      confidence: 0.15
    };
  }

  try {
    const minLength = options.minLength || 10;
    const iso639_3 = franc(clean, { minLength });
    const isReliable = iso639_3 !== 'und' && clean.length >= 20;
    const iso639_1 = ISO3_TO_ISO1[iso639_3] || (iso639_3.length === 3 ? iso639_3.slice(0, 2) : 'und');

    let confidence = isReliable ? 0.88 : (iso639_3 !== 'und' ? 0.65 : 0.20);
    // Hard clamp confidence within [0.15, 0.92] band
    confidence = Number(Math.max(0.15, Math.min(0.92, confidence)).toFixed(2));

    return {
      language: iso639_3,
      iso639_3,
      iso639_1,
      isReliable,
      confidence
    };
  } catch (err) {
    console.warn('[Language Detection] Detection exception, returning default:', err.message);
    return {
      language: 'und',
      iso639_3: 'und',
      iso639_1: 'und',
      isReliable: false,
      confidence: 0.15
    };
  }
}
