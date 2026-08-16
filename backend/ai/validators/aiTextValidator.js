'use strict';

/**
 * AI Text Input Validators
 * ------------------------
 * express-validator chains for AI text-based endpoints.
 * Follows the same pattern as existing HiFix validators in /validators/*.js.
 *
 * Provides:
 *   - validateAITextQuery   — for query/search style text inputs
 *   - validateAIAssistant   — for conversational assistant inputs
 *   - validateAIFeatureId   — for specifying which AI feature to invoke
 */

const { body, query, param } = require('express-validator');
const { AI_FEATURES }        = require('../prompts/promptRegistry');

// Maximum prompt/query character length allowed from clients
const MAX_PROMPT_LENGTH = 2000;
const MAX_NOTES_LENGTH  = 500;

/**
 * Validators for general AI text query endpoints.
 */
const validateAITextQuery = [
  body('prompt')
    .notEmpty()
    .withMessage('prompt is required')
    .isString()
    .withMessage('prompt must be a string')
    .isLength({ min: 3, max: MAX_PROMPT_LENGTH })
    .withMessage(`prompt must be between 3 and ${MAX_PROMPT_LENGTH} characters`)
    .trim(),

  body('feature')
    .optional()
    .isString()
    .withMessage('feature must be a string')
    .isIn(Object.values(AI_FEATURES))
    .withMessage(`feature must be one of: ${Object.values(AI_FEATURES).join(', ')}`),
];

/**
 * Validators for the AI Smart Assistant endpoint.
 */
const validateAIAssistant = [
  body('message')
    .notEmpty()
    .withMessage('message is required')
    .isString()
    .withMessage('message must be a string')
    .isLength({ min: 1, max: MAX_PROMPT_LENGTH })
    .withMessage(`message cannot exceed ${MAX_PROMPT_LENGTH} characters`)
    .trim(),

  body('context')
    .optional()
    .isString()
    .withMessage('context must be a string')
    .isLength({ max: MAX_NOTES_LENGTH })
    .withMessage(`context cannot exceed ${MAX_NOTES_LENGTH} characters`)
    .trim(),

  body('bookingId')
    .optional()
    .isInt({ min: 1 })
    .withMessage('bookingId must be a positive integer'),
];

/**
 * Validators for endpoints that accept a feature ID as a URL parameter.
 */
const validateAIFeatureParam = [
  param('feature')
    .isString()
    .withMessage('feature parameter is required')
    .isIn(Object.values(AI_FEATURES))
    .withMessage(`feature must be one of: ${Object.values(AI_FEATURES).join(', ')}`),
];

/**
 * Validators for AI cost estimation endpoint.
 */
const validateAICostEstimation = [
  body('description')
    .notEmpty()
    .withMessage('description is required')
    .isString()
    .withMessage('description must be a string')
    .isLength({ min: 10, max: MAX_PROMPT_LENGTH })
    .withMessage(`description must be between 10 and ${MAX_PROMPT_LENGTH} characters`)
    .trim(),

  body('serviceType')
    .notEmpty()
    .withMessage('serviceType is required')
    .isIn(['painter', 'electrician', 'plumber', 'carpenter', 'handyman', 'hvac', 'general'])
    .withMessage('Invalid serviceType'),

  body('city')
    .optional()
    .isString()
    .isLength({ max: 100 })
    .trim(),
];

module.exports = {
  validateAITextQuery,
  validateAIAssistant,
  validateAIFeatureParam,
  validateAICostEstimation,
};
