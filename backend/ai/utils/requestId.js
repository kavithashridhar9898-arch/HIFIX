'use strict';

/**
 * AI Request ID Generator
 * ---------------------
 * Generates unique, traceable request IDs for every AI gateway request.
 * Format: ai_<timestamp_base36>_<8-char-hex-random>
 *
 * Uses Node.js built-in `crypto` only — no external dependencies.
 * IDs are safe for logging, database storage, and HTTP response headers.
 */

const crypto = require('crypto');

/**
 * Generate a new AI request ID.
 * @returns {string}  e.g. "ai_lq3k9f_a3b2c1d4"
 */
function generateRequestId() {
  const timestamp = Date.now().toString(36);                           // base-36 timestamp (compact)
  const randomPart = crypto.randomBytes(4).toString('hex');           // 8 hex chars
  return `ai_${timestamp}_${randomPart}`;
}

/**
 * Validate that a string looks like one of our AI request IDs.
 * Used defensively in logging / monitoring before trusting external values.
 * @param {string} id
 * @returns {boolean}
 */
function isValidRequestId(id) {
  return typeof id === 'string' && /^ai_[0-9a-z]+_[0-9a-f]{8}$/.test(id);
}

module.exports = { generateRequestId, isValidRequestId };
