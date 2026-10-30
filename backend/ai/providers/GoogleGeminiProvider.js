'use strict';

/**
 * Google Gemini Provider
 * ----------------------
 * Concrete implementation of AIProviderInterface for Google Gemini REST API.
 * Uses axios (already installed in the project) for HTTP requests.
 *
 * API key is read directly from process.env.AI_API_KEY at call time —
 * it is NEVER stored in an instance variable to prevent accidental logging.
 *
 * Handles Gemini-specific error codes and maps them to the standardized
 * ProviderResponse shape defined in AIProviderInterface.
 *
 * Gemini REST endpoint: https://generativelanguage.googleapis.com/v1beta/models
 */

const axios = require('axios');
const AIProviderInterface = require('./AIProviderInterface');
const aiConfig = require('../config/aiConfig');

// Gemini API base URL (v1beta supports all current models including gemini-2.0-flash)
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta';

// Map Gemini HTTP status codes to standardized error categories.
const GEMINI_ERROR_MAP = {
  400: 'INVALID_REQUEST',
  401: 'AUTH_FAILURE',
  403: 'AUTH_FAILURE',
  404: 'MODEL_NOT_FOUND',
  429: 'RATE_LIMITED',
  500: 'PROVIDER_ERROR',
  503: 'PROVIDER_UNAVAILABLE',
};

class GoogleGeminiProvider extends AIProviderInterface {
  constructor() {
    super();
    this._name  = 'google-gemini';
    this._model = aiConfig.model || 'gemini-2.0-flash';
  }

  getName()  { return this._name; }
  getModel() { return this._model; }

  /**
   * Build the contents array for Gemini's generateContent request.
   * @private
   */
  _buildContents(systemPrompt, userPrompt) {
    const contents = [];

    // Gemini uses "user" role for the user message.
    // System prompt is passed as the first turn or as system_instruction.
    // We combine them into a single user message for compatibility across model versions.
    const combinedPrompt = systemPrompt
      ? `${systemPrompt}\n\n---\n\n${userPrompt}`
      : userPrompt;

    contents.push({
      role: 'user',
      parts: [{ text: combinedPrompt }],
    });

    return contents;
  }

  /**
   * Build vision contents with image for Gemini multimodal requests.
   * @private
   */
  _buildVisionContents(systemPrompt, userPrompt, imageBase64, imageMimeType) {
    const combinedPrompt = systemPrompt
      ? `${systemPrompt}\n\n---\n\n${userPrompt}`
      : userPrompt;

    return [{
      role: 'user',
      parts: [
        {
          inline_data: {
            mime_type: imageMimeType || 'image/jpeg',
            data: imageBase64,
          },
        },
        { text: combinedPrompt },
      ],
    }];
  }

  /**
   * Parse the provider response into the standard ProviderResponse shape.
   * @private
   */
  _parseResponse(data) {
    const candidate = data?.candidates?.[0];
    const content   = (candidate?.content?.parts || [])
      .filter(p => !p.thought && typeof p.text === 'string')
      .map(p => p.text).join('');
    const tokenUsage = data?.usageMetadata?.totalTokenCount ?? undefined;

    return {
      success:    true,
      content,
      tokenUsage,
      model:      data?.modelVersion || this._model,
      provider:   this._name,
      errorCode:  null,
      errorMessage: null,
    };
  }

  /**
   * Map an axios error to the standard ProviderResponse failure shape.
   * @private
   */
  _handleError(err) {
    const status  = err?.response?.status;
    const apiErr  = err?.response?.data?.error || {};
    const apiMsg  = apiErr.message || err.message;
    let errCode   = GEMINI_ERROR_MAP[status] || 'UNKNOWN_ERROR';
    let retryAfterSec = null;

    if (!status) {
      // No HTTP response: timeout/abort vs. plain network failure
      errCode = (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED' || /timeout/i.test(err.message))
        ? 'TIMEOUT' : 'NETWORK_ERROR';
    }

    if (status === 429) {
      const details = Array.isArray(apiErr.details) ? apiErr.details : [];
      const retryInfo = details.find(d => (d['@type'] || '').includes('RetryInfo'));
      if (retryInfo?.retryDelay) retryAfterSec = Math.ceil(parseFloat(retryInfo.retryDelay)) || null;
      const hdr = parseInt(err.response.headers?.['retry-after'], 10);
      if (!retryAfterSec && !isNaN(hdr)) retryAfterSec = hdr;
      // RESOURCE_EXHAUSTED with a QuotaFailure / "quota" wording = quota exhausted (daily/minute), not transient
      const isQuota = details.some(d => (d['@type'] || '').includes('QuotaFailure')) || /quota/i.test(apiMsg);
      errCode = isQuota ? 'QUOTA_EXCEEDED' : 'RATE_LIMITED';
    }

    return {
      success:      false,
      content:      '',
      tokenUsage:   undefined,
      model:        this._model,
      provider:     this._name,
      errorCode:    errCode,
      retryAfterSec,
      errorMessage: `Gemini API error (${status || err.code || 'network'}): ${apiMsg}`,
    };
  }

  /**
   * Text-only completion via Gemini generateContent.
   */
  async complete({ systemPrompt, userPrompt, options = {} }) {
    const apiKey  = process.env.AI_API_KEY;
    const model   = options.model || this._model;
    const url     = `${GEMINI_API_BASE}/models/${model}:generateContent`;

    const body = {
      contents: this._buildContents(systemPrompt, userPrompt),
      generationConfig: {
        maxOutputTokens: options.maxTokens    || aiConfig.maxTokens,
        temperature:     options.temperature  || aiConfig.temperature,
      },
    };

    try {
      const response = await axios.post(url, body, {
        timeout: options.timeoutMs || aiConfig.timeoutMs,
        signal:  options.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      });
      return this._parseResponse(response.data);
    } catch (err) {
      return this._handleError(err);
    }
  }

  /**
   * Vision (image + text) completion via Gemini multimodal generateContent.
   */
  async completeWithVision({ systemPrompt, userPrompt, imageBase64, imageMimeType, options = {} }) {
    const apiKey  = process.env.AI_API_KEY;
    // Vision requires a vision-capable model (AI_MODEL / AI_VISION_MODEL).
    const model   = options.model || process.env.AI_VISION_MODEL || this._model;
    const url     = `${GEMINI_API_BASE}/models/${model}:generateContent`;

    const body = {
      contents: this._buildVisionContents(systemPrompt, userPrompt, imageBase64, imageMimeType),
      generationConfig: {
        maxOutputTokens:  options.maxTokens    || aiConfig.maxTokens,
        temperature:      options.temperature  || aiConfig.temperature,
        // Note: responseMimeType is intentionally omitted for vision requests.
        // Several Gemini model versions reject it for multimodal inputs and return
        // INVALID_REQUEST, which is NON_RETRYABLE and silently blocks the OpenRouter
        // fallback. The system prompt already instructs JSON output.
      },
    };

    try {
      const response = await axios.post(url, body, {
        timeout: options.timeoutMs || aiConfig.timeoutMs,
        signal:  options.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        // Vision requests can be larger — increase limit for multipart payloads
        maxBodyLength: 20 * 1024 * 1024, // 20 MB
        maxContentLength: 20 * 1024 * 1024,
      });
      return this._parseResponse(response.data);
    } catch (err) {
      return this._handleError(err);
    }
  }

  /**
   * Lightweight availability check — verifies API key is configured.
   * Does NOT make an API call (avoids cost/latency on health checks).
   */
  async isAvailable() {
    const apiKey = process.env.AI_API_KEY;
    return (
      typeof apiKey === 'string' &&
      apiKey.trim().length > 0 &&
      apiKey !== 'your_gemini_api_key_here'
    );
  }
}

module.exports = GoogleGeminiProvider;
