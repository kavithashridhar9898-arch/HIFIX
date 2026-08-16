'use strict';

/**
 * AI Image Upload Validators
 * --------------------------
 * express-validator chains for AI image upload endpoints.
 * Follows the same pattern as existing HiFix validators in /validators/*.js.
 *
 * Note: Multer handles file presence and size at the middleware level.
 * These validators provide application-layer validation on top of that.
 * Phase 5.0: Infrastructure only — no diagnosis performed.
 */

const { body } = require('express-validator');
const { getAllowedTypes, getMaxSizeBytes } = require('../utils/imageSanitizer');

/**
 * Validators for POST /api/ai/image/upload
 * Validates metadata fields sent alongside the image file.
 */
const validateAIImageUpload = [
  // Optional context description from the user
  body('context')
    .optional()
    .isString()
    .withMessage('context must be a string')
    .isLength({ max: 500 })
    .withMessage('context cannot exceed 500 characters')
    .trim(),

  // Optional service type hint
  body('serviceTypeHint')
    .optional()
    .isString()
    .withMessage('serviceTypeHint must be a string')
    .isIn(['painter', 'electrician', 'plumber', 'carpenter', 'handyman', 'hvac', 'general'])
    .withMessage('Invalid serviceTypeHint value'),
];

/**
 * Custom multer file filter for AI image uploads.
 * Used when configuring the multer instance for AI upload routes.
 *
 * @param {object} req
 * @param {object} file - multer file object
 * @param {Function} cb
 */
function aiImageFileFilter(req, file, cb) {
  const allowedTypes = getAllowedTypes();
  const ext = (file.originalname || '').split('.').pop().toLowerCase();
  const mime = (file.mimetype || '').toLowerCase();

  const extOk  = allowedTypes.includes(ext);
  const mimeOk = mime.startsWith('image/') &&
    allowedTypes.some(t => mime.includes(t) || (t === 'jpg' && mime.includes('jpeg')));

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`));
  }
}

/**
 * Multer options for AI image uploads.
 * Import and spread into multer configuration in the route file.
 */
const aiImageMulterOptions = {
  limits: {
    fileSize: getMaxSizeBytes(),
    files:    1, // Only one image per AI request
  },
  fileFilter: aiImageFileFilter,
};

module.exports = { validateAIImageUpload, aiImageFileFilter, aiImageMulterOptions };
