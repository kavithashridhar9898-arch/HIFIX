'use strict';

/**
 * AI Provider Factory
 * -------------------
 * Single location that maps AI_PROVIDER config to a concrete implementation.
 * Application code calls createProvider() — it NEVER imports a concrete
 * provider class directly.
 *
 * To add a new provider:
 *   1. Create MyNewProvider.js in this directory extending AIProviderInterface.
 *   2. Add a case in the switch statement below.
 *   3. Document the new provider in AI_PROVIDER env var.
 *   4. No other files need to change.
 */

const aiConfig = require('../config/aiConfig');
const AIProviderInterface = require('./AIProviderInterface');

// ── Provider registry ─────────────────────────────────────────────────────────
// Lazy-require: providers are only loaded if selected, reducing startup cost
// and avoiding unnecessary module initialization.

const PROVIDER_REGISTRY = {
  'google-gemini': () => require('./GoogleGeminiProvider'),
  'openai':        () => require('./OpenAIProvider'),
};

// Singleton cache — one provider instance per process lifetime.
let _providerInstance = null;

/**
 * Create (or return cached) the configured AI provider instance.
 * @returns {AIProviderInterface}
 * @throws {Error} if the configured provider is not registered
 */
function createProvider() {
  if (_providerInstance) return _providerInstance;

  const providerKey = aiConfig.provider;
  const factory = PROVIDER_REGISTRY[providerKey];

  if (!factory) {
    const supported = Object.keys(PROVIDER_REGISTRY).join(', ');
    throw new Error(
      `[AI Provider Factory] Unknown provider "${providerKey}". ` +
      `Supported providers: ${supported}. ` +
      `Check AI_PROVIDER in your .env file.`
    );
  }

  const ProviderClass = factory();
  const instance = new ProviderClass();

  // Verify the instance satisfies the interface contract
  if (!(instance instanceof AIProviderInterface)) {
    throw new Error(
      `[AI Provider Factory] Provider "${providerKey}" must extend AIProviderInterface.`
    );
  }

  _providerInstance = instance;
  return _providerInstance;
}

/**
 * Reset the cached provider instance.
 * Used in tests to force re-initialization with different config.
 * Do NOT call in production code.
 */
function _resetProviderForTesting() {
  _providerInstance = null;
}

/**
 * Return the list of all registered provider names.
 * Used by the health endpoint and monitoring.
 * @returns {string[]}
 */
function getRegisteredProviders() {
  return Object.keys(PROVIDER_REGISTRY);
}

module.exports = { createProvider, getRegisteredProviders, _resetProviderForTesting };
