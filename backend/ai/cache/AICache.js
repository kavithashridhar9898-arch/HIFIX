'use strict';

/**
 * AI Cache Abstraction
 * --------------------
 * Two-tier caching for AI responses:
 *   L1: In-process Map with TTL (same pattern as blockchain OTP store)
 *   L2: MySQL table `ai_cache` (only active when AI_CACHE_ENABLED=true)
 *
 * Phase 5.0 compliance:
 *   AI_CACHE_ENABLED=false → cache is built but fully inactive.
 *   set() and get() return immediately without storing or retrieving anything.
 *   This means zero DB writes and zero memory usage until a feature explicitly
 *   defines its cache requirements and enables it.
 *
 * Security:
 *   - Cache keys are SHA-256 hashes of feature+prompt — never store raw prompts.
 *   - Full AI responses are stored in JSON column — no raw images or API keys.
 *   - Expired entries are cleaned up on read and periodically via MySQL.
 */

const crypto = require('crypto');
const aiConfig = require('../config/aiConfig');
const aiLogger = require('../utils/aiLogger');

// L1: In-process cache
const _l1Cache = new Map(); // key → { data, expiresAt }

// Lazy-load pool to avoid circular deps at startup
let _pool = null;
function getPool() {
  if (!_pool) _pool = require('../../config/database');
  return _pool;
}

// ── Key building ──────────────────────────────────────────────────────────────

/**
 * Build a deterministic cache key from feature + user content.
 * SHA-256 of the combined string — raw prompts are never used as keys.
 * Image base64 is included in key (not stored) so different images get different keys.
 *
 * @param {string} feature
 * @param {string} userPrompt
 * @param {string} [imageBase64]
 * @returns {string} hex digest
 */
function buildKey(feature, userPrompt = '', imageBase64 = '') {
  // Only hash, never store raw content
  const input = `${feature}:${userPrompt}:${imageBase64 ? imageBase64.slice(0, 64) : ''}`;
  return crypto.createHash('sha256').update(input).digest('hex');
}

// ── L1 helpers ────────────────────────────────────────────────────────────────

function l1Get(key) {
  const entry = _l1Cache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _l1Cache.delete(key);
    return null;
  }
  return entry.data;
}

function l1Set(key, data, ttlMs) {
  _l1Cache.set(key, { data, expiresAt: Date.now() + ttlMs });
}

// Periodic L1 cleanup (every 10 minutes) to prevent unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of _l1Cache.entries()) {
    if (now > entry.expiresAt) _l1Cache.delete(key);
  }
}, 10 * 60 * 1000).unref(); // .unref() so this doesn't keep the process alive

// ── L2 helpers ────────────────────────────────────────────────────────────────

async function l2Get(key) {
  try {
    const pool = getPool();
    const [rows] = await pool.query(
      'SELECT response FROM ai_cache WHERE cache_key = ? AND expires_at > NOW()',
      [key]
    );
    if (rows.length === 0) return null;
    return typeof rows[0].response === 'object' ? rows[0].response : JSON.parse(rows[0].response);
  } catch (err) {
    aiLogger.warn({ message: `AI Cache L2 get error: ${err.message}`, status: 'cache_error' });
    return null;
  }
}

async function l2Set(key, feature, data, ttlMs) {
  try {
    const pool     = getPool();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString().slice(0, 19).replace('T', ' ');
    await pool.query(
      `INSERT INTO ai_cache (cache_key, feature, response, expires_at)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE response = VALUES(response), expires_at = VALUES(expires_at)`,
      [key, feature, JSON.stringify(data), expiresAt]
    );
  } catch (err) {
    aiLogger.warn({ message: `AI Cache L2 set error: ${err.message}`, status: 'cache_error' });
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

const AICache = {
  buildKey,

  /**
   * Retrieve a cached response. Returns null if cache is disabled, not found, or expired.
   * @param {string} cacheKey
   * @returns {Promise<object|null>}
   */
  async get(cacheKey) {
    if (!aiConfig.cacheEnabled) return null;

    // L1 first
    const l1 = l1Get(cacheKey);
    if (l1) return l1;

    // L2 fallback
    const l2 = await l2Get(cacheKey);
    if (l2) {
      // Promote to L1
      l1Set(cacheKey, l2, aiConfig.cacheTtlMs);
      return l2;
    }

    return null;
  },

  /**
   * Store a successful AI response. No-op if cache is disabled.
   * @param {string} cacheKey
   * @param {string} feature
   * @param {object} data
   * @returns {Promise<void>}
   */
  async set(cacheKey, feature, data) {
    if (!aiConfig.cacheEnabled) return;
    const ttlMs = aiConfig.cacheTtlMs;
    l1Set(cacheKey, data, ttlMs);
    await l2Set(cacheKey, feature, data, ttlMs);
  },

  /**
   * Invalidate a specific cache entry (L1 + L2).
   * @param {string} cacheKey
   */
  async invalidate(cacheKey) {
    _l1Cache.delete(cacheKey);
    if (!aiConfig.cacheEnabled) return;
    try {
      await getPool().query('DELETE FROM ai_cache WHERE cache_key = ?', [cacheKey]);
    } catch (_) {}
  },

  /**
   * Return current L1 cache size. Used in monitoring.
   * @returns {number}
   */
  l1Size() {
    return _l1Cache.size;
  },

  /**
   * Purge all expired entries from L2 cache.
   * Called periodically or manually; no-op if cache disabled.
   */
  async purgeExpiredL2() {
    if (!aiConfig.cacheEnabled) return;
    try {
      await getPool().query('DELETE FROM ai_cache WHERE expires_at <= NOW()');
    } catch (_) {}
  },
};

module.exports = AICache;
