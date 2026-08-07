const express = require('express');
const router  = express.Router();

const { protect, isWorker } = require('../middleware/auth');
const paymentController     = require('../controllers/paymentController');
const razorpayController    = require('../controllers/razorpayController');
const {
  validatePaymentRequest,
  validatePaymentHistory,
  validatePaymentId,
  validatePaymentCancel,
} = require('../validators/paymentValidator');

/**
 * Payment Routes
 * Base path: /api/payment  (registered in server.js)
 */

// ── Phase 3: Razorpay Payment Processing ─────────────────────────────────────

// POST /api/payment/order — Homeowner creates Razorpay order for an approved invoice
router.post('/order', protect, razorpayController.createOrder);

// POST /api/payment/verify — Homeowner verifies payment signature after checkout
router.post('/verify', protect, razorpayController.verifyPayment);

// POST /api/payment/webhook — Public Razorpay webhook endpoint
router.post('/webhook', razorpayController.handleWebhook);

// GET /api/payment/receipts — List digital receipts for current user
router.get('/receipts', protect, razorpayController.listReceipts);

// GET /api/payment/receipt/:invoiceId — Get digital receipt for a specific invoice
router.get('/receipt/:invoiceId', protect, razorpayController.getReceipt);

// GET /api/payment/earnings — Worker earnings dashboard
router.get('/earnings', protect, isWorker, razorpayController.getEarnings);

// GET /api/payment/admin/summary — Admin financial overview
router.get('/admin/summary', protect, razorpayController.getAdminSummary);


// ── Legacy / Basic Payment Flow ──────────────────────────────────────────────

// POST /api/payment/request
router.post(
  '/request',
  protect,
  isWorker,
  validatePaymentRequest,
  paymentController.requestPayment
);

// GET /api/payment/history
router.get(
  '/history',
  protect,
  validatePaymentHistory,
  paymentController.getHistory
);

// GET /api/payment/:id
router.get(
  '/:id',
  protect,
  validatePaymentId,
  paymentController.getPaymentById
);

// PATCH /api/payment/cancel
router.patch(
  '/cancel',
  protect,
  validatePaymentCancel,
  paymentController.cancelPayment
);

module.exports = router;
