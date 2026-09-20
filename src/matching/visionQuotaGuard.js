// VeriMedia AI — Google Cloud Vision Free-Tier Usage Guard
// Ensures requests stay strictly within Google Vision's free 1,000 req/mo allowance
import { getDatabase } from '../db/database.js';

const MONTHLY_KEY_PREFIX = 'vision_quota_';
export const DEFAULT_MONTHLY_LIMIT = Number(process.env.GOOGLE_VISION_MONTHLY_LIMIT || 900);

// In-memory fallback / cache in case SQLite is inaccessible or in-memory
const memoryCounterCache = new Map();

function ensureTable(db) {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS usage_counters (
        counter_key TEXT PRIMARY KEY,
        count INTEGER NOT NULL DEFAULT 0,
        updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
      );
    `);
  } catch (err) {
    // Ignore if table already exists or DB read-only
  }
}

/**
 * Returns the current month key formatted as vision_quota_YYYY_M (UTC)
 */
export function getCurrentMonthKey() {
  const d = new Date();
  return `${MONTHLY_KEY_PREFIX}${d.getUTCFullYear()}_${d.getUTCMonth() + 1}`;
}

/**
 * Checks if Vision API can be invoked within the free-tier quota ceiling.
 */
export function canUseVisionApi() {
  const count = getMonthlyVisionCallCount();
  const limit = Number(process.env.GOOGLE_VISION_MONTHLY_LIMIT || DEFAULT_MONTHLY_LIMIT);
  return count < limit;
}

/**
 * Reads the monthly call count from SQLite or in-memory fallback.
 */
export function getMonthlyVisionCallCount(monthKey = getCurrentMonthKey()) {
  try {
    const db = getDatabase();
    if (db) {
      ensureTable(db);
      const row = db.prepare('SELECT count FROM usage_counters WHERE counter_key = ?').get(monthKey);
      if (row && typeof row.count === 'number') {
        memoryCounterCache.set(monthKey, row.count);
        return row.count;
      }
    }
  } catch (err) {
    // Fall back to memory counter
  }
  return memoryCounterCache.get(monthKey) || 0;
}

/**
 * Increments and persists the monthly counter for the Vision API.
 */
export function incrementVisionCallCount(monthKey = getCurrentMonthKey()) {
  let newCount = (memoryCounterCache.get(monthKey) || 0) + 1;
  try {
    const db = getDatabase();
    if (db) {
      ensureTable(db);
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO usage_counters (counter_key, count, updated_at)
        VALUES (?, 1, ?)
        ON CONFLICT(counter_key) DO UPDATE SET
          count = count + 1,
          updated_at = excluded.updated_at
      `).run(monthKey, now);

      const row = db.prepare('SELECT count FROM usage_counters WHERE counter_key = ?').get(monthKey);
      if (row && typeof row.count === 'number') {
        newCount = row.count;
      }
    }
  } catch (err) {
    // Fall back to memory cache update
  }
  memoryCounterCache.set(monthKey, newCount);
  return newCount;
}

/**
 * Sets the counter directly (useful for tests and administrative resets).
 */
export function setMonthlyVisionCallCount(count, monthKey = getCurrentMonthKey()) {
  const val = Math.max(0, Number(count) || 0);
  memoryCounterCache.set(monthKey, val);
  try {
    const db = getDatabase();
    if (db) {
      ensureTable(db);
      const now = new Date().toISOString();
      db.prepare(`
        INSERT INTO usage_counters (counter_key, count, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(counter_key) DO UPDATE SET
          count = excluded.count,
          updated_at = excluded.updated_at
      `).run(monthKey, val, now);
    }
  } catch (err) {
    // Memory cache set already
  }
  return val;
}

/**
 * Resets the monthly Vision call counter to 0.
 */
export function resetVisionQuota(monthKey = getCurrentMonthKey()) {
  return setMonthlyVisionCallCount(0, monthKey);
}
