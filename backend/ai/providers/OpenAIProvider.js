'use strict';

/**
 * OpenAI Provider
 * ---------------
 * Concrete implementation of AIProviderInterface for the OpenAI REST API.
 * Uses axios (already installed) for HTTP requests.
 *
 * This provider is SCAFFOLDED but NOT active unless AI_PROVIDER=openai.
 * The factory in providers/index.js controls which provider is instantiated.
 *
 * API key is read from process.env.AI_API_KEY at call time — never stored
 * in an instance variable to prevent accidental serialization or logging.
 *
 * Supports:
 *   - Chat completions (text)
 *   - Vision via GPT-4o (image + text)
 */

const axios = require('axios');
const AIProviderInterface = require('./AIProviderInterface');
const aiConfig = require('../config/aiConfig');

const OPENAI_API_BASE = 'https://api.openai.com/v1';

// Map OpenAI HTTP status codes to standardized error categories.
const OPENAI_ERROR_MAP = {
  400: 'INVALID_REQUEST',
  401: 'AUTH_FAILURE',
  403: 'AUTH_FAILURE',
  404: 'MODEL_NOT_FOUND',
  429: 'RATE_LIMITED',
  500: 'PROVIDER_ERROR',
  503: 'PROVIDER_UNAVAILABLE',
};

class OpenAIProvider extends AIProviderInterface {
  constructor() {
    super();
    this._name  = 'openai';
    this._model = aiConfig.model || 'gpt-4o-mini';
  }

  getName()  { return this._name; }
  getModel() { return this._model; }

  /**
   * Build standard OpenAI chat messages array.
   * @private
   */
  _buildMessages(systemPrompt, userPrompt) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: userPrompt });
    return messages;
  }

  /**
   * Build vision messages with image for GPT-4o multimodal requests.
   * @private
   */
  _buildVisionMessages(systemPrompt, userPrompt, imageBase64, imageMimeType) {
    const messages = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({
      role: 'user',
      content: [
        {
          type: 'image_url',
          image_url: {
            url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}`,
            detail: 'high',
          },
        },
        { type: 'text', text: userPrompt },
      ],
    });
    return messages;
  }

  /**
   * Parse OpenAI chat completion response into standard ProviderResponse.
   * @private
   */
  _parseResponse(data) {
    const content    = data?.choices?.[0]?.message?.content ?? '';
    const tokenUsage = data?.usage?.total_tokens ?? undefined;
    return {
      success:      true,
      content,
      tokenUsage,
      model:        data?.model || this._model,
      provider:     this._name,
      errorCode:    null,
      errorMessage: null,
    };
  }

  /**
   * Map an axios error to the standard ProviderResponse failure shape.
   * @private
   */
  _handleError(err) {
    const status  = err?.response?.status;
    const apiMsg  = err?.response?.data?.error?.message || err.message;
    const errCode = OPENAI_ERROR_MAP[status] || 'UNKNOWN_ERROR';
    return {
      success:      false,
      content:      '',
      tokenUsage:   undefined,
      model:        this._model,
      provider:     this._name,
      errorCode:    errCode,
      errorMessage: `OpenAI API error (${status || 'network'}): ${apiMsg}`,
    };
  }

  /**
   * Text-only chat completion.
   */
  async complete({ systemPrompt, userPrompt, options = {} }) {
    const apiKey = process.env.AI_API_KEY;
    const url    = `${OPENAI_API_BASE}/chat/completions`;

    const body = {
      model:       options.model       || this._model,
      messages:    this._buildMessages(systemPrompt, userPrompt),
      max_tokens:  options.maxTokens   || aiConfig.maxTokens,
      temperature: options.temperature || aiConfig.temperature,
    };

    try {
      const response = await axios.post(url, body, {
        timeout: aiConfig.timeoutMs,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
      });
      return this._parseResponse(response.data);
    } catch (err) {
      return this._handleError(err);
    }
  }

  /**
   * Vision (image + text) chat completion using GPT-4o multimodal.
   */
  async completeWithVision({ systemPrompt, userPrompt, imageBase64, imageMimeType, options = {} }) {
    const apiKey = process.env.AI_API_KEY;
    const url    = `${OPENAI_API_BASE}/chat/completions`;

    const body = {
      model:       options.model || 'gpt-4o',   // Vision requires gpt-4o or gpt-4-vision
      messages:    this._buildVisionMessages(systemPrompt, userPrompt, imageBase64, imageMimeType),
      max_tokens:  options.maxTokens   || aiConfig.maxTokens,
      temperature: options.temperature || aiConfig.temperature,
    };

    try {
      const response = await axios.post(url, body, {
        timeout: aiConfig.timeoutMs,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        maxBodyLength:   20 * 1024 * 1024,
        maxContentLength: 20 * 1024 * 1024,
      });
      return this._parseResponse(response.data);
    } catch (err) {
      return this._handleError(err);
    }
  }

  /**
   * Lightweight availability check — verifies API key is configured.
   * Does NOT make an API call.
   */
  async isAvailable() {
    const apiKey = process.env.AI_API_KEY;
    return (
      typeof apiKey === 'string' &&
      apiKey.trim().length > 0 &&
      apiKey !== 'your_openai_api_key_here'
    );
  }
}

module.exports = OpenAIProvider;
