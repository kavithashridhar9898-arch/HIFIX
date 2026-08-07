const { validationResult } = require('express-validator');
const PaymentService = require('../services/PaymentService');

/**
 * PaymentController — thin controller layer.
 * Reads the request, delegates to PaymentService, formats the response.
 */

// ─────────────────────────────────────────────────────────────
// Helper: validate express-validator results and throw if any
// ─────────────────────────────────────────────────────────────
function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.statusCode = 422;
    err.errors = errors.array().map(e => ({
      field:   e.path || e.param,
      message: e.msg,
    }));
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────
// POST /api/payment/request
// Access: Worker only
// ─────────────────────────────────────────────────────────────
exports.requestPayment = async (req, res, next) => {
  try {
    checkValidation(req);

    const { booking_id, requested_amount, payment_method, notes } = req.body;

    const payment = await PaymentService.requestPayment({
      bookingId:        parseInt(booking_id, 10),
      requestingUserId: req.user.id,
      requestedAmount:  parseFloat(requested_amount),
      paymentMethod:    payment_method,
      notes:            notes || null,
      req,
    });

    return res.status(201).json({
      success: true,
      message: 'Payment request created successfully',
      data:    { payment },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/payment/history
// Access: Authenticated users (own history only)
// ─────────────────────────────────────────────────────────────
exports.getHistory = async (req, res, next) => {
  try {
    checkValidation(req);

    const { status, page, limit } = req.query;

    const result = await PaymentService.getHistory({
      userId:   req.user.id,
      userType: req.user.user_type,
      status,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment history retrieved successfully',
      data:    result,
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// GET /api/payment/:id
// Access: Authenticated users (must be involved in the payment)
// ─────────────────────────────────────────────────────────────
exports.getPaymentById = async (req, res, next) => {
  try {
    checkValidation(req);

    const paymentId = parseInt(req.params.id, 10);

    const payment = await PaymentService.getPaymentById({
      paymentId,
      requestingUserId: req.user.id,
      userType:         req.user.user_type,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment retrieved successfully',
      data:    { payment },
    });
  } catch (err) {
    next(err);
  }
};

// ─────────────────────────────────────────────────────────────
// PATCH /api/payment/cancel
// Access: Authenticated users (customer or worker of that payment)
// ─────────────────────────────────────────────────────────────
exports.cancelPayment = async (req, res, next) => {
  try {
    checkValidation(req);

    const { payment_id, reason } = req.body;

    const payment = await PaymentService.cancelPayment({
      paymentId:        parseInt(payment_id, 10),
      requestingUserId: req.user.id,
      userType:         req.user.user_type,
      reason:           reason || null,
      req,
    });

    return res.status(200).json({
      success: true,
      message: 'Payment cancelled successfully',
      data:    { payment },
    });
  } catch (err) {
    next(err);
  }
};
