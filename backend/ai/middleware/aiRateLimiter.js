'use strict';

/**
 * AI-Specific Rate Limiter
 * ------------------------
 * In-memory sliding window rate limiter for AI endpoints.
 * Separate from any global rate limiting on the existing HiFix application.
 * Does NOT interfere with existing routes.
 *
 * Separate limits for:
 *   - homeowner users (AI_RATE_LIMIT_USER requests per window)
 *   - worker users   (AI_RATE_LIMIT_WORKER requests per window)
 *   - image requests (AI_RATE_LIMIT_IMAGE image requests per window)
 *
 * Storage: In-process Map (same pattern as OTP store in auth.js).
 * No Redis required. If the app ever runs in multi-process mode (PM2 cluster),
 * this would need upgrading — flagged as a known limitation.
 *
 * Returns 429 with Retry-After header on limit exceeded.
 */

const aiConfig = require('../config/aiConfig');
const AIMonitor = require('../monitoring/AIMonitor');
const { generateRequestId } = require('../utils/requestId');

// Map: userId (string) → { requests: number[], windowStart: number }
// 'requests' is an array of timestamps within the current window.
const _rateLimitStore = new Map();

// Periodic cleanup: remove stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - aiConfig.rateLimitWindowMs;
  for (const [key, record] of _rateLimitStore.entries()) {
    if (record.windowStart < cutoff) {
      _rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000).unref();

/**
 * Get the applicable rate limit for a user role.
 * @param {string} userType - 'homeowner' | 'worker'
 * @param {boolean} isImage - whether this is an image request
 * @returns {number}
 */
function getLimitForUser(userType, isImage) {
  if (isImage) return aiConfig.rateLimitImage;
  return userType === 'worker' ? aiConfig.rateLimitWorker : aiConfig.rateLimitUser;
}

/**
 * Check and record a rate limit attempt.
 * Returns { allowed: boolean, remaining: number, retryAfterMs: number }
 *
 * @param {string} userId
 * @param {string} userType
 * @param {boolean} isImage
 * @returns {{ allowed: boolean, remaining: number, retryAfterMs: number }}
 */
function checkLimit(userId, userType, isImage) {
  const limit     = getLimitForUser(userType, isImage);
  const windowMs  = aiConfig.rateLimitWindowMs;
  const now       = Date.now();
  const key       = `${userId}:${isImage ? 'image' : 'text'}`;

  let record = _rateLimitStore.get(key);

  if (!record) {
    record = { requests: [], windowStart: now };
    _rateLimitStore.set(key, record);
  }

  // Slide window: remove timestamps older than the window
  const windowStart = now - windowMs;
  record.requests = record.requests.filter(ts => ts > windowStart);

  if (record.requests.length >= limit) {
    // Find oldest request to calculate retry-after
    const oldest      = record.requests[0];
    const retryAfterMs = windowMs - (now - oldest);
    return {
      allowed:      false,
      remaining:    0,
      retryAfterMs: Math.max(0, retryAfterMs),
    };
  }

  // Record this request
  record.requests.push(now);
  record.windowStart = now;

  return {
    allowed:      true,
    remaining:    limit - record.requests.length,
    retryAfterMs: 0,
  };
}

/**
 * Express middleware factory for AI rate limiting.
 *
 * @param {object} [options]
 * @param {boolean} [options.isImage=false] - Whether this is an image endpoint
 * @returns {Function} Express middleware
 */
function aiRateLimiter(options = {}) {
  const isImage = Boolean(options.isImage);

  return (req, res, next) => {
    // Rate limiting requires authentication — if not authenticated, skip
    // (auth middleware will handle the 401 before this matters)
    if (!req.user) return next();

    const userId   = String(req.user.id);
    const userType = req.user.user_type || 'homeowner';

    const { allowed, remaining, retryAfterMs } = checkLimit(userId, userType, isImage);

    // Set informational headers on all responses
    res.set('X-AI-RateLimit-Remaining', String(remaining));

    if (!allowed) {
      const retryAfterSec = Math.ceil(retryAfterMs / 1000);
      res.set('Retry-After', String(retryAfterSec));

      const feature = req.path.split('/').pop() || 'unknown';
      AIMonitor.recordRateLimited(feature);

      return res.status(429).json({
        success: false,
        message: `AI rate limit exceeded. Please wait ${retryAfterSec}s before retrying.`,
        code:    'AI_RATE_LIMITED',
        retryAfterSec,
      });
    }

    next();
  };
}

/**
 * Clear rate limit store. Used in tests only.
 * @private
 */
function _clearForTesting() {
  _rateLimitStore.clear();
}

module.exports = { aiRateLimiter, checkLimit, getLimitForUser, _clearForTesting };
