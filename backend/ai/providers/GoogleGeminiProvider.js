'use strict';

/**
 * Google Gemini Provider
 * ----------------------
 * Concrete implementation of AIProviderInterface for Google Gemini REST API.
 * Uses axios (already installed in the project) for HTTP requests.
 *
 * API key is read directly from process.env.AI_API_KEY (or GEMINI_API_KEY) at call time —
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

// Gemini API base URL (v1beta supports all current models including gemini-2.0-flash and gemini-flash-latest)
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
   * Resolve the Gemini API key at call time without storing it on the instance.
   * @private
   */
  _getApiKey() {
    return (
      process.env.AI_API_KEY ||
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_API_KEY ||
      ''
    ).trim();
  }

  /**
   * Normalize MIME type and base64 data for Gemini inline_data.
   * Properly handles JPEG, PNG, and WebP inputs.
   * @private
   */
  _normalizeVisionInput(imageBase64, imageMimeType) {
    let mime = String(imageMimeType || 'image/jpeg').toLowerCase().trim();
    if (mime === 'image/jpg' || mime === 'jpg' || mime === 'jpeg') mime = 'image/jpeg';
    else if (mime === 'png') mime = 'image/png';
    else if (mime === 'webp') mime = 'image/webp';
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(mime)) {
      mime = 'image/jpeg';
    }
    const cleanBase64 = String(imageBase64 || '')
      .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '')
      .trim();
    return { mime, cleanBase64 };
  }

  /**
   * Build the contents array for Gemini's generateContent request.
   * @private
   */
  _buildContents(systemPrompt, userPrompt) {
    const contents = [];

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
    const { mime, cleanBase64 } = this._normalizeVisionInput(imageBase64, imageMimeType);

    return [{
      role: 'user',
      parts: [
        {
          inline_data: {
            mime_type: mime,
            data: cleanBase64,
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

    if (status === 400 && /API key not valid|API_KEY_INVALID/i.test(apiMsg)) {
      errCode = 'AUTH_FAILURE';
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
    const apiKey  = this._getApiKey();
    const model   = options.model || this._model;
    const url     = `${GEMINI_API_BASE}/models/${model}:generateContent`;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return {
        success:      false,
        content:      '',
        tokenUsage:   undefined,
        model,
        provider:     this._name,
        errorCode:    'AUTH_FAILURE',
        retryAfterSec: null,
        errorMessage: 'Gemini API key is not configured',
      };
    }

    const body = {
      contents: this._buildContents(systemPrompt, userPrompt),
      generationConfig: {
        maxOutputTokens: Math.max(options.maxTokens || aiConfig.maxTokens, 2048),
        temperature:     options.temperature ?? aiConfig.temperature,
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
    const apiKey  = this._getApiKey();
    const model   = options.model || process.env.AI_VISION_MODEL || this._model;
    const url     = `${GEMINI_API_BASE}/models/${model}:generateContent`;

    if (!apiKey || apiKey === 'your_gemini_api_key_here') {
      return {
        success:      false,
        content:      '',
        tokenUsage:   undefined,
        model,
        provider:     this._name,
        errorCode:    'AUTH_FAILURE',
        retryAfterSec: null,
        errorMessage: 'Gemini API key is not configured',
      };
    }

    const body = {
      contents: this._buildVisionContents(systemPrompt, userPrompt, imageBase64, imageMimeType),
      generationConfig: {
        // Ensure ample token budget for full 19-section technical maintenance reports
        maxOutputTokens: Math.max(options.maxTokens || aiConfig.maxTokens, 3500),
        temperature:     options.temperature ?? aiConfig.temperature,
      },
    };

    try {
      const response = await axios.post(url, body, {
        timeout: options.timeoutMs || aiConfig.timeoutMs,
        signal:  options.signal,
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
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
    const apiKey = this._getApiKey();
    return (
      typeof apiKey === 'string' &&
      apiKey.length > 0 &&
      apiKey !== 'your_gemini_api_key_here'
    );
  }
}

module.exports = GoogleGeminiProvider;
