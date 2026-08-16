'use strict';

/**
 * AI Standard Response Builder
 * ----------------------------
 * Creates the canonical response shape returned by the AI gateway
 * to all callers (controllers, services, tests).
 *
 * All AI responses in HiFix conform to this structure:
 * {
 *   success:    boolean,
 *   requestId:  string,
 *   feature:    string,
 *   result:     object | null,
 *   confidence: number | null,
 *   model:      string,
 *   provider:   string,
 *   latencyMs:  number,
 *   cached:     boolean,
 *   error:      null | { category: string, message: string }
 * }
 *
 * This is placed in the HTTP response as: { success, data: AIResponse, message }
 * to match the existing HiFix API convention.
 */

class AIResponse {
  /**
   * Build a successful AI response.
   *
   * @param {object} params
   * @param {string}   params.requestId    - Unique request ID from requestId.js
   * @param {string}   params.feature      - AI feature identifier (from promptRegistry)
   * @param {object}   params.result       - The processed AI output
   * @param {number}   [params.confidence] - Confidence score 0–1 (feature-dependent)
   * @param {string}   params.model        - Model identifier
   * @param {string}   params.provider     - Provider name
   * @param {number}   params.latencyMs    - Total request latency in ms
   * @param {boolean}  [params.cached]     - Whether response was served from cache
   * @param {number}   [params.tokenUsage] - Token count if reported by provider
   * @returns {object}
   */
  static success({ requestId, feature, result, confidence = null, model, provider, latencyMs, cached = false, tokenUsage }) {
    return {
      success:    true,
      requestId,
      feature,
      result:     result ?? null,
      confidence: typeof confidence === 'number' ? confidence : null,
      model,
      provider,
      latencyMs:  Math.round(latencyMs),
      cached,
      tokenUsage: tokenUsage ?? null,
      error:      null,
    };
  }

  /**
   * Build a failure AI response.
   * AI failures NEVER throw — they return a safe structured error.
   * Existing HiFix functionality is not affected.
   *
   * @param {object} params
   * @param {string}   params.requestId     - Unique request ID
   * @param {string}   params.feature       - AI feature identifier
   * @param {string}   params.errorCategory - Standardized error category (see ERROR_CATEGORIES)
   * @param {string}   params.errorMessage  - Human-readable message (no sensitive data)
   * @param {string}   [params.model]       - Model identifier if known
   * @param {string}   [params.provider]    - Provider name if known
   * @param {number}   [params.latencyMs]   - Latency if measurable
   * @returns {object}
   */
  static failure({ requestId, feature, errorCategory, errorMessage, model = 'unknown', provider = 'unknown', latencyMs = 0 }) {
    return {
      success:    false,
      requestId,
      feature,
      result:     null,
      confidence: null,
      model,
      provider,
      latencyMs:  Math.round(latencyMs),
      cached:     false,
      tokenUsage: null,
      error: {
        category: errorCategory,
        message:  errorMessage,
      },
    };
  }

  /**
   * Build a "service unavailable" response for when AI_ENABLED=false.
   * @param {string} requestId
   * @param {string} feature
   * @returns {object}
   */
  static unavailable(requestId, feature) {
    return AIResponse.failure({
      requestId,
      feature,
      errorCategory: 'AI_DISABLED',
      errorMessage:  'AI features are currently disabled. Contact your administrator.',
      latencyMs:     0,
    });
  }

  /**
   * Build a "rate limited" response.
   * @param {string} requestId
   * @param {string} feature
   * @returns {object}
   */
  static rateLimited(requestId, feature) {
    return AIResponse.failure({
      requestId,
      feature,
      errorCategory: 'RATE_LIMITED',
      errorMessage:  'Too many AI requests. Please wait before trying again.',
      latencyMs:     0,
    });
  }
}

/**
 * Standardized error categories used across the AI infrastructure.
 * These are safe to expose to the client.
 */
const AI_ERROR_CATEGORIES = Object.freeze({
  AI_DISABLED:         'AI_DISABLED',
  RATE_LIMITED:        'RATE_LIMITED',
  TIMEOUT:             'TIMEOUT',
  PROVIDER_ERROR:      'PROVIDER_ERROR',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  AUTH_FAILURE:        'AUTH_FAILURE',
  INVALID_REQUEST:     'INVALID_REQUEST',
  MODEL_NOT_FOUND:     'MODEL_NOT_FOUND',
  QUOTA_EXCEEDED:      'QUOTA_EXCEEDED',
  INVALID_RESPONSE:    'INVALID_RESPONSE',
  UNKNOWN_ERROR:       'UNKNOWN_ERROR',
});

module.exports = { AIResponse, AI_ERROR_CATEGORIES };
