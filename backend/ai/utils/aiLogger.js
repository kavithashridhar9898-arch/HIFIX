'use strict';

/**
 * AI Structured Logger
 * --------------------
 * Produces structured, consistent log entries for all AI gateway activity.
 *
 * SECURITY CONTRACT — This logger MUST NEVER log:
 *   - AI provider API keys or secrets
 *   - User passwords or authentication tokens
 *   - Payment credentials or card data
 *   - Blockchain private keys
 *   - Full image binary data or base64 strings
 *   - Personally identifiable information beyond userId (integer only)
 *
 * The allowlist approach is intentional: only explicitly declared fields are
 * included in log output. Any undeclared field is silently dropped.
 */

const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

// Read configured log level from environment. Default to 'info'.
const CONFIGURED_LEVEL = LOG_LEVELS[process.env.AI_LOG_LEVEL] ?? LOG_LEVELS.info;

/**
 * Core log emitter — only allowed fields are output.
 * @param {string} level
 * @param {object} fields
 */
function emit(level, fields) {
  if (LOG_LEVELS[level] < CONFIGURED_LEVEL) return;

  // ALLOWLIST — only these fields may appear in AI log output.
  const safe = {
    timestamp:     new Date().toISOString(),
    level:         level.toUpperCase(),
    system:        'AI',
    requestId:     sanitizeString(fields.requestId),
    feature:       sanitizeString(fields.feature),
    userId:        typeof fields.userId === 'number' ? fields.userId : undefined,
    provider:      sanitizeString(fields.provider),
    model:         sanitizeString(fields.model),
    latencyMs:     typeof fields.latencyMs === 'number' ? fields.latencyMs : undefined,
    status:        sanitizeString(fields.status),
    errorCategory: sanitizeString(fields.errorCategory),
    cached:        typeof fields.cached === 'boolean' ? fields.cached : undefined,
    tokenUsage:    typeof fields.tokenUsage === 'number' ? fields.tokenUsage : undefined,
    message:       sanitizeString(fields.message),
    // Note: 'result', 'prompt', 'image', 'apiKey' etc. are deliberately omitted.
  };

  // Remove undefined keys to keep output clean.
  const output = Object.fromEntries(
    Object.entries(safe).filter(([, v]) => v !== undefined && v !== null)
  );

  if (process.env.NODE_ENV === 'production') {
    // In production: structured JSON for log aggregators (Datadog, CloudWatch, etc.)
    process.stdout.write(JSON.stringify(output) + '\n');
  } else {
    // In development: human-readable prefix + compact JSON
    const prefix = `[${output.timestamp}] [AI:${level.toUpperCase()}]`;
    const ctx    = output.requestId ? ` [${output.requestId}]` : '';
    const feat   = output.feature   ? ` [${output.feature}]` : '';
    const msg    = output.message   ? ` ${output.message}` : '';
    const rest   = { ...output };
    delete rest.timestamp; delete rest.level; delete rest.system;
    delete rest.requestId; delete rest.feature; delete rest.message;
    console.log(`${prefix}${ctx}${feat}${msg}`, Object.keys(rest).length ? rest : '');
  }
}

/**
 * Sanitize a string value for safe logging.
 * Returns undefined for non-strings or empty strings.
 * Truncates at 200 characters to prevent log flooding.
 */
function sanitizeString(value) {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  return value.slice(0, 200);
}

// ── Public logging API ────────────────────────────────────────────────────────

const aiLogger = {
  debug: (fields) => emit('debug', fields),
  info:  (fields) => emit('info',  fields),
  warn:  (fields) => emit('warn',  fields),
  error: (fields) => emit('error', fields),

  /**
   * Convenience: log the start of an AI request.
   */
  requestStart({ requestId, feature, userId, provider, model }) {
    this.info({ requestId, feature, userId, provider, model, status: 'started', message: 'AI request initiated' });
  },

  /**
   * Convenience: log a successful AI response.
   */
  requestSuccess({ requestId, feature, userId, provider, model, latencyMs, cached, tokenUsage }) {
    this.info({ requestId, feature, userId, provider, model, latencyMs, cached, tokenUsage, status: 'success', message: 'AI request completed' });
  },

  /**
   * Convenience: log a failed AI request with categorized error.
   */
  requestFailure({ requestId, feature, userId, provider, model, latencyMs, errorCategory, message }) {
    this.error({ requestId, feature, userId, provider, model, latencyMs, errorCategory, status: 'failure', message });
  },

  /**
   * Convenience: log a rate-limit rejection.
   */
  rateLimited({ requestId, feature, userId }) {
    this.warn({ requestId, feature, userId, status: 'rate_limited', message: 'AI request rejected — rate limit exceeded' });
  },

  /**
   * Convenience: log a timeout event.
   */
  timeout({ requestId, feature, userId, provider, model, latencyMs }) {
    this.warn({ requestId, feature, userId, provider, model, latencyMs, status: 'timeout', errorCategory: 'TIMEOUT', message: 'AI request timed out' });
  },
};

module.exports = aiLogger;
