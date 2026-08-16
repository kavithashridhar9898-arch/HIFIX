'use strict';

/**
 * AI Image Sanitizer
 * ------------------
 * Validates and prepares uploaded images for use in AI vision requests.
 * Provides secure preprocessing without exposing image data in logs.
 *
 * Responsibilities:
 *   - Verify file exists and is readable
 *   - Validate MIME type against allowlist
 *   - Validate file size against configured limit
 *   - Convert to base64 for AI vision API consumption
 *   - Schedule automatic cleanup of temporary files
 *
 * Does NOT perform any AI inference or diagnosis.
 * Phase 5.0: Infrastructure only.
 */

const fs   = require('fs');
const path = require('path');

// Allowed MIME types for AI image inputs.
// Loaded from environment with fallback. Comma-separated string.
function getAllowedTypes() {
  const envTypes = process.env.AI_IMAGE_ALLOWED_TYPES || 'jpeg,jpg,png,webp';
  return envTypes.split(',').map(t => t.trim().toLowerCase());
}

// Maximum image size in bytes. Default 10 MB.
function getMaxSizeBytes() {
  const mb = parseFloat(process.env.AI_IMAGE_MAX_SIZE_MB || '10');
  return mb * 1024 * 1024;
}

// How long (ms) to keep uploaded AI images before auto-deletion.
function getCleanupAfterMs() {
  return parseInt(process.env.AI_IMAGE_CLEANUP_AFTER_MS || '3600000', 10); // 1 hour default
}

/**
 * Validate an uploaded file object (from multer) for AI use.
 * Returns { valid: true, error: null } or { valid: false, error: string }.
 *
 * @param {object} file - multer file object
 * @returns {{ valid: boolean, error: string|null }}
 */
function validateImageFile(file) {
  if (!file) {
    return { valid: false, error: 'No file provided' };
  }

  // Extension and mimetype check
  const ext = path.extname(file.originalname || '').slice(1).toLowerCase();
  const mimeParts = (file.mimetype || '').split('/');
  const mimeSubtype = mimeParts[1] ? mimeParts[1].toLowerCase() : '';
  const allowedTypes = getAllowedTypes();

  const extAllowed  = allowedTypes.includes(ext);
  const mimeAllowed = allowedTypes.some(t => mimeSubtype.includes(t)) || mimeSubtype === 'jpeg';

  if (!extAllowed || !mimeAllowed) {
    return {
      valid: false,
      error: `File type not allowed. Allowed types: ${allowedTypes.join(', ')}`,
    };
  }

  // Size check
  const maxBytes = getMaxSizeBytes();
  if (file.size > maxBytes) {
    return {
      valid: false,
      error: `File exceeds maximum size of ${process.env.AI_IMAGE_MAX_SIZE_MB || 10}MB`,
    };
  }

  // Existence check
  if (!fs.existsSync(file.path)) {
    return { valid: false, error: 'Uploaded file not found on server' };
  }

  return { valid: true, error: null };
}

/**
 * Read an image file and return it as a base64-encoded string.
 * Intended for AI vision API consumption (NOT for client responses).
 *
 * @param {string} filePath - absolute path to the image file
 * @returns {string} base64 encoded image data
 * @throws {Error} if file cannot be read
 */
function imageToBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * Schedule automatic deletion of a temporary AI upload.
 * Fires after the configured cleanup interval.
 * Silently ignores errors if file was already removed.
 *
 * @param {string} filePath - absolute path to the file to clean up
 * @param {number} [delayMs] - override cleanup delay in ms
 */
function scheduleCleanup(filePath, delayMs) {
  const delay = delayMs ?? getCleanupAfterMs();
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_) {
      // Silent — cleanup is best-effort
    }
  }, delay);
}

/**
 * Immediately delete an AI temporary image.
 * Used when an error occurs during processing and the file should be removed ASAP.
 *
 * @param {string} filePath
 */
function deleteImageNow(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {
    // Silent — cleanup is best-effort
  }
}

module.exports = {
  validateImageFile,
  imageToBase64,
  scheduleCleanup,
  deleteImageNow,
  getAllowedTypes,
  getMaxSizeBytes,
};
