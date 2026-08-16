'use strict';

/**
 * AI Environment Configuration
 * -----------------------------
 * Single source of truth for all AI infrastructure configuration.
 * Reads from process.env (populated by dotenv in server.js).
 *
 * Design decisions:
 *   - All AI config is validated at module load time, not lazily.
 *   - When AI_ENABLED=false, no validation of provider credentials is performed.
 *     This allows the server to start and all existing routes to work normally
 *     even when no AI provider is configured.
 *   - API keys NEVER leave this module as plain strings in error messages.
 *   - The returned config object is frozen to prevent accidental mutation.
 */

// ── Parsing helpers ───────────────────────────────────────────────────────────

function parseBool(val, defaultVal = false) {
  if (val === undefined || val === null || val === '') return defaultVal;
  return val === 'true' || val === '1';
}

function parseInt10(val, defaultVal) {
  const n = parseInt(val, 10);
  return isNaN(n) ? defaultVal : n;
}

function parseFloat10(val, defaultVal) {
  const n = parseFloat(val);
  return isNaN(n) ? defaultVal : n;
}

function parseStringList(val, defaultVal = []) {
  if (!val || val.trim() === '') return defaultVal;
  return val.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
}

// ── Build config ──────────────────────────────────────────────────────────────

const AI_ENABLED       = parseBool(process.env.AI_ENABLED, false);
const AI_CACHE_ENABLED = parseBool(process.env.AI_CACHE_ENABLED, false);

const config = Object.freeze({
  // Master switch — when false, all AI endpoints return 503 immediately.
  enabled: AI_ENABLED,

  // Provider settings
  provider:     (process.env.AI_PROVIDER     || 'google-gemini').toLowerCase(),
  // NOTE: apiKey is accessed from process.env by providers directly to avoid
  // storing it in any in-memory config object that might be serialized/logged.
  model:        process.env.AI_MODEL         || 'gemini-2.0-flash',
  maxTokens:    parseInt10(process.env.AI_MAX_TOKENS,    1024),
  temperature:  parseFloat10(process.env.AI_TEMPERATURE, 0.3),

  // Timeout and retry
  timeoutMs:     parseInt10(process.env.AI_TIMEOUT_MS,     30000),
  maxRetries:    parseInt10(process.env.AI_MAX_RETRIES,    3),
  retryDelayMs:  parseInt10(process.env.AI_RETRY_DELAY_MS, 1000),

  // Rate limiting (requests per window per user)
  rateLimitUser:     parseInt10(process.env.AI_RATE_LIMIT_USER,    10),
  rateLimitWorker:   parseInt10(process.env.AI_RATE_LIMIT_WORKER,  20),
  rateLimitImage:    parseInt10(process.env.AI_RATE_LIMIT_IMAGE,   5),
  rateLimitWindowMs: parseInt10(process.env.AI_RATE_LIMIT_WINDOW_MS, 60000),

  // Cache
  cacheEnabled: AI_CACHE_ENABLED,
  cacheTtlMs:   parseInt10(process.env.AI_CACHE_TTL_MS, 3600000),

  // Image handling
  imageMaxSizeMb:   parseFloat10(process.env.AI_IMAGE_MAX_SIZE_MB, 10),
  imageAllowedTypes: parseStringList(process.env.AI_IMAGE_ALLOWED_TYPES, ['jpeg', 'jpg', 'png', 'webp']),
  imageCleanupAfterMs: parseInt10(process.env.AI_IMAGE_CLEANUP_AFTER_MS, 3600000),

  // Logging
  logLevel: process.env.AI_LOG_LEVEL || 'info',

  // Supported providers (for validation in provider factory)
  supportedProviders: ['google-gemini', 'openai'],
});

// ── Startup validation (only when AI is enabled) ─────────────────────────────

if (AI_ENABLED) {
  const errors = [];

  if (!process.env.AI_API_KEY || process.env.AI_API_KEY.trim() === '' ||
      process.env.AI_API_KEY === 'your_gemini_api_key_here' ||
      process.env.AI_API_KEY === 'your_openai_api_key_here') {
    errors.push('AI_API_KEY is missing or is still a placeholder value');
  }

  if (!config.supportedProviders.includes(config.provider)) {
    errors.push(`AI_PROVIDER "${config.provider}" is not supported. Supported: ${config.supportedProviders.join(', ')}`);
  }

  if (errors.length > 0) {
    // Log errors without revealing key values
    console.error('❌ [AI Config] AI_ENABLED=true but configuration is invalid:');
    errors.forEach(e => console.error(`   • ${e}`));
    console.error('   AI infrastructure will start but gateway calls will fail.');
    console.error('   Set AI_ENABLED=false or fix the above errors.');
    // We do NOT throw here — allow the server to start so existing HiFix
    // routes continue to work. The gateway will return errors for AI calls.
  } else {
    console.log(`✅ [AI Config] AI infrastructure enabled — provider: ${config.provider}, model: ${config.model}`);
  }
} else {
  console.log('ℹ️  [AI Config] AI_ENABLED=false — AI infrastructure loaded but dormant.');
}

module.exports = config;
