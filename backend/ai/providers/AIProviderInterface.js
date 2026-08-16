'use strict';

/**
 * AI Provider Interface (Abstract Base)
 * --------------------------------------
 * Defines the contract that ALL AI provider implementations must satisfy.
 * HiFix internal code MUST only depend on this interface — never on a
 * specific provider implementation directly.
 *
 * This is the "Provider Implementation" layer in the architecture:
 *
 *   HiFix Application
 *       ↓
 *   AIGateway  (single entry point)
 *       ↓
 *   AIProviderInterface  (this file — contract)
 *       ↓
 *   GoogleGeminiProvider | OpenAIProvider | FutureProvider
 *
 * To add a new provider:
 *   1. Create a new file in /providers/ that extends this class.
 *   2. Register it in providers/index.js.
 *   3. No other files need to change.
 */

class AIProviderInterface {
  /**
   * Return the human-readable provider name for logging and responses.
   * @returns {string}
   */
  getName() {
    throw new Error(`[AIProviderInterface] getName() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Return the current model identifier string.
   * @returns {string}
   */
  getModel() {
    throw new Error(`[AIProviderInterface] getModel() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Perform a text-only completion request.
   *
   * @param {object} params
   * @param {string}   params.systemPrompt  - System/instruction prompt
   * @param {string}   params.userPrompt    - User-facing prompt content
   * @param {object}   [params.options]     - Optional overrides (maxTokens, temperature, etc.)
   * @returns {Promise<ProviderResponse>}
   */
  async complete({ systemPrompt, userPrompt, options = {} }) {  // eslint-disable-line no-unused-vars
    throw new Error(`[AIProviderInterface] complete() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Perform a vision (image + text) completion request.
   * Used for future AI Image Diagnosis and similar features.
   *
   * @param {object} params
   * @param {string}   params.systemPrompt    - System/instruction prompt
   * @param {string}   params.userPrompt      - User-facing prompt content
   * @param {string}   params.imageBase64     - Base64-encoded image data
   * @param {string}   params.imageMimeType   - MIME type (e.g. "image/jpeg")
   * @param {object}   [params.options]       - Optional overrides
   * @returns {Promise<ProviderResponse>}
   */
  async completeWithVision({ systemPrompt, userPrompt, imageBase64, imageMimeType, options = {} }) {  // eslint-disable-line no-unused-vars
    throw new Error(`[AIProviderInterface] completeWithVision() must be implemented by ${this.constructor.name}`);
  }

  /**
   * Check whether this provider is currently reachable/configured.
   * Should be a lightweight check — no expensive API calls.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error(`[AIProviderInterface] isAvailable() must be implemented by ${this.constructor.name}`);
  }
}

/**
 * @typedef {object} ProviderResponse
 * @property {boolean} success        - Whether the request succeeded
 * @property {string}  content        - Raw text content from the provider
 * @property {object}  [parsed]       - Pre-parsed JSON if output format is 'json'
 * @property {number}  [tokenUsage]   - Total tokens used (if reported by provider)
 * @property {string}  model          - Model identifier that served the request
 * @property {string}  provider       - Provider name
 * @property {string}  [errorCode]    - Provider-specific error code on failure
 * @property {string}  [errorMessage] - Human-readable error description on failure
 */

module.exports = AIProviderInterface;
