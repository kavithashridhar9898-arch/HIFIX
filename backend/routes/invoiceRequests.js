const express = require('express');
const router  = express.Router();
const pool    = require('../config/database');
const { validationResult } = require('express-validator');
const { protect, isWorker } = require('../middleware/auth');
const InvoiceService = require('../services/InvoiceService');
const {
  validateCreateInvoice,
  validateEditInvoice,
  validateGetInvoice,
  validateListInvoices,
  validateWithdraw,
} = require('../validators/invoiceValidator');

/**
 * Invoice Request Routes
 * Base: /api/invoice
 *
 * POST   /api/invoice/create           — Worker creates invoice (after timer complete)
 * GET    /api/invoice/my-requests      — List invoices (own, paginated, filterable)
 * GET    /api/invoice/:id              — Single invoice (marks viewed if homeowner)
 * PATCH  /api/invoice/:id/edit         — Edit invoice (if not yet viewed)
 * PATCH  /api/invoice/:id/withdraw     — Cancel invoice (if not yet viewed)
 */

function checkValidation(req) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const err = new Error('Validation failed');
    err.statusCode = 422;
    err.errors = errors.array().map(e => ({ field: e.path || e.param, message: e.msg }));
    throw err;
  }
}

async function getWorkerProfileId(userId) {
  const [rows] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [userId]);
  if (!rows.length) {
    const err = new Error('Worker profile not found'); err.statusCode = 404; throw err;
  }
  return rows[0].id;
}

// ── POST /api/invoice/create ─────────────────────────────────────────────────
router.post('/create', protect, isWorker, validateCreateInvoice, async (req, res, next) => {
  try {
    checkValidation(req);
    const workerId = await getWorkerProfileId(req.user.id);
    const invoice  = await InvoiceService.createInvoice({
      bookingId:          parseInt(req.body.booking_id),
      workerId,
      materialItems:      req.body.material_items      || [],
      travelCost:         parseFloat(req.body.travel_cost      || 0),
      emergencyCost:      parseFloat(req.body.emergency_cost   || 0),
      otherCost:          parseFloat(req.body.other_cost       || 0),
      otherCostNote:      req.body.other_cost_note || null,
      discount:           parseFloat(req.body.discount         || 0),
      serviceDescription: req.body.service_description,
      notes:              req.body.notes || null,
      req,
    });
    return res.status(201).json({
      success: true,
      message: 'Payment request sent successfully',
      data: { invoice },
    });
  } catch (err) { next(err); }
});

// ── GET /api/invoice/my-requests ─────────────────────────────────────────────
// NOTE: must be before /:id
router.get('/my-requests', protect, validateListInvoices, async (req, res, next) => {
  try {
    checkValidation(req);
    const { status, search, page, limit } = req.query;
    const result = await InvoiceService.getInvoiceList({
      requestingUserId: req.user.id,
      userType:         req.user.user_type,
      status, search, page, limit,
    });
    return res.json({ success: true, data: result });
  } catch (err) { next(err); }
});

// ── GET /api/invoice/booking/:bookingId ──────────────────────────────────────
router.get('/booking/:bookingId', protect, async (req, res, next) => {
  try {
    const bookingId = parseInt(req.params.bookingId);
    if (isNaN(bookingId)) {
      return res.status(400).json({ success: false, message: 'Invalid booking ID' });
    }
    const invoice = await InvoiceService.getInvoiceByBookingId({
      bookingId,
      requestingUserId: req.user.id,
      userType: req.user.user_type,
    });
    return res.json({ success: true, data: { invoice } });
  } catch (err) { next(err); }
});

// ── GET /api/invoice/:id ──────────────────────────────────────────────────────
router.get('/:id', protect, validateGetInvoice, async (req, res, next) => {
  try {
    checkValidation(req);
    const invoice = await InvoiceService.getInvoiceById({
      invoiceId:        parseInt(req.params.id),
      requestingUserId: req.user.id,
      userType:         req.user.user_type,
    });
    return res.json({ success: true, data: { invoice } });
  } catch (err) { next(err); }
});

// ── PATCH /api/invoice/:id/edit ───────────────────────────────────────────────
router.patch('/:id/edit', protect, isWorker, validateEditInvoice, async (req, res, next) => {
  try {
    checkValidation(req);
    const workerId = await getWorkerProfileId(req.user.id);
    const invoice  = await InvoiceService.editInvoice({
      invoiceId:          parseInt(req.params.id),
      workerId,
      materialItems:      req.body.material_items,
      travelCost:         req.body.travel_cost,
      emergencyCost:      req.body.emergency_cost,
      otherCost:          req.body.other_cost,
      otherCostNote:      req.body.other_cost_note,
      serviceDescription: req.body.service_description,
      notes:              req.body.notes,
    });
    return res.json({ success: true, message: 'Invoice updated', data: { invoice } });
  } catch (err) { next(err); }
});

// ── PATCH /api/invoice/:id/withdraw ──────────────────────────────────────────
router.patch('/:id/withdraw', protect, isWorker, validateWithdraw, async (req, res, next) => {
  try {
    checkValidation(req);
    const workerId = await getWorkerProfileId(req.user.id);
    const result   = await InvoiceService.withdrawInvoice({
      invoiceId: parseInt(req.params.id),
      workerId,
    });
    return res.json(result);
  } catch (err) { next(err); }
});

// ── PATCH /api/invoice/:id/accept ────────────────────────────────────────────
// Homeowner approves the invoice — unlocks Pay Now button
router.patch('/:id/accept', protect, async (req, res, next) => {
  try {
    const invoiceId = parseInt(req.params.id);
    if (isNaN(invoiceId)) {
      return res.status(400).json({ success: false, message: 'Invalid invoice ID' });
    }
    const InvoiceService = require('../services/InvoiceService');
    const invoice = await InvoiceService.acceptInvoice({
      invoiceId,
      customerId: req.user.id,
      req,
    });
    return res.json({ success: true, message: 'Invoice approved!', data: { invoice } });
  } catch (err) { next(err); }
});

// ── PUT /api/invoice/:id ──────────────────────────────────────────────────────
// Alias for PATCH /:id/edit — used by InvoiceEditScreen frontend
router.put('/:id', protect, isWorker, validateEditInvoice, async (req, res, next) => {
  try {
    checkValidation(req);
    const workerId = await getWorkerProfileId(req.user.id);
    const invoice  = await InvoiceService.editInvoice({
      invoiceId:          parseInt(req.params.id),
      workerId,
      materialItems:      req.body.material_items,
      travelCost:         req.body.travel_cost,
      emergencyCost:      req.body.emergency_cost,
      otherCost:          req.body.other_cost,
      otherCostNote:      req.body.other_cost_note,
      serviceDescription: req.body.service_description,
      notes:              req.body.notes,
    });
    return res.json({ success: true, message: 'Invoice updated', data: { invoice } });
  } catch (err) { next(err); }
});

module.exports = router;
