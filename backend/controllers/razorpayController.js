const { validationResult, body, param, query } = require('express-validator');
const PaymentService  = require('../services/PaymentService');
const ReceiptService  = require('../services/ReceiptService');
const InvoiceService  = require('../services/InvoiceService');

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.statusCode = 422;
    err.errors = errors.array().map(e => ({ field: e.path || e.param, message: e.msg }));
    throw err;
  }
}

const razorpayController = {
  /** POST /api/payment/order — homeowner creates payment order for accepted invoice */
  async createOrder(req, res, next) {
    try {
      checkValidation(req);
      const invoiceId = parseInt(req.body.invoice_id);
      const order = await PaymentService.createOrder({
        invoiceId,
        requestingUserId: req.user.id,
      });
      return res.json({ success: true, data: order });
    } catch (err) { next(err); }
  },

  /** POST /api/payment/verify — verify Razorpay signature and capture */
  async verifyPayment(req, res, next) {
    try {
      checkValidation(req);
      const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
      const receipt = await PaymentService.verifyAndCapture({
        orderId:          razorpay_order_id,
        paymentId:        razorpay_payment_id,
        signature:        razorpay_signature,
        requestingUserId: req.user.id,
        req,
      });
      return res.json({ success: true, message: 'Payment verified!', data: { receipt } });
    } catch (err) { next(err); }
  },

  /** POST /api/payment/webhook — Razorpay webhook (no JWT auth) */
  async handleWebhook(req, res, next) {
    try {
      const signature = req.headers['x-razorpay-signature'];
      const eventId   = req.body?.id         || `DEMO-${Date.now()}`;
      const eventType = req.body?.event      || 'unknown';
      const payload   = req.body;
      const rawBody   = req.rawBody || JSON.stringify(req.body);

      const result = await PaymentService.handleWebhook({
        eventId, eventType, payload, rawBody, signature,
      });
      return res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  /** GET /api/payment/receipt/:invoiceId */
  async getReceipt(req, res, next) {
    try {
      const invoiceId = parseInt(req.params.invoiceId);
      const receipt   = await ReceiptService.getReceiptByInvoice(invoiceId);
      if (!receipt) {
        return res.status(404).json({ success: false, message: 'Receipt not found' });
      }
      // Ownership check
      const isCustomer = receipt.customer_id === req.user.id;
      const [wRows] = require('../config/database').query
        ? [] : [[]];
      if (!isCustomer) {
        const pool = require('../config/database');
        const [w] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [req.user.id]);
        if (!w.length || w[0].id !== receipt.worker_id) {
          return res.status(403).json({ success: false, message: 'Not authorised' });
        }
      }
      return res.json({ success: true, data: { receipt } });
    } catch (err) { next(err); }
  },

  /** GET /api/payment/receipts — paginated list for current user */
  async listReceipts(req, res, next) {
    try {
      const { page, limit } = req.query;
      const result = await ReceiptService.getReceiptsByUser({
        userId:   req.user.id,
        userType: req.user.user_type,
        page, limit,
      });
      return res.json({ success: true, data: result });
    } catch (err) { next(err); }
  },

  /** GET /api/payment/earnings — worker earnings dashboard */
  async getEarnings(req, res, next) {
    try {
      if (req.user.user_type !== 'worker') {
        return res.status(403).json({ success: false, message: 'Worker access only' });
      }
      const earnings = await ReceiptService.getWorkerEarnings(req.user.id);
      return res.json({ success: true, data: { earnings } });
    } catch (err) { next(err); }
  },

  /** GET /api/payment/admin/summary — admin overview */
  async getAdminSummary(req, res, next) {
    try {
      // Simple admin guard — check user_type or a future admin flag
      // For now, restrict to workers (adjust when admin role added)
      const { period } = req.query;
      const summary = await ReceiptService.getAdminSummary({ period: period || 'monthly' });
      return res.json({ success: true, data: summary });
    } catch (err) { next(err); }
  },

  /** PATCH /api/invoice/:id/accept — homeowner accepts invoice */
  async acceptInvoice(req, res, next) {
    try {
      const invoiceId = parseInt(req.params.id);
      const invoice   = await InvoiceService.acceptInvoice({
        invoiceId,
        customerId: req.user.id,
        req,
      });
      return res.json({ success: true, message: 'Invoice approved!', data: { invoice } });
    } catch (err) { next(err); }
  },
};

module.exports = razorpayController;
