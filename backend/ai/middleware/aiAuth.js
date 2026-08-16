'use strict';

/**
 * AI Authentication & Authorization Middleware
 * --------------------------------------------
 * Wraps the existing HiFix `protect` middleware and adds AI-specific guards.
 * Does NOT reimplement authentication — delegates 100% to existing auth.js.
 *
 * Responsibilities:
 *   1. Check AI_ENABLED flag — return 503 Service Unavailable if disabled.
 *   2. Require authentication via existing `protect` middleware.
 *   3. (Future phases) Role-based AI feature access control.
 *
 * Modification rule: This file imports but does NOT modify middleware/auth.js.
 */

const { protect } = require('../../middleware/auth');
const aiConfig    = require('../config/aiConfig');
const { generateRequestId } = require('../utils/requestId');

/**
 * Middleware: Verify AI is enabled + user is authenticated.
 * Used on all AI endpoints.
 *
 * On success: populates req.aiRequestId for downstream use.
 * On failure: returns 503 (AI disabled) or 401 (not authenticated).
 */
exports.requireAI = [
  // Step 1: AI enabled guard — checked BEFORE token verification
  // to avoid unnecessary DB queries when AI is globally disabled.
  (req, res, next) => {
    if (!aiConfig.enabled) {
      return res.status(503).json({
        success: false,
        message: 'AI features are currently disabled.',
        code:    'AI_DISABLED',
      });
    }
    // Attach request ID for tracing through the request lifecycle
    req.aiRequestId = generateRequestId();
    next();
  },

  // Step 2: JWT authentication via existing HiFix protect middleware
  protect,
];

/**
 * Middleware: AI enabled guard ONLY (no authentication required).
 * Used on the public /api/ai/health endpoint.
 */
exports.requireAIEnabled = (req, res, next) => {
  if (!aiConfig.enabled) {
    return res.status(503).json({
      success: false,
      message: 'AI features are currently disabled.',
      code:    'AI_DISABLED',
    });
  }
  next();
};

/**
 * Middleware: Require authentication even when AI is disabled.
 * Used on /api/ai/status — authenticated users may check their own AI status.
 * Returns AI availability info without requiring AI to be enabled.
 */
exports.requireAuth = [protect];
