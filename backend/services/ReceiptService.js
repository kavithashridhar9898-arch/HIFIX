const pool = require('../config/database');

/**
 * ReceiptService — generates and retrieves digital payment receipts.
 * Receipt numbers follow the format: HIFIX-YYYY-NNNNN (zero-padded, sequential per year).
 */

const ReceiptService = {
  /**
   * Generate a unique receipt number: HIFIX-2024-00042
   */
  async _generateReceiptNumber() {
    const year = new Date().getFullYear();
    const prefix = `HIFIX-${year}-`;

    const [rows] = await pool.query(
      `SELECT receipt_number FROM payment_receipts
       WHERE receipt_number LIKE ?
       ORDER BY id DESC LIMIT 1`,
      [`${prefix}%`]
    );

    let seq = 1;
    if (rows.length > 0) {
      const last = rows[0].receipt_number;
      const lastSeq = parseInt(last.replace(prefix, ''), 10);
      seq = lastSeq + 1;
    }

    return `${prefix}${String(seq).padStart(5, '0')}`;
  },

  /**
   * Create a receipt after successful payment verification.
   */
  async generateReceipt({
    invoiceId,
    bookingId,
    razorpayPaymentId,
    razorpayOrderId,
    razorpaySignature,
    amount,
    paymentMethod = 'online',
    workerId,
    customerId,
    paidAt = new Date(),
  }) {
    // Prevent duplicate receipts (idempotent)
    const [existing] = await pool.query(
      'SELECT * FROM payment_receipts WHERE invoice_id = ?',
      [invoiceId]
    );
    if (existing.length > 0) return existing[0];

    const receiptNumber = await this._generateReceiptNumber();

    const [result] = await pool.query(
      `INSERT INTO payment_receipts
         (invoice_id, booking_id, razorpay_payment_id, razorpay_order_id,
          razorpay_signature, receipt_number, amount, currency,
          payment_method, paid_at, worker_id, customer_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'INR', ?, ?, ?, ?)`,
      [
        invoiceId, bookingId, razorpayPaymentId, razorpayOrderId,
        razorpaySignature, receiptNumber, amount,
        paymentMethod, paidAt, workerId, customerId,
      ]
    );

    return this.getReceiptById(result.insertId);
  },

  /**
   * Get a single receipt by its DB id.
   */
  async getReceiptById(id) {
    const [rows] = await pool.query(
      `SELECT pr.*,
              u_c.name  AS customer_name,
              u_c.email AS customer_email,
              u_c.phone AS customer_phone,
              u_w.name  AS worker_name,
              u_w.email AS worker_email,
              u_w.phone AS worker_phone,
              w.service_type,
              ir.grand_total, ir.booking_id AS invoice_booking_id,
              ir.service_description,
              b.booking_date, b.address AS booking_address
       FROM payment_receipts pr
       LEFT JOIN users u_c    ON pr.customer_id = u_c.id
       LEFT JOIN workers w    ON pr.worker_id   = w.id
       LEFT JOIN users u_w    ON w.user_id       = u_w.id
       LEFT JOIN invoice_requests ir ON pr.invoice_id = ir.id
       LEFT JOIN bookings b   ON pr.booking_id  = b.id
       WHERE pr.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Get a receipt by invoice ID.
   */
  async getReceiptByInvoice(invoiceId) {
    const [rows] = await pool.query(
      `SELECT pr.*,
              u_c.name  AS customer_name,
              u_c.email AS customer_email,
              u_w.name  AS worker_name,
              u_w.phone AS worker_phone,
              w.service_type,
              b.booking_date, b.address AS booking_address
       FROM payment_receipts pr
       LEFT JOIN users u_c  ON pr.customer_id = u_c.id
       LEFT JOIN workers w  ON pr.worker_id   = w.id
       LEFT JOIN users u_w  ON w.user_id       = u_w.id
       LEFT JOIN bookings b ON pr.booking_id  = b.id
       WHERE pr.invoice_id = ?`,
      [invoiceId]
    );
    return rows[0] || null;
  },

  /**
   * Get paginated receipts for a user (homeowner or worker).
   */
  async getReceiptsByUser({ userId, userType, page = 1, limit = 20 }) {
    const pageNum  = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(50, Math.max(1, parseInt(limit) || 20));
    const offset   = (pageNum - 1) * limitNum;

    const condition = userType === 'homeowner'
      ? 'pr.customer_id = ?'
      : 'pr.worker_id = ? AND EXISTS (SELECT 1 FROM workers w2 WHERE w2.id = pr.worker_id AND w2.user_id = ?)';

    let params;
    let workerProfileCondition;

    if (userType === 'homeowner') {
      params = [userId, limitNum, offset];
      workerProfileCondition = 'pr.customer_id = ?';
    } else {
      // Resolve worker_id from user_id
      const [wRows] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [userId]);
      if (!wRows.length) return { receipts: [], pagination: { total: 0, page: pageNum, limit: limitNum, totalPages: 0 } };
      const wId = wRows[0].id;
      params = [wId, limitNum, offset];
      workerProfileCondition = 'pr.worker_id = ?';
    }

    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM payment_receipts pr WHERE ${workerProfileCondition}`,
      [params[0]]
    );
    const total = countRows[0].total;

    const [receipts] = await pool.query(
      `SELECT pr.id, pr.receipt_number, pr.amount, pr.currency, pr.payment_method,
              pr.paid_at, pr.invoice_id, pr.booking_id,
              u_c.name AS customer_name,
              u_w.name AS worker_name
       FROM payment_receipts pr
       LEFT JOIN users u_c  ON pr.customer_id = u_c.id
       LEFT JOIN workers w  ON pr.worker_id   = w.id
       LEFT JOIN users u_w  ON w.user_id       = u_w.id
       WHERE ${workerProfileCondition}
       ORDER BY pr.paid_at DESC
       LIMIT ? OFFSET ?`,
      params
    );

    return {
      receipts,
      pagination: {
        total, page: pageNum, limit: limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext: pageNum * limitNum < total,
        hasPrev: pageNum > 1,
      },
    };
  },

  /**
   * Get worker earnings summary.
   */
  async getWorkerEarnings(userId) {
    const [wRows] = await pool.query('SELECT id FROM workers WHERE user_id = ?', [userId]);
    if (!wRows.length) return null;
    const workerId = wRows[0].id;

    // Upsert worker_earnings if not exists
    await pool.query(
      `INSERT IGNORE INTO worker_earnings (worker_id) VALUES (?)`,
      [workerId]
    );

    const [rows] = await pool.query(
      'SELECT * FROM worker_earnings WHERE worker_id = ?',
      [workerId]
    );
    const earnings = rows[0];

    // Also fetch monthly breakdown (last 6 months)
    const [monthly] = await pool.query(
      `SELECT
         DATE_FORMAT(pr.paid_at, '%Y-%m') AS month,
         SUM(pr.amount) AS total,
         COUNT(*) AS count
       FROM payment_receipts pr
       WHERE pr.worker_id = ?
         AND pr.paid_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
       GROUP BY month
       ORDER BY month ASC`,
      [workerId]
    );

    // Pending invoices (accepted but not paid)
    const [pending] = await pool.query(
      `SELECT COALESCE(SUM(ir.grand_total), 0) AS pending_amount
       FROM invoice_requests ir
       WHERE ir.worker_id = ? AND ir.status IN ('accepted', 'requested', 'viewed')`,
      [workerId]
    );

    return {
      ...earnings,
      total_pending: parseFloat(pending[0].pending_amount || 0),
      monthly_breakdown: monthly,
    };
  },

  /**
   * Update worker_earnings after a successful payment.
   */
  async updateWorkerEarnings({ workerId, amount }) {
    await pool.query(
      `INSERT INTO worker_earnings (worker_id, total_earned, total_jobs_paid, last_payment_at)
       VALUES (?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         total_earned    = total_earned + VALUES(total_earned),
         total_jobs_paid = total_jobs_paid + 1,
         last_payment_at = NOW()`,
      [workerId, amount]
    );
  },

  /**
   * Admin financial summary.
   */
  async getAdminSummary({ period = 'monthly' } = {}) {
    const intervalMap = { daily: '1 DAY', weekly: '7 DAY', monthly: '30 DAY' };
    const interval = intervalMap[period] || '30 DAY';

    const [totals] = await pool.query(
      `SELECT
         COUNT(*) AS total_payments,
         COALESCE(SUM(amount), 0) AS total_revenue
       FROM payment_receipts
       WHERE paid_at >= DATE_SUB(NOW(), INTERVAL ${interval})`
    );

    const [byStatus] = await pool.query(
      `SELECT
         ir.status,
         COUNT(*) AS count,
         COALESCE(SUM(ir.grand_total), 0) AS total
       FROM invoice_requests ir
       WHERE ir.created_at >= DATE_SUB(NOW(), INTERVAL ${interval})
       GROUP BY ir.status`
    );

    const [recentReceipts] = await pool.query(
      `SELECT pr.id, pr.receipt_number, pr.amount, pr.paid_at,
              u_c.name AS customer_name, u_w.name AS worker_name
       FROM payment_receipts pr
       LEFT JOIN users u_c ON pr.customer_id = u_c.id
       LEFT JOIN workers w ON pr.worker_id   = w.id
       LEFT JOIN users u_w ON w.user_id = u_w.id
       ORDER BY pr.paid_at DESC
       LIMIT 20`
    );

    return {
      period,
      total_payments: totals[0].total_payments,
      total_revenue:  parseFloat(totals[0].total_revenue),
      by_status:      byStatus,
      recent_receipts: recentReceipts,
    };
  },
};

module.exports = ReceiptService;
