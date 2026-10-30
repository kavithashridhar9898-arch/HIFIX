'use strict';

/**
 * AI Image Sanitizer
 * ------------------
 * Validates and prepares uploaded images for use in AI vision requests.
 * Provides secure preprocessing without exposing image data in logs.
 */

const fs   = require('fs');
const path = require('path');

function getAllowedTypes() {
  const envTypes = process.env.AI_IMAGE_ALLOWED_TYPES || 'jpeg,jpg,png,webp';
  return envTypes.split(',').map(t => t.trim().toLowerCase());
}

function getMaxSizeBytes() {
  const mb = parseFloat(process.env.AI_IMAGE_MAX_SIZE_MB || '10');
  return mb * 1024 * 1024;
}

function getCleanupAfterMs() {
  return parseInt(process.env.AI_IMAGE_CLEANUP_AFTER_MS || '3600000', 10);
}

/**
 * Normalize image MIME type for vision providers (e.g. image/jpg -> image/jpeg).
 */
function normalizeImageMimeType(mimetype = 'image/jpeg', originalname = '') {
  const raw = String(mimetype || '').toLowerCase().trim();
  if (raw === 'image/jpg' || raw === 'image/jpeg') return 'image/jpeg';
  if (raw === 'image/png') return 'image/png';
  if (raw === 'image/webp') return 'image/webp';

  const ext = path.extname(originalname || '').slice(1).toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  return 'image/jpeg';
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

  const ext = path.extname(file.originalname || '').slice(1).toLowerCase();
  const mimeParts = (file.mimetype || '').split('/');
  const mimeSubtype = mimeParts[1] ? mimeParts[1].toLowerCase() : '';
  const allowedTypes = getAllowedTypes();

  // If extension is present, it must be in allowedTypes; if missing on a mobile blob, infer from valid image/* mime
  const extAllowed  = ext ? allowedTypes.includes(ext) : Boolean(mimeSubtype);
  const mimeAllowed = allowedTypes.some(t => mimeSubtype.includes(t)) || mimeSubtype === 'jpeg' || mimeSubtype === 'jpg';

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
 */
function imageToBase64(filePath) {
  const buffer = fs.readFileSync(filePath);
  return buffer.toString('base64');
}

/**
 * Schedule automatic deletion of a temporary AI upload.
 */
function scheduleCleanup(filePath, delayMs) {
  const delay = delayMs ?? getCleanupAfterMs();
  setTimeout(() => {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (_) {}
  }, delay);
}

/**
 * Immediately delete an AI temporary image.
 */
function deleteImageNow(filePath) {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (_) {}
}

module.exports = {
  validateImageFile,
  normalizeImageMimeType,
  imageToBase64,
  scheduleCleanup,
  deleteImageNow,
  getAllowedTypes,
  getMaxSizeBytes,
};
