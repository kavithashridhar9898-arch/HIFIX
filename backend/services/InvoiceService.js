const pool = require('../config/database');
const NotificationService = require('./NotificationService');

/**
 * InvoiceService
 * Business logic for invoice creation, validation, retrieval, and status management.
 */

// ── Constants ──────────────────────────────────────────────────────────────────
const RATE_LIMIT_MAX      = 5;   // max invoice requests per worker per hour
const MAX_MATERIAL_ITEMS  = 50;
const MIN_DESCRIPTION_LEN = 20;
const MAX_DESCRIPTION_LEN = 1000;
const MAX_ITEM_NAME_LEN   = 100;

// ── Invoice status sets ────────────────────────────────────────────────────────
const EDITABLE_STATUSES  = ['requested'];   // worker can edit
const TERMINAL_STATUSES  = ['paid', 'completed', 'cancelled', 'refunded'];

const InvoiceService = {

  // ── Labour Calculation ───────────────────────────────────────────────────────

  /**
   * Calculate labour cost from worked seconds and hourly rate.
   * Formula: hourly_rate × (worked_seconds / 3600), rounded to 2 dp.
   */
  calcLabourCost(workedSeconds, hourlyRate) {
    return Math.round((hourlyRate * (workedSeconds / 3600)) * 100) / 100;
  },

  /**
   * Calculate material total from array of items.
   */
  calcMaterialCost(items = []) {
    return Math.round(items.reduce((sum, item) => sum + (item.qty * item.unit_cost), 0) * 100) / 100;
  },

  /**
   * Calculate grand total.
   * Applies minimum service charge if (labour + material) < min_charge.
   */
  calcGrandTotal({ labourCost, materialCost, travelCost, emergencyCost, otherCost, discount, tax, platformFee, minCharge }) {
    const subtotal = labourCost + materialCost;
    const effectiveSubtotal = (minCharge > 0 && subtotal < minCharge) ? minCharge : subtotal;
    const total = effectiveSubtotal + travelCost + emergencyCost + otherCost - discount + tax + platformFee;
    return Math.round(Math.max(0, total) * 100) / 100;
  },

  // ── Rate Limiting ────────────────────────────────────────────────────────────

  async _checkRateLimit(workerId) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS cnt FROM invoice_requests
       WHERE worker_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)`,
      [workerId]
    );
    if (rows[0].cnt >= RATE_LIMIT_MAX) {
      const err = new Error(`Rate limit exceeded: maximum ${RATE_LIMIT_MAX} payment requests per hour`);
      err.statusCode = 429;
      throw err;
    }
  },

  // ── Validation ───────────────────────────────────────────────────────────────

  _validateMaterialItems(items) {
    if (!Array.isArray(items)) {
      const err = new Error('material_items must be an array'); err.statusCode = 422; throw err;
    }
    if (items.length > MAX_MATERIAL_ITEMS) {
      const err = new Error(`Maximum ${MAX_MATERIAL_ITEMS} material items allowed`); err.statusCode = 422; throw err;
    }
    for (const item of items) {
      if (!item.name || typeof item.name !== 'string' || item.name.trim().length === 0) {
        const err = new Error('Each material item must have a non-empty name'); err.statusCode = 422; throw err;
      }
      if (item.name.length > MAX_ITEM_NAME_LEN) {
        const err = new Error(`Material name cannot exceed ${MAX_ITEM_NAME_LEN} characters`); err.statusCode = 422; throw err;
      }
      if (typeof item.qty !== 'number' || item.qty <= 0) {
        const err = new Error('Material quantity must be a positive number'); err.statusCode = 422; throw err;
      }
      if (typeof item.unit_cost !== 'number' || item.unit_cost < 0) {
        const err = new Error('Material unit_cost must be a non-negative number'); err.statusCode = 422; throw err;
      }
    }
  },

  _validateAmounts({ travelCost, emergencyCost, otherCost, discount }) {
    const fields = { travelCost, emergencyCost, otherCost, discount };
    for (const [name, val] of Object.entries(fields)) {
      if (val < 0) {
        const err = new Error(`${name} cannot be negative`); err.statusCode = 422; throw err;
      }
    }
  },

  // ── CRUD Operations ──────────────────────────────────────────────────────────

  /**
   * Create and send an invoice request.
   * Requires a completed, locked work_session for the booking.
   */
  async createInvoice({
    bookingId, workerId, materialItems = [], travelCost = 0, emergencyCost = 0,
    otherCost = 0, otherCostNote = null, discount = 0, serviceDescription, notes = null, req,
  }) {
    // 1. Rate limit
    await this._checkRateLimit(workerId);

    // 2. Verify booking + get worker/customer details
    const [bookings] = await pool.query(
      `SELECT b.id, b.status, b.homeowner_id,
              w.id as worker_profile_id, w.hourly_rate, w.min_charge,
              u_worker.name as worker_name,
              u_customer.name as customer_name
       FROM bookings b
       INNER JOIN workers w ON b.worker_id = w.id
       INNER JOIN users u_worker ON w.user_id = u_worker.id
       INNER JOIN users u_customer ON b.homeowner_id = u_customer.id
       WHERE b.id = ? AND w.id = ?`,
      [bookingId, workerId]
    );
    if (bookings.length === 0) {
      const err = new Error('Booking not found or you are not the assigned worker'); err.statusCode = 404; throw err;
    }
    const booking = bookings[0];

    // 3. Verify completed work session
    const [sessions] = await pool.query(
      `SELECT * FROM work_sessions WHERE booking_id = ? AND status = 'completed' AND locked = TRUE`,
      [bookingId]
    );
    if (sessions.length === 0) {
      const err = new Error('You must complete the work timer before creating an invoice'); err.statusCode = 400; throw err;
    }
    const session = sessions[0];

    // 4. Prevent duplicate active invoices
    const [existing] = await pool.query(
      `SELECT id, status FROM invoice_requests
       WHERE booking_id = ? AND status NOT IN ('cancelled','refunded','rejected') LIMIT 1`,
      [bookingId]
    );
    if (existing.length > 0) {
      const err = new Error(`An active invoice (id: ${existing[0].id}, status: ${existing[0].status}) already exists for this booking`);
      err.statusCode = 409; throw err;
    }

    // 5. Validate inputs
    this._validateMaterialItems(materialItems);
    this._validateAmounts({ travelCost, emergencyCost, otherCost, discount });

    if (!serviceDescription || serviceDescription.trim().length < MIN_DESCRIPTION_LEN) {
      const err = new Error(`Service description must be at least ${MIN_DESCRIPTION_LEN} characters`); err.statusCode = 422; throw err;
    }
    if (serviceDescription.length > MAX_DESCRIPTION_LEN) {
      const err = new Error(`Service description cannot exceed ${MAX_DESCRIPTION_LEN} characters`); err.statusCode = 422; throw err;
    }

    // 6. Calculate costs
    const workedSeconds  = Math.floor(Number(session.total_duration_ms) / 1000);
    const hourlyRate     = parseFloat(booking.hourly_rate) || 0;
    const minCharge      = parseFloat(booking.min_charge) || 0;

    const labourCost     = this.calcLabourCost(workedSeconds, hourlyRate);
    const materialCost   = this.calcMaterialCost(materialItems);

    const grandTotal = this.calcGrandTotal({
      labourCost, materialCost,
      travelCost:    parseFloat(travelCost),
      emergencyCost: parseFloat(emergencyCost),
      otherCost:     parseFloat(otherCost),
      discount:      parseFloat(discount),
      tax: 0, platformFee: 0, minCharge,
    });

    if (grandTotal <= 0) {
      const err = new Error('Grand total must be greater than zero'); err.statusCode = 422; throw err;
    }

    // 7. Insert invoice
    const [result] = await pool.query(
      `INSERT INTO invoice_requests
         (booking_id, worker_id, customer_id, hourly_rate_snapshot, worked_seconds,
          labour_cost, material_items, material_cost, travel_cost, emergency_cost,
          other_cost, other_cost_note, discount, tax, platform_fee, grand_total,
          service_description, notes, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, ?, ?, 'requested')`,
      [
        bookingId, workerId, booking.homeowner_id,
        hourlyRate, workedSeconds, labourCost,
        JSON.stringify(materialItems), materialCost,
        travelCost, emergencyCost, otherCost, otherCostNote,
        discount, grandTotal, serviceDescription.trim(), notes,
      ]
    );

    const invoiceId = result.insertId;

    // 8. Notifications (non-fatal)
    try {
      // Notify worker
      await NotificationService.sendNotification({
        req,
        userId: req.user.id,
        title: '✅ Payment Request Sent',
        message: `Your payment request of ₹${grandTotal.toLocaleString('en-IN')} for Booking #${bookingId} has been sent.`,
        type: 'payment',
        relatedEntityId: invoiceId,
      });

      // Notify customer
      await NotificationService.sendNotification({
        req,
        userId: booking.homeowner_id,
        title: '💳 New Payment Request',
        message: `${booking.worker_name} has sent a payment request of ₹${grandTotal.toLocaleString('en-IN')} for Booking #${bookingId}.`,
        type: 'payment',
        relatedEntityId: invoiceId,
      });
    } catch (_) {}

    return this.getInvoiceById({ invoiceId, requestingUserId: req.user.id, userType: 'worker' });
  },

  /**
   * Fetch one invoice — with ownership check.
   * If homeowner opens it, mark viewed_at (locks worker editing).
   */
  async getInvoiceById({ invoiceId, requestingUserId, userType }) {
    const [rows] = await pool.query(
      `SELECT ir.*,
              u_worker.name   AS worker_name,
              u_worker.email  AS worker_email,
              u_worker.phone  AS worker_phone,
              u_worker.profile_image AS worker_photo,
              u_customer.name  AS customer_name,
              u_customer.email AS customer_email,
              u_customer.phone AS customer_phone,
              u_customer.profile_image AS customer_photo,
              w.service_type, w.average_rating,
              b.booking_date, b.address as booking_address
       FROM invoice_requests ir
       INNER JOIN workers w        ON ir.worker_id   = w.id
       INNER JOIN users u_worker   ON w.user_id       = u_worker.id
       INNER JOIN users u_customer ON ir.customer_id  = u_customer.id
       INNER JOIN bookings b       ON ir.booking_id   = b.id
       WHERE ir.id = ?`,
      [invoiceId]
    );
    if (rows.length === 0) {
      const err = new Error('Invoice not found'); err.statusCode = 404; throw err;
    }
    const invoice = rows[0];

    // Authorization
    const isCustomer = userType === 'homeowner' && invoice.customer_id === requestingUserId;
    const isWorker   = userType === 'worker'    && invoice.worker_id !== undefined;

    if (userType === 'worker') {
      // Confirm this worker owns it
      const [w] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [requestingUserId]);
      if (!w.length || w[0].id !== invoice.worker_id) {
        const err = new Error('Not authorised'); err.statusCode = 403; throw err;
      }
    } else if (!isCustomer) {
      const err = new Error('Not authorised'); err.statusCode = 403; throw err;
    }

    // Mark viewed if homeowner viewing for the first time
    if (isCustomer && !invoice.viewed_at && invoice.status === 'requested') {
      await pool.query(
        `UPDATE invoice_requests SET status = 'viewed', viewed_at = NOW() WHERE id = ?`,
        [invoiceId]
      );
      invoice.status = 'viewed';
      invoice.viewed_at = new Date().toISOString();
    }

    // Parse material_items JSON if stored as string
    if (typeof invoice.material_items === 'string') {
      try { invoice.material_items = JSON.parse(invoice.material_items); } catch (_) {}
    }

    return invoice;
  },

  /**
   * Fetch invoice by bookingId with authorization check.
   */
  async getInvoiceByBookingId({ bookingId, requestingUserId, userType }) {
    const [rows] = await pool.query(
      `SELECT ir.id FROM invoice_requests ir WHERE ir.booking_id = ? ORDER BY ir.id DESC LIMIT 1`,
      [bookingId]
    );
    if (rows.length === 0) {
      return null;
    }
    return this.getInvoiceById({ invoiceId: rows[0].id, requestingUserId, userType });
  },

  /**
   * Get paginated invoice list for a worker or customer.
   */
  async getInvoiceList({ requestingUserId, userType, status, search, page = 1, limit = 10 }) {
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset   = (pageNum - 1) * limitNum;

    let workerProfileId = null;
    if (userType === 'worker') {
      const [w] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [requestingUserId]);
      if (!w.length) return { invoices: [], pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 } };
      workerProfileId = w[0].id;
    }

    const conditions = [];
    const params = [];

    if (userType === 'worker') {
      conditions.push('ir.worker_id = ?');
      params.push(workerProfileId);
    } else {
      conditions.push('ir.customer_id = ?');
      params.push(requestingUserId);
    }

    if (status && status !== 'all') {
      conditions.push('ir.status = ?');
      params.push(status);
    }

    if (search) {
      conditions.push('(ir.booking_id LIKE ? OR u_customer.name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseFrom = `
      FROM invoice_requests ir
      INNER JOIN workers w        ON ir.worker_id   = w.id
      INNER JOIN users u_worker   ON w.user_id       = u_worker.id
      INNER JOIN users u_customer ON ir.customer_id  = u_customer.id
      ${where}
    `;

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${baseFrom}`, params);
    const total = countRows[0].total;

    const [invoices] = await pool.query(
      `SELECT ir.id, ir.booking_id, ir.grand_total, ir.status, ir.created_at,
              ir.viewed_at, ir.labour_cost, ir.material_cost, ir.worked_seconds,
              u_customer.name AS customer_name, u_customer.profile_image AS customer_photo,
              u_worker.name AS worker_name, u_worker.profile_image AS worker_photo
       ${baseFrom}
       ORDER BY ir.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limitNum, offset]
    );

    return {
      invoices,
      pagination: {
        total, page: pageNum, limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    };
  },

  /**
   * Edit an invoice — only allowed if homeowner hasn't viewed it yet.
   */
  async editInvoice({ invoiceId, workerId, materialItems, travelCost, emergencyCost, otherCost, otherCostNote, serviceDescription, notes }) {
    const [rows] = await pool.query('SELECT * FROM invoice_requests WHERE id = ?', [invoiceId]);
    if (!rows.length) {
      const err = new Error('Invoice not found'); err.statusCode = 404; throw err;
    }
    const invoice = rows[0];

    if (invoice.worker_id !== workerId) {
      const err = new Error('Not authorised'); err.statusCode = 403; throw err;
    }
    if (invoice.viewed_at) {
      const err = new Error('Invoice can no longer be edited — the customer has already viewed it'); err.statusCode = 400; throw err;
    }
    if (!EDITABLE_STATUSES.includes(invoice.status)) {
      const err = new Error(`Invoice cannot be edited in status '${invoice.status}'`); err.statusCode = 400; throw err;
    }

    const mItems = materialItems || JSON.parse(invoice.material_items || '[]');
    this._validateMaterialItems(mItems);

    const materialCost   = this.calcMaterialCost(mItems);
    const labourCost     = parseFloat(invoice.labour_cost);
    const newTravelCost  = parseFloat(travelCost  ?? invoice.travel_cost);
    const newEmergency   = parseFloat(emergencyCost ?? invoice.emergency_cost);
    const newOtherCost   = parseFloat(otherCost   ?? invoice.other_cost);

    // Get min_charge
    const [workers] = await pool.query('SELECT min_charge FROM workers WHERE id = ?', [workerId]);
    const minCharge = workers.length ? parseFloat(workers[0].min_charge) : 0;

    const grandTotal = this.calcGrandTotal({
      labourCost, materialCost,
      travelCost:    newTravelCost,
      emergencyCost: newEmergency,
      otherCost:     newOtherCost,
      discount:      parseFloat(invoice.discount),
      tax: 0, platformFee: 0, minCharge,
    });

    await pool.query(
      `UPDATE invoice_requests
       SET material_items = ?, material_cost = ?, travel_cost = ?, emergency_cost = ?,
           other_cost = ?, other_cost_note = ?, service_description = ?, notes = ?,
           grand_total = ?, updated_at = NOW()
       WHERE id = ?`,
      [
        JSON.stringify(mItems), materialCost, newTravelCost, newEmergency,
        newOtherCost, otherCostNote ?? invoice.other_cost_note,
        serviceDescription ? serviceDescription.trim() : invoice.service_description,
        notes ?? invoice.notes,
        grandTotal, invoiceId,
      ]
    );

    return pool.query('SELECT * FROM invoice_requests WHERE id = ?', [invoiceId]).then(([r]) => r[0]);
  },

  /**
   * Accept an invoice — homeowner approves it, unlocking the Pay button.
   * Allowed from status: 'requested' or 'viewed' (homeowner may or may not have opened it).
   */
  async acceptInvoice({ invoiceId, customerId, req }) {
    const [rows] = await pool.query(
      `SELECT ir.*, u_w.name AS worker_name
       FROM invoice_requests ir
       INNER JOIN workers w   ON ir.worker_id  = w.id
       INNER JOIN users u_w   ON w.user_id      = u_w.id
       WHERE ir.id = ?`,
      [invoiceId]
    );
    if (!rows.length) {
      const err = new Error('Invoice not found'); err.statusCode = 404; throw err;
    }
    const invoice = rows[0];

    if (invoice.customer_id !== customerId) {
      const err = new Error('Not authorised'); err.statusCode = 403; throw err;
    }

    const acceptableStatuses = ['requested', 'viewed'];
    if (!acceptableStatuses.includes(invoice.status)) {
      const err = new Error(`Invoice cannot be approved in status '${invoice.status}'`);
      err.statusCode = 400; throw err;
    }

    await pool.query(
      `UPDATE invoice_requests
       SET status = 'accepted', accepted_at = NOW(), updated_at = NOW()
       WHERE id = ?`,
      [invoiceId]
    );

    // Trigger async non-blocking Blockchain Registration for Certificate
    try {
      const BlockchainQueue = require('./BlockchainQueue');
      BlockchainQueue.enqueueCertificateRegistration({
        bookingId: invoice.booking_id,
        invoiceId: invoice.id,
        workerId: invoice.worker_id,
        customerId: invoice.customer_id,
        req,
      });
    } catch (_) {}

    // Notify worker
    try {
      await NotificationService.sendNotification({
        req,
        userId: req?.user?.id !== undefined ? undefined : null,
        title:  '✅ Invoice Approved!',
        message: `Your invoice #${invoiceId} has been approved. Payment is on the way.`,
        type:   'payment',
        relatedEntityId: invoiceId,
      });
      // Notify via worker user_id
      const [wUser] = await pool.query(
        'SELECT user_id FROM workers WHERE id = ?', [invoice.worker_id]
      );
      if (wUser.length > 0) {
        await NotificationService.sendNotification({
          req,
          userId:  wUser[0].user_id,
          title:   '✅ Invoice Approved!',
          message: `Invoice #${invoiceId} (₹${parseFloat(invoice.grand_total).toLocaleString('en-IN')}) has been approved by the customer.`,
          type:    'payment',
          relatedEntityId: invoiceId,
        });
      }
    } catch (_) {}

    const [updated] = await pool.query(
      'SELECT * FROM invoice_requests WHERE id = ?', [invoiceId]
    );
    return updated[0];
  },

  /**
   * Withdraw (cancel) an invoice — only if homeowner hasn't viewed.
   */
  async withdrawInvoice({ invoiceId, workerId }) {
    const [rows] = await pool.query('SELECT * FROM invoice_requests WHERE id = ?', [invoiceId]);
    if (!rows.length) {
      const err = new Error('Invoice not found'); err.statusCode = 404; throw err;
    }
    const invoice = rows[0];
    if (invoice.worker_id !== workerId) {
      const err = new Error('Not authorised'); err.statusCode = 403; throw err;
    }
    if (invoice.viewed_at) {
      const err = new Error('Invoice cannot be withdrawn — the customer has already viewed it'); err.statusCode = 400; throw err;
    }
    if (TERMINAL_STATUSES.includes(invoice.status)) {
      const err = new Error(`Cannot withdraw invoice in terminal status '${invoice.status}'`); err.statusCode = 400; throw err;
    }

    await pool.query(
      `UPDATE invoice_requests SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [invoiceId]
    );

    return { success: true, message: 'Invoice withdrawn successfully' };
  },
};

module.exports = InvoiceService;
