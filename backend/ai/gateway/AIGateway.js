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
 */

const aiConfig          = require('../config/aiConfig');
const { createProvider, createProviderByName } = require('../providers/index');
const { AIResponse, AI_ERROR_CATEGORIES } = require('./AIResponse');
const { generateRequestId } = require('../utils/requestId');
const aiLogger          = require('../utils/aiLogger');
const AICache           = require('../cache/AICache');
const AIMonitor         = require('../monitoring/AIMonitor');
const AIUsageTracker    = require('../monitoring/AIUsageTracker');
const { promptRegistry } = require('../prompts/promptRegistry');
const crypto            = require('crypto');

// ── Provider cooldowns (circuit breaker) ─────────────────────────────────────
// key "provider:model" → { until: epochMs, category }
// Prevents repeatedly hitting an exhausted quota or a model that is hanging.
const _cooldowns = new Map();
const COOLDOWN_DEFAULTS_SEC = { QUOTA_EXCEEDED: 3600, RATE_LIMITED: 60, TIMEOUT: 300 };

// ── Pre-warm OpenRouter catalogue ─────────────────────────────────────────────
setImmediate(() => {
  try {
    const or = typeof createProviderByName === 'function' ? createProviderByName('openrouter') : null;
    if (or && typeof or._loadCatalogue === 'function') {
      or._loadCatalogue().catch(() => {}); // non-blocking, silent
    }
  } catch (_) {}
});

function cooldownKey(c) { return `${c.provider.getName()}:${c.model || 'default'}`; }

function setCooldown(c, category, retryAfterSec) {
  const sec = Math.min(retryAfterSec || COOLDOWN_DEFAULTS_SEC[category] || 60, 24 * 3600);
  _cooldowns.set(cooldownKey(c), { until: Date.now() + sec * 1000, category });
}

function getCooldown(c) {
  const cd = _cooldowns.get(cooldownKey(c));
  if (!cd) return null;
  if (cd.until <= Date.now()) { _cooldowns.delete(cooldownKey(c)); return null; }
  return { ...cd, retryAfterSec: Math.ceil((cd.until - Date.now()) / 1000) };
}

// ── Request de-duplication ───────────────────────────────────────────────────
const _inFlight = new Map();
const _recent   = new Map(); // key → { at, response }
const RECENT_TTL_MS = 10 * 60 * 1000;

function dedupKey(feature, userPrompt, imageBase64) {
  return crypto.createHash('sha1').update(`${feature}|${userPrompt}|${imageBase64 || ''}`).digest('hex');
}

const NON_RETRYABLE = new Set([
  'QUOTA_EXCEEDED',
  'RATE_LIMITED',
  'AUTH_FAILURE',
  'MODEL_NOT_FOUND',
  'NO_COMPATIBLE_PROVIDER',
  'TIMEOUT',
  'INVALID_RESPONSE',
]);
const STOP_CHAIN = new Set(['NO_COMPATIBLE_PROVIDER']);
const STOP_PROVIDER = new Set(['AUTH_FAILURE']);

// ── Retry helper ──────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function retryDelay(attempt) {
  return aiConfig.retryDelayMs * Math.pow(2, attempt - 1);
}

// ── Timeout wrapper ───────────────────────────────────────────────────────────

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

// ── Robust JSON parser for LLM outputs ───────────────────────────────────────

function parseStructuredJson(rawContent) {
  if (typeof rawContent !== 'string' || !rawContent.trim()) {
    throw new Error('Empty output');
  }
  const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/i);
  let candidate = (jsonMatch ? jsonMatch[1] : rawContent).trim();

  // If there is leading/trailing prose around a JSON object, isolate the outermost {...}
  if (!candidate.startsWith('{')) {
    const firstBrace = candidate.indexOf('{');
    const lastBrace = candidate.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
      candidate = candidate.slice(firstBrace, lastBrace + 1);
    }
  }

  try {
    return JSON.parse(candidate);
  } catch (_) {
    // Repair common minor syntax quirks from vision models (`"key"][` -> `"key":[` and trailing commas)
    const repaired = candidate
      .replace(/"\s*\]\s*\[/g, '":[')
      .replace(/,\s*([}\]])/g, '$1');
    return JSON.parse(repaired);
  }
}

// ── Main Gateway ──────────────────────────────────────────────────────────────

const AIGateway = {

  /**
   * Primary entry point for ALL AI feature requests.
   * Always resolves with an AIResponse — never rejects.
   */
  async request(params) {
    const key = dedupKey(params.feature, params.userPrompt || '', params.imageBase64);
    const recent = _recent.get(key);
    if (recent && Date.now() - recent.at < RECENT_TTL_MS) {
      return { ...recent.response, cached: true, deduplicated: true };
    }
    if (_inFlight.has(key)) return _inFlight.get(key);

    const p = this._request(params).then(res => {
      if (res.success && params.imageBase64) {
        _recent.set(key, { at: Date.now(), response: res });
        if (_recent.size > 200) _recent.delete(_recent.keys().next().value);
      }
      return res;
    }).finally(() => _inFlight.delete(key));
    _inFlight.set(key, p);
    return p;
  },

  async _request({ feature, userPrompt = '', imageBase64, imageMimeType, userId, options = {}, useCache }) {
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

    // ── 4. Provider chain selection ────────────────────────────────────────
    let primary;
    try {
      primary = createProvider();
    } catch (err) {
      const latencyMs = Date.now() - startTime;
      aiLogger.requestFailure({ requestId, feature, userId, errorCategory: 'PROVIDER_UNAVAILABLE', message: err.message, latencyMs });
      AIMonitor.recordFailure(feature, 'PROVIDER_UNAVAILABLE');
      await AIUsageTracker.record({ requestId, userId, feature, provider: aiConfig.provider, model: aiConfig.model, status: 'failure', latencyMs, errorCategory: 'PROVIDER_UNAVAILABLE' });
      return AIResponse.failure({ requestId, feature, errorCategory: AI_ERROR_CATEGORIES.PROVIDER_UNAVAILABLE, errorMessage: 'AI provider is not available', latencyMs });
    }

    const isVision = Boolean(imageBase64);
    const candidates = [];
    const primaryModel = (isVision && process.env.AI_VISION_MODEL) || primary.getModel();
    candidates.push({ provider: primary, model: primaryModel, role: 'primary' });
    if (primary.getName() === 'google-gemini' && aiConfig.fallbackModel && aiConfig.fallbackModel !== primaryModel) {
      candidates.push({ provider: primary, model: aiConfig.fallbackModel, role: 'primary' });
    }

    let alternativeConfigured = false;
    try {
      if (aiConfig.openRouterEnabled && primary.getName() !== 'openrouter' && typeof createProviderByName === 'function') {
        const or = createProviderByName('openrouter');
        if (or && await or.isAvailable()) {
          alternativeConfigured = true;
          if (isVision) {
            // Only verified free + image-capable models; never text-only, never paid.
            const verified = await or.getVerifiedVisionModels();
            verified.forEach(m => candidates.push({ provider: or, model: m, role: 'alternative' }));
          } else {
            candidates.push({ provider: or, model: or.getModel(), role: 'alternative' });
          }
        }
      }
    } catch (orErr) {
      aiLogger.warn({ requestId, feature, userId, message: `Alternative provider setup skipped: ${orErr.message}` });
    }

    // ── 5. Fallback chain with per-attempt timeout + global deadline ──────
    const deadline = startTime + aiConfig.requestDeadlineMs;
    const attempts = [];
    let providerResponse = null;
    let result = null;

    const deadProviders = new Set();

    chain:
    for (const c of candidates) {
      if (
        c.role === 'alternative' &&
        attempts.length >= 2 &&
        attempts.every(a => a.role === 'primary' && a.outcome === 'TIMEOUT' && a.latencyMs >= aiConfig.timeoutMs)
      ) {
        break chain;
      }
      if (deadProviders.has(c.provider.getName())) {
        attempts.push({ provider: c.provider.getName(), model: c.model, role: c.role, outcome: 'AUTH_FAILURE', skipped: true });
        continue;
      }
      const cd = getCooldown(c);
      if (cd) {
        attempts.push({ provider: c.provider.getName(), model: c.model, role: c.role, outcome: cd.category, skipped: true, retryAfterSec: cd.retryAfterSec });
        continue;
      }

      for (let attempt = 1; attempt <= 1 + Math.max(0, aiConfig.maxRetries); attempt++) {
        const remaining = deadline - Date.now();
        if (remaining < 2500) {
          attempts.push({ provider: c.provider.getName(), model: c.model, role: c.role, outcome: 'DEADLINE', skipped: true });
          break chain;
        }
        // Free OpenRouter vision models (esp. reasoning models) can need >15s; give them
        // the remaining global deadline instead of the per-attempt cap.
        const perAttemptMs = (c.role === 'alternative' || c === candidates[candidates.length - 1])
          ? Math.min(38000, Math.max(1000, remaining - 1000))
          : Math.min(aiConfig.timeoutMs, remaining);
        const ac = new AbortController();
        const callOptions = { ...promptDef.defaultOptions, ...options, model: c.model, timeoutMs: perAttemptMs, signal: ac.signal };
        const builtPrompt = promptDef.buildUserPrompt ? promptDef.buildUserPrompt(userPrompt) : userPrompt;
        const t0 = Date.now();
        let resp;
        try {
          const callPromise = isVision
            ? c.provider.completeWithVision({ systemPrompt: promptDef.systemPrompt, userPrompt: builtPrompt, imageBase64, imageMimeType: imageMimeType || 'image/jpeg', options: callOptions })
            : c.provider.complete({ systemPrompt: promptDef.systemPrompt, userPrompt: builtPrompt, options: callOptions });
          resp = await withTimeout(callPromise, perAttemptMs + 500);
        } catch (err) {
          ac.abort();
          resp = { success: false, errorCode: err.errorCategory || 'PROVIDER_ERROR', errorMessage: err.message };
        }

        if (resp.success) {
          // Validate structured output before accepting — a garbled or incomplete answer falls through to the next provider.
          if (promptDef.outputFormat === 'json') {
            try {
              result = parseStructuredJson(resp.content);
              if (
                !result ||
                typeof result !== 'object' ||
                Array.isArray(result) ||
                (feature === 'IMAGE_DIAGNOSIS' &&
                  typeof result.hasReadableText !== 'boolean' &&
                  (typeof result.problem !== 'string' || result.problem.trim().length === 0) &&
                  (typeof result.reportTitle !== 'string' || result.reportTitle.trim().length === 0))
              ) {
                resp = { success: false, errorCode: 'INVALID_RESPONSE', errorMessage: 'Provider returned incomplete JSON output' };
              }
            } catch (_) {
              resp = { success: false, errorCode: 'INVALID_RESPONSE', errorMessage: 'Provider returned non-JSON output' };
            }
          } else {
            result = { raw: resp.content };
          }
        }

        if (resp.success) {
          attempts.push({ provider: c.provider.getName(), model: c.model, role: c.role, outcome: 'SUCCESS', latencyMs: Date.now() - t0 });
          providerResponse = resp;
          break chain;
        }

        const cat = resp.errorCode || 'PROVIDER_ERROR';
        attempts.push({ provider: c.provider.getName(), model: c.model, role: c.role, outcome: cat, latencyMs: Date.now() - t0, retryAfterSec: resp.retryAfterSec || null });
        aiLogger.warn({ requestId, feature, userId, provider: c.provider.getName(), model: c.model, errorCategory: cat, message: resp.errorMessage });

        if (cat === 'QUOTA_EXCEEDED' || cat === 'RATE_LIMITED' || cat === 'TIMEOUT') {
          setCooldown(c, cat, resp.retryAfterSec);
          if (cat === 'TIMEOUT') AIMonitor.recordTimeout(feature);
        }
        if (STOP_CHAIN.has(cat)) break chain;
        if (STOP_PROVIDER.has(cat)) { deadProviders.add(c.provider.getName()); break; }
        if (NON_RETRYABLE.has(cat) || cat === 'INVALID_REQUEST') break;
        if (attempt <= aiConfig.maxRetries) {
          await sleep(Math.min(retryDelay(attempt), Math.max(0, deadline - Date.now() - 2500)));
        }
      }
    }

    const latencyMs = Date.now() - startTime;

    // ── 6. Handle final failure (all candidates exhausted) ─────────────────
    if (!providerResponse) {
      const primaryAttempts = attempts.filter(a => a.role === 'primary');
      const altAttempts     = attempts.filter(a => a.role === 'alternative');
      const primaryQuota = primaryAttempts.length > 0 && primaryAttempts.every(a => a.outcome === 'QUOTA_EXCEEDED' || a.outcome === 'RATE_LIMITED');
      const anyTimeout   = attempts.some(a => a.outcome === 'TIMEOUT' || a.outcome === 'DEADLINE');
      const anyNetwork   = attempts.some(a => a.outcome === 'NETWORK_ERROR');
      const invalidReq   = attempts.length > 0 && attempts.every(a => a.outcome === 'INVALID_REQUEST');

      let category;
      if (invalidReq) category = AI_ERROR_CATEGORIES.INVALID_REQUEST;
      else if (primaryQuota) category = AI_ERROR_CATEGORIES.QUOTA_EXCEEDED;
      else if (anyTimeout) category = AI_ERROR_CATEGORIES.TIMEOUT;
      else if (anyNetwork) category = AI_ERROR_CATEGORIES.NETWORK_ERROR;
      else category = (attempts[attempts.length - 1]?.outcome) || AI_ERROR_CATEGORIES.PROVIDER_UNAVAILABLE;

      const retryHints = attempts.map(a => a.retryAfterSec).filter(n => typeof n === 'number' && n > 0);
      const retryAfterSec = retryHints.length ? Math.min(...retryHints) : (category === 'TIMEOUT' || category === 'NETWORK_ERROR' ? 30 : null);

      const summary = {
        list: attempts,
        primaryQuotaExhausted: primaryQuota,
        alternativeConfigured,
        alternativeAttempted: altAttempts.length > 0,
        alternativeOutcome: altAttempts.length ? altAttempts[altAttempts.length - 1].outcome : (alternativeConfigured && isVision ? 'NO_COMPATIBLE_PROVIDER' : 'NOT_CONFIGURED'),
      };

      aiLogger.requestFailure({ requestId, feature, userId, provider: primary.getName(), model: primaryModel, latencyMs, errorCategory: category, message: JSON.stringify(attempts) });
      AIMonitor.recordFailure(feature, category);
      await AIUsageTracker.record({ requestId, userId, feature, provider: primary.getName(), model: primaryModel, status: category === 'TIMEOUT' ? 'timeout' : 'failure', latencyMs, errorCategory: category });
      return AIResponse.failure({ requestId, feature, errorCategory: category, errorMessage: `AI analysis unavailable (${category})`, model: primaryModel, provider: primary.getName(), latencyMs, retryAfterSec, attempts: summary });
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
