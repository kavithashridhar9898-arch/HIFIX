const { body, param, query } = require('express-validator');

const validateStartTimer = [
  body('booking_id').isInt({ min: 1 }).withMessage('booking_id must be a positive integer'),
];

const validateTimerAction = [
  body('booking_id').isInt({ min: 1 }).withMessage('booking_id must be a positive integer'),
];

const validateGetSession = [
  param('bookingId').isInt({ min: 1 }).withMessage('bookingId must be a positive integer'),
];

module.exports = { validateStartTimer, validateTimerAction, validateGetSession };
