'use strict';

/**
 * AI Usage Tracker
 * ----------------
 * Persists AI request records to the `ai_requests` MySQL table.
 * Provides an audit trail for each AI request: who, what, when, outcome.
 *
 * Security:
 *   - Stores only non-sensitive metadata (userId, feature, latency, status).
 *   - Does NOT store: prompts, AI outputs, images, API keys, payment data.
 *   - userId is the integer primary key — no name, email, or PII stored here.
 *
 * Error handling:
 *   - Failures are logged and silently swallowed.
 *   - A tracking failure MUST NOT impact the AI response to the user.
 */

const aiLogger = require('../utils/aiLogger');

// Lazy pool loading to avoid circular dependencies at startup
let _pool = null;
function getPool() {
  if (!_pool) _pool = require('../../config/database');
  return _pool;
}

const AIUsageTracker = {
  /**
   * Record a single AI request to the database.
   * Non-blocking — errors are silently swallowed to protect the caller.
   *
   * @param {object} params
   * @param {string}  params.requestId      - AI request ID (ai_...)
   * @param {number}  [params.userId]       - Authenticated user ID
   * @param {string}  params.feature        - Feature ID (e.g. 'IMAGE_DIAGNOSIS')
   * @param {string}  params.provider       - Provider name
   * @param {string}  params.model          - Model identifier
   * @param {string}  params.status         - 'success'|'failure'|'timeout'|'rate_limited'
   * @param {number}  [params.latencyMs]    - Request latency in ms
   * @param {number}  [params.tokenUsage]   - Token count if available
   * @param {number}  [params.costUsd]      - Estimated cost if calculable
   * @param {string}  [params.errorCategory]- Error category on failure
   */
  async record({ requestId, userId, feature, provider, model, status, latencyMs, tokenUsage, costUsd, errorCategory }) {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO ai_requests
           (request_id, user_id, feature, provider, model, status, latency_ms, token_usage, cost_usd, error_category)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          requestId,
          userId || null,
          feature,
          provider || 'unknown',
          model    || 'unknown',
          status,
          latencyMs   || null,
          tokenUsage  || null,
          costUsd     || null,
          errorCategory || null,
        ]
      );
    } catch (err) {
      // Tracking failure must not affect the AI response
      aiLogger.warn({
        requestId,
        message:       `Usage tracking failed: ${err.message}`,
        status:        'tracking_error',
        errorCategory: 'INTERNAL',
      });
    }
  },

  /**
   * Retrieve usage summary for a specific user.
   * Used by future user-facing "My AI Usage" endpoint.
   * @param {number} userId
   * @param {number} [limit=50]
   * @returns {Promise<object[]>}
   */
  async getForUser(userId, limit = 50) {
    try {
      const pool = getPool();
      const [rows] = await pool.query(
        `SELECT request_id, feature, provider, model, status, latency_ms, token_usage, error_category, created_at
         FROM ai_requests
         WHERE user_id = ?
         ORDER BY created_at DESC
         LIMIT ?`,
        [userId, limit]
      );
      return rows;
    } catch (err) {
      aiLogger.warn({ message: `Usage fetch failed: ${err.message}`, status: 'tracking_error' });
      return [];
    }
  },

  /**
   * Retrieve aggregate usage statistics across all users.
   * For admin/monitoring use only. Deferred to future phase for auth.
   * @returns {Promise<object>}
   */
  async getAggregateSummary() {
    try {
      const pool = getPool();
      const [[summary]] = await pool.query(`
        SELECT
          COUNT(*)                                   AS total_requests,
          SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS total_successes,
          SUM(CASE WHEN status = 'failure' THEN 1 ELSE 0 END) AS total_failures,
          SUM(CASE WHEN status = 'timeout' THEN 1 ELSE 0 END) AS total_timeouts,
          AVG(latency_ms)                            AS avg_latency_ms,
          SUM(token_usage)                           AS total_tokens,
          SUM(cost_usd)                              AS total_cost_usd
        FROM ai_requests
        WHERE created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
      `);
      return summary;
    } catch (err) {
      aiLogger.warn({ message: `Aggregate summary failed: ${err.message}`, status: 'tracking_error' });
      return null;
    }
  },
};

module.exports = AIUsageTracker;
