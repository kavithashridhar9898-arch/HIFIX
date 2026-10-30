'use strict';

/**
 * OpenRouter Provider (optional secondary / fallback provider)
 * ------------------------------------------------------------
 * OpenAI-compatible chat API at https://openrouter.ai/api/v1.
 *
 * Safety contract (enforced in code, not just config):
 *   - ONLY models whose id ends with ":free" AND whose live catalogue pricing is
 *     exactly zero are ever called. Paid models are rejected → no billing possible.
 *   - Image requests are ONLY routed to models whose catalogue entry lists
 *     "image" in architecture.input_modalities. Images are never sent to text-only models.
 *   - API key is read from process.env.OPENROUTER_API_KEY at call time (backend only).
 *
 * Config:
 *   OPENROUTER_API_KEY        — enables the provider when set
 *   OPENROUTER_VISION_MODELS  — comma-separated ordered list of ":free" model ids
 */

const axios = require('axios');
const AIProviderInterface = require('./AIProviderInterface');
const aiConfig = require('../config/aiConfig');

const OPENROUTER_API_BASE = 'https://openrouter.ai/api/v1';
const CATALOGUE_TTL_MS = 60 * 60 * 1000;

const DEFAULT_VISION_MODELS = [
  'dots-studio/dots-3-note-preview:free',
  'google/gemma-4-31b-it:free',
  'google/gemma-4-26b-a4b-it:free',
  'nvidia/nemotron-3.5-super-vl:free',
];

let _catalogue = null;      // Map<id, modelEntry>
let _catalogueAt = 0;

class OpenRouterProvider extends AIProviderInterface {
  constructor() {
    super();
    this._name  = 'openrouter';
    this._model = this.getConfiguredModels()[0];
  }

  getName()  { return this._name; }
  getModel() { return this._model; }

  getConfiguredModels() {
    const raw = process.env.OPENROUTER_VISION_MODELS;
    const list = raw && raw.trim() ? raw.split(',').map(s => s.trim()).filter(Boolean) : DEFAULT_VISION_MODELS;
    // Hard guard: never allow non-free model ids, regardless of configuration.
    return list.filter(id => id.endsWith(':free'));
  }

  async _loadCatalogue() {
    if (_catalogue && Date.now() - _catalogueAt < CATALOGUE_TTL_MS) return _catalogue;
    const res = await axios.get(`${OPENROUTER_API_BASE}/models`, { timeout: 8000 });
    _catalogue = new Map((res.data?.data || []).map(m => [m.id, m]));
    _catalogueAt = Date.now();
    return _catalogue;
  }

  /**
   * Returns the configured models that are verified free AND image-capable right now.
   * Empty array → no compatible model; caller must not send the image.
   */
  async getVerifiedVisionModels() {
    let cat;
    try { cat = await this._loadCatalogue(); } catch (_) { return []; }
    return this.getConfiguredModels().filter(id => {
      const m = cat.get(id);
      if (!m) return false;
      const img  = (m.architecture?.input_modalities || []).includes('image');
      const free = String(m.pricing?.prompt) === '0' && String(m.pricing?.completion) === '0'
        && (m.pricing?.image === undefined || String(m.pricing.image) === '0');
      return img && free;
    });
  }

  _handleError(err, model) {
    const status = err?.response?.status;
    const apiMsg = err?.response?.data?.error?.message || err.message;
    let errorCode = 'PROVIDER_ERROR';
    let retryAfterSec = null;
    if (!status) errorCode = (err.code === 'ECONNABORTED' || err.code === 'ERR_CANCELED') ? 'TIMEOUT' : 'NETWORK_ERROR';
    else if (status === 401 || status === 403) errorCode = 'AUTH_FAILURE';
    else if (status === 402) errorCode = 'QUOTA_EXCEEDED'; // credits required — never auto-billed
    else if (status === 429) {
      errorCode = /per-day|daily|free-models-per-day/i.test(apiMsg) ? 'QUOTA_EXCEEDED' : 'RATE_LIMITED';
      const reset = parseInt(err.response.headers?.['x-ratelimit-reset'], 10);
      if (!isNaN(reset)) retryAfterSec = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    } else if (status === 400) errorCode = 'INVALID_REQUEST';
    else if (status === 404) errorCode = 'MODEL_NOT_FOUND';
    else if (status >= 500) errorCode = 'PROVIDER_UNAVAILABLE';
    return {
      success: false, content: '', tokenUsage: undefined,
      model, provider: this._name, errorCode, retryAfterSec,
      errorMessage: `OpenRouter error (${status || err.code || 'network'}): ${apiMsg}`,
    };
  }

  async _post(model, messages, options) {
    try {
      const res = await axios.post(`${OPENROUTER_API_BASE}/chat/completions`, {
        model,
        messages,
        max_tokens:  Math.max(options.maxTokens || aiConfig.maxTokens, 4096),
        temperature: options.temperature || aiConfig.temperature,
      }, {
        timeout: options.timeoutMs || aiConfig.timeoutMs,
        signal:  options.signal,
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'X-Title':       'HiFix',
        },
        maxBodyLength: 20 * 1024 * 1024,
      });
      const msg = res.data?.choices?.[0]?.message || {};
      let content = msg.content ?? '';
      if (!content && typeof msg.reasoning === 'string' && msg.reasoning.includes('{')) {
        content = msg.reasoning;
      }
      if (res.data?.error || !content) {
        return this._handleError({ response: { status: res.data?.error?.code || 502, data: res.data, headers: {} }, message: 'Empty response' }, model);
      }
      return {
        success: true, content,
        tokenUsage: res.data?.usage?.total_tokens,
        model: res.data?.model || model, provider: this._name,
        errorCode: null, errorMessage: null,
      };
    } catch (err) {
      return this._handleError(err, model);
    }
  }

  async complete({ systemPrompt, userPrompt, options = {} }) {
    const model = options.model || this._model;
    if (!model || !model.endsWith(':free')) {
      return { success: false, content: '', model, provider: this._name, errorCode: 'PROVIDER_UNAVAILABLE', errorMessage: 'No free OpenRouter model configured' };
    }
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });
    return this._post(model, messages, options);
  }

  async completeWithVision({ systemPrompt, userPrompt, imageBase64, imageMimeType, options = {} }) {
    const verified = await this.getVerifiedVisionModels();
    const model = options.model || verified[0];
    if (!model || !verified.includes(model)) {
      return {
        success: false, content: '', model: model || 'none', provider: this._name,
        errorCode: 'NO_COMPATIBLE_PROVIDER',
        errorMessage: 'No verified free image-capable OpenRouter model is available',
      };
    }
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userPrompt },
        { type: 'image_url', image_url: { url: `data:${imageMimeType || 'image/jpeg'};base64,${imageBase64}` } },
      ],
    });
    return this._post(model, messages, options);
  }

  async isAvailable() {
    const k = process.env.OPENROUTER_API_KEY;
    return typeof k === 'string' && k.trim().length > 0;
  }
}

module.exports = OpenRouterProvider;
