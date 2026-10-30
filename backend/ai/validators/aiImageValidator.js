'use strict';

/**
 * AI Image Upload Validators
 * --------------------------
 * express-validator chains for AI image upload and diagnosis endpoints.
 */

const { body } = require('express-validator');
const { getAllowedTypes, getMaxSizeBytes } = require('../utils/imageSanitizer');

const validateAIImageUpload = [
  body('context')
    .optional()
    .isString()
    .withMessage('context must be a string')
    .isLength({ max: 1000 })
    .withMessage('context cannot exceed 1000 characters')
    .trim(),

  body('serviceContext')
    .optional()
    .isString()
    .withMessage('serviceContext must be a string')
    .isLength({ max: 1000 })
    .withMessage('serviceContext cannot exceed 1000 characters')
    .trim(),

  body('extractedText')
    .optional()
    .isString()
    .isLength({ max: 2000 })
    .trim(),

  body('propertyType')
    .optional()
    .isString()
    .isLength({ max: 120 })
    .trim(),

  body('affectedArea')
    .optional()
    .isString()
    .isLength({ max: 120 })
    .trim(),

  body('locationContext')
    .optional()
    .isString()
    .isLength({ max: 300 })
    .trim(),

  body('previousObservations')
    .optional()
    .isString()
    .isLength({ max: 1000 })
    .trim(),

  body('serviceTypeHint')
    .optional()
    .isString()
    .withMessage('serviceTypeHint must be a string')
    .isIn(['painter', 'electrician', 'plumber', 'carpenter', 'handyman', 'hvac', 'general'])
    .withMessage('Invalid serviceTypeHint value'),
];

function aiImageFileFilter(req, file, cb) {
  const allowedTypes = getAllowedTypes();
  const nameParts = (file.originalname || '').split('.');
  const ext = nameParts.length > 1 ? nameParts.pop().toLowerCase() : '';
  const mime = (file.mimetype || '').toLowerCase();

  const extOk  = ext ? allowedTypes.includes(ext) : true;
  const mimeOk = mime.startsWith('image/') &&
    allowedTypes.some(t => mime.includes(t) || (t === 'jpg' && mime.includes('jpeg')));

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    cb(new Error(`File type not allowed. Allowed: ${allowedTypes.join(', ')}`));
  }
}

const aiImageMulterOptions = {
  limits: {
    fileSize: getMaxSizeBytes(),
    files:    1,
  },
  fileFilter: aiImageFileFilter,
};

module.exports = { validateAIImageUpload, aiImageFileFilter, aiImageMulterOptions };
