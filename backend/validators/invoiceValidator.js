const { body, param, query } = require('express-validator');

const validateCreateInvoice = [
  body('booking_id').isInt({ min: 1 }).withMessage('booking_id must be a positive integer'),

  body('material_items')
    .optional()
    .isArray({ max: 50 }).withMessage('material_items must be an array of max 50 items'),

  body('material_items.*.name')
    .optional()
    .isString().isLength({ min: 1, max: 100 }).withMessage('Material item name is required (max 100 chars)'),

  body('material_items.*.qty')
    .optional()
    .isFloat({ min: 0.01 }).withMessage('Material qty must be > 0'),

  body('material_items.*.unit_cost')
    .optional()
    .isFloat({ min: 0 }).withMessage('unit_cost must be >= 0'),

  body('travel_cost')
    .optional()
    .isFloat({ min: 0 }).withMessage('travel_cost must be >= 0'),

  body('emergency_cost')
    .optional()
    .isFloat({ min: 0 }).withMessage('emergency_cost must be >= 0'),

  body('other_cost')
    .optional()
    .isFloat({ min: 0 }).withMessage('other_cost must be >= 0'),

  body('other_cost_note')
    .optional()
    .isString().isLength({ max: 300 }).trim(),

  body('discount')
    .optional()
    .isFloat({ min: 0 }).withMessage('discount must be >= 0'),

  body('service_description')
    .notEmpty().withMessage('service_description is required')
    .isLength({ min: 20, max: 1000 }).withMessage('Description must be 20–1000 characters')
    .trim(),

  body('notes')
    .optional()
    .isString().isLength({ max: 500 }).trim(),
];

const validateEditInvoice = [
  param('id').isInt({ min: 1 }).withMessage('Invoice ID must be a positive integer'),

  body('material_items').optional().isArray({ max: 50 }),
  body('travel_cost').optional().isFloat({ min: 0 }),
  body('emergency_cost').optional().isFloat({ min: 0 }),
  body('other_cost').optional().isFloat({ min: 0 }),
  body('other_cost_note').optional().isString().isLength({ max: 300 }).trim(),
  body('service_description').optional().isString().isLength({ min: 20, max: 1000 }).trim(),
  body('notes').optional().isString().isLength({ max: 500 }).trim(),
];

const validateGetInvoice = [
  param('id').isInt({ min: 1 }).withMessage('Invoice ID must be a positive integer'),
];

const validateListInvoices = [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('status').optional().isIn([
    'all','requested','viewed','accepted','rejected','expired','paid','cancelled','refunded','completed'
  ]),
  query('search').optional().isString().isLength({ max: 100 }).trim(),
];

const validateWithdraw = [
  param('id').isInt({ min: 1 }).withMessage('Invoice ID must be a positive integer'),
];

module.exports = {
  validateCreateInvoice,
  validateEditInvoice,
  validateGetInvoice,
  validateListInvoices,
  validateWithdraw,
};
