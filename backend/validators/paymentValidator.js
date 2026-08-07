const { body, param, query } = require('express-validator');
const { PAYMENT_METHOD, AMOUNT_LIMITS } = require('../config/payment');

/**
 * Validation rules for POST /payment/request
 */
const validatePaymentRequest = [
  body('booking_id')
    .notEmpty().withMessage('booking_id is required')
    .isInt({ min: 1 }).withMessage('booking_id must be a positive integer'),

  body('requested_amount')
    .notEmpty().withMessage('requested_amount is required')
    .isFloat({ min: AMOUNT_LIMITS.MIN, max: AMOUNT_LIMITS.MAX })
    .withMessage(
      `requested_amount must be between ${AMOUNT_LIMITS.MIN} and ${AMOUNT_LIMITS.MAX}`
    ),

  body('payment_method')
    .notEmpty().withMessage('payment_method is required')
    .isIn(Object.values(PAYMENT_METHOD))
    .withMessage(`payment_method must be one of: ${Object.values(PAYMENT_METHOD).join(', ')}`),

  body('notes')
    .optional()
    .isString().withMessage('notes must be a string')
    .isLength({ max: 500 }).withMessage('notes cannot exceed 500 characters')
    .trim(),
];

/**
 * Validation rules for GET /payment/history
 */
const validatePaymentHistory = [
  query('page')
    .optional()
    .isInt({ min: 1 }).withMessage('page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 }).withMessage('limit must be between 1 and 100'),

  query('status')
    .optional()
    .isIn(['pending', 'requested', 'paid', 'cancelled', 'refunded', 'completed'])
    .withMessage('Invalid status filter'),
];

/**
 * Validation rules for GET /payment/:id
 */
const validatePaymentId = [
  param('id')
    .isInt({ min: 1 }).withMessage('Payment ID must be a positive integer'),
];

/**
 * Validation rules for PATCH /payment/cancel
 */
const validatePaymentCancel = [
  body('payment_id')
    .notEmpty().withMessage('payment_id is required')
    .isInt({ min: 1 }).withMessage('payment_id must be a positive integer'),

  body('reason')
    .optional()
    .isString().withMessage('reason must be a string')
    .isLength({ max: 300 }).withMessage('reason cannot exceed 300 characters')
    .trim(),
];

module.exports = {
  validatePaymentRequest,
  validatePaymentHistory,
  validatePaymentId,
  validatePaymentCancel,
};
