'use strict';

/**
 * AI Gateway — Central AI Request Orchestrator
 * --------------------------------------------
 * THE ONLY entry point into the AI provider layer.
 * No other module (controller, service, route) may call a provider directly.
 *
 * Responsibilities:
 *   1. Provider selection (via factory)
 *   2. Request ID generation
 *   3. AI disabled guard
 *   4. Input validation hook
 *   5. Cache lookup (L1 → L2)
 *   6. Prompt resolution (from registry)
 *   7. Timeout enforcement (Promise.race)
 *   8. Retry logic (exponential backoff)
 *   9. Response normalization (→ AIResponse)
 *  10. Usage tracking (→ ai_requests table)
 *  11. Monitoring counter updates
 *  12. Structured logging (→ aiLogger)
 *  13. Cache store on success
 *  14. Error isolation — NEVER propagates provider exceptions to callers
 *
 * Architecture:
 *   Controller → AIGateway.request() → Provider → AIResponse
 *                     ↓
 *            AIMonitor + AICache + aiLogger + AIUsageTracker
 */

const aiConfig          = require('../config/aiConfig');
const { createProvider } = require('../providers/index');
const { AIResponse, AI_ERROR_CATEGORIES } = require('./AIResponse');
const { generateRequestId } = require('../utils/requestId');
const aiLogger          = require('../utils/aiLogger');
const AICache           = require('../cache/AICache');
const AIMonitor         = require('../monitoring/AIMonitor');
const AIUsageTracker    = require('../monitoring/AIUsageTracker');
const promptRegistry    = require('../prompts/promptRegistry');

// ── Retry helper ──────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Exponential backoff delay in ms for attempt N (1-based).
 * Attempt 1: retryDelayMs × 1, Attempt 2: × 2, Attempt 3: × 4, …
 */
function retryDelay(attempt) {
  return aiConfig.retryDelayMs * Math.pow(2, attempt - 1);
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────

/**
 * Wraps a promise with a hard timeout.
 * Rejects with error category 'TIMEOUT' if the promise does not settle in time.
 */
function withTimeout(promise, ms) {
  const timeoutPromise = new Promise((_, reject) => {
    const id = setTimeout(() => {
      clearTimeout(id);
      const err = new Error(`AI provider request timed out after ${ms}ms`);
      err.errorCategory = AI_ERROR_CATEGORIES.TIMEOUT;
      reject(err);
    }, ms);
  });
  return Promise.race([promise, timeoutPromise]);
}

// ── Main Gateway ──────────────────────────────────────────────────────────────

const AIGateway = {

  /**
   * Primary entry point for ALL AI feature requests.
   *
   * @param {object} params
   * @param {string}   params.feature      - Feature ID from promptRegistry (e.g. 'IMAGE_DIAGNOSIS')
   * @param {string}   [params.userPrompt] - Dynamic user content to inject into prompt
   * @param {string}   [params.imageBase64]    - For vision requests
   * @param {string}   [params.imageMimeType]  - For vision requests
   * @param {number}   [params.userId]     - Authenticated user ID for tracking
   * @param {object}   [params.options]    - Per-request overrides (maxTokens, temperature, model)
   * @param {boolean}  [params.useCache]   - Override cache behaviour (default: aiConfig.cacheEnabled)
   * @returns {Promise<object>}  Always resolves with an AIResponse — never rejects.
   */
  async request({ feature, userPrompt = '', imageBase64, imageMimeType, userId, options = {}, useCache }) {
    const requestId = generateRequestId();
    const startTime = Date.now();

    // ── 1. AI disabled guard ───────────────────────────────────────────────
    if (!aiConfig.enabled) {
      AIMonitor.recordDisabled(feature);
      return AIResponse.unavailable(requestId, feature);
    }

    // ── 2. Prompt resolution ───────────────────────────────────────────────
    const promptDef = promptRegistry.get(feature);
    if (!promptDef) {
      aiLogger.error({ requestId, feature, userId, message: `Unknown feature: ${feature}` });
      return AIResponse.failure({
        requestId, feature,
        errorCategory: AI_ERROR_CATEGORIES.INVALID_REQUEST,
        errorMessage:  `Unknown AI feature: ${feature}`,
      });
    }

    aiLogger.requestStart({ requestId, feature, userId });
    AIMonitor.recordRequest(feature);

    // ── 3. Cache lookup ────────────────────────────────────────────────────
    const shouldUseCache = useCache ?? aiConfig.cacheEnabled;
    if (shouldUseCache) {
      const cacheKey = AICache.buildKey(feature, userPrompt, imageBase64);
      const cached   = await AICache.get(cacheKey);
      if (cached) {
        AIMonitor.recordCacheHit(feature);
        aiLogger.info({ requestId, feature, userId, cached: true, message: 'Cache hit' });
        return { ...cached, requestId, cached: true };
      }
    }

    // ── 4. Provider selection ──────────────────────────────────────────────
    let provider;
    try {
      provider = createProvider();
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      aiLogger.requestFailure({ requestId, feature, userId, errorCategory: 'PROVIDER_UNAVAILABLE', message: err.message, latencyMs });
      AIMonitor.recordFailure(feature, 'PROVIDER_UNAVAILABLE');
      await AIUsageTracker.record({ requestId, userId, feature, provider: aiConfig.provider, model: aiConfig.model, status: 'failure', latencyMs, errorCategory: 'PROVIDER_UNAVAILABLE' });
      return AIResponse.failure({ requestId, feature, errorCategory: AI_ERROR_CATEGORIES.PROVIDER_UNAVAILABLE, errorMessage: 'AI provider is not available', latencyMs });
    }

    // ── 5. Request with retry + timeout ───────────────────────────────────
    const isVision = Boolean(imageBase64);
    let providerResponse;
    let lastErrorCategory = AI_ERROR_CATEGORIES.UNKNOWN_ERROR;
    let lastErrorMessage  = 'Unknown error';

    for (let attempt = 1; attempt <= aiConfig.maxRetries; attempt++) {
      try {
        const callPromise = isVision
          ? provider.completeWithVision({
              systemPrompt:  promptDef.systemPrompt,
              userPrompt:    promptDef.buildUserPrompt ? promptDef.buildUserPrompt(userPrompt) : userPrompt,
              imageBase64,
              imageMimeType: imageMimeType || 'image/jpeg',
              options:       { ...promptDef.defaultOptions, ...options },
            })
          : provider.complete({
              systemPrompt: promptDef.systemPrompt,
              userPrompt:   promptDef.buildUserPrompt ? promptDef.buildUserPrompt(userPrompt) : userPrompt,
              options:      { ...promptDef.defaultOptions, ...options },
            });

        providerResponse = await withTimeout(callPromise, aiConfig.timeoutMs);

        if (providerResponse.success) {
          break; // Success — exit retry loop
        }

        // Non-success from provider
        lastErrorCategory = providerResponse.errorCode || AI_ERROR_CATEGORIES.PROVIDER_ERROR;
        lastErrorMessage  = providerResponse.errorMessage || 'Provider returned failure';

        // Do not retry rate-limit or auth errors — they will not resolve with retry
        if ([AI_ERROR_CATEGORIES.RATE_LIMITED, AI_ERROR_CATEGORIES.AUTH_FAILURE].includes(lastErrorCategory)) {
          break;
        }

        if (attempt < aiConfig.maxRetries) {
          await sleep(retryDelay(attempt));
        }

      } catch (err) {
        lastErrorCategory = err.errorCategory || AI_ERROR_CATEGORIES.PROVIDER_ERROR;
        lastErrorMessage  = err.message || 'Provider threw an exception';

        if (lastErrorCategory === AI_ERROR_CATEGORIES.TIMEOUT) {
          const latencyMs = Date.now() - startTime;
          aiLogger.timeout({ requestId, feature, userId, provider: provider.getName(), model: provider.getModel(), latencyMs });
          AIMonitor.recordTimeout(feature);
          await AIUsageTracker.record({ requestId, userId, feature, provider: provider.getName(), model: provider.getModel(), status: 'timeout', latencyMs, errorCategory: 'TIMEOUT' });
          return AIResponse.failure({ requestId, feature, errorCategory: AI_ERROR_CATEGORIES.TIMEOUT, errorMessage: 'Request timed out', model: provider.getModel(), provider: provider.getName(), latencyMs });
        }

        if (attempt < aiConfig.maxRetries) {
          await sleep(retryDelay(attempt));
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    // ── 6. Handle final failure (all retries exhausted or non-retryable) ──
    if (!providerResponse || !providerResponse.success) {
      aiLogger.requestFailure({ requestId, feature, userId, provider: provider.getName(), model: provider.getModel(), latencyMs, errorCategory: lastErrorCategory, message: lastErrorMessage });
      AIMonitor.recordFailure(feature, lastErrorCategory);
      await AIUsageTracker.record({ requestId, userId, feature, provider: provider.getName(), model: provider.getModel(), status: 'failure', latencyMs, errorCategory: lastErrorCategory });
      return AIResponse.failure({ requestId, feature, errorCategory: lastErrorCategory, errorMessage: lastErrorMessage, model: provider.getModel(), provider: provider.getName(), latencyMs });
    }

    // ── 7. Parse structured output ─────────────────────────────────────────
    let result = { raw: providerResponse.content };
    if (promptDef.outputFormat === 'json') {
      try {
        // Extract JSON from Markdown code fences if present
        const jsonMatch = providerResponse.content.match(/```(?:json)?\s*([\s\S]*?)```/);
        const jsonStr   = jsonMatch ? jsonMatch[1].trim() : providerResponse.content.trim();
        result = JSON.parse(jsonStr);
      } catch (_) {
        // JSON parse failed — return raw content with warning
        result = { raw: providerResponse.content, parseError: 'Response was not valid JSON' };
      }
    }

    // ── 8. Build success response ──────────────────────────────────────────
    const aiResponse = AIResponse.success({
      requestId,
      feature,
      result,
      model:      providerResponse.model,
      provider:   providerResponse.provider,
      latencyMs,
      cached:     false,
      tokenUsage: providerResponse.tokenUsage,
    });

    // ── 9. Cache successful response ───────────────────────────────────────
    if (shouldUseCache) {
      const cacheKey = AICache.buildKey(feature, userPrompt, imageBase64);
      await AICache.set(cacheKey, feature, aiResponse).catch(() => {}); // non-blocking
    }

    // ── 10. Monitoring + Tracking ──────────────────────────────────────────
    AIMonitor.recordSuccess(feature, latencyMs);
    await AIUsageTracker.record({
      requestId, userId, feature,
      provider:   providerResponse.provider,
      model:      providerResponse.model,
      status:     'success',
      latencyMs,
      tokenUsage: providerResponse.tokenUsage,
    });

    aiLogger.requestSuccess({
      requestId, feature, userId,
      provider:   providerResponse.provider,
      model:      providerResponse.model,
      latencyMs,
      cached:     false,
      tokenUsage: providerResponse.tokenUsage,
    });

    return aiResponse;
  },

  /**
   * Health check — returns current gateway and provider status.
   * Never makes an AI API call. Safe to call frequently.
   * @returns {Promise<object>}
   */
  async health() {
    const stats = AIMonitor.getStats();
    let providerAvailable = false;
    let providerName      = aiConfig.provider;
    let providerModel     = aiConfig.model;

    if (aiConfig.enabled) {
      try {
        const provider    = createProvider();
        providerAvailable = await provider.isAvailable();
        providerName      = provider.getName();
        providerModel     = provider.getModel();
      } catch (_) {
        providerAvailable = false;
      }
    }

    return {
      aiEnabled:         aiConfig.enabled,
      cacheEnabled:      aiConfig.cacheEnabled,
      provider:          providerName,
      model:             providerModel,
      providerAvailable,
      monitoring:        stats,
    };
  },
};

module.exports = AIGateway;
