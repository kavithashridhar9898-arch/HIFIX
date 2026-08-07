const pool = require('../config/database');

/**
 * PaymentModel — raw SQL data-access layer.
 * All DB interactions for the payments table live here.
 * No business logic — that belongs in PaymentService.
 */

const PaymentModel = {
  /**
   * Create a new payment record.
   * @param {Object} data
   * @returns {number} insertId
   */
  async create({ booking_id, worker_id, customer_id, requested_amount, payment_method, notes = null }) {
    const [result] = await pool.query(
      `INSERT INTO payments
         (booking_id, worker_id, customer_id, requested_amount,
          status, payment_method, notes, created_at, updated_at)
       VALUES (?, ?, ?, ?, 'pending', ?, ?, NOW(), NOW())`,
      [booking_id, worker_id, customer_id, requested_amount, payment_method, notes]
    );
    return result.insertId;
  },

  /**
   * Find a payment by its primary key.
   * @param {number} id
   * @returns {Object|null}
   */
  async findById(id) {
    const [rows] = await pool.query(
      `SELECT
         p.*,
         u_customer.name  AS customer_name,
         u_customer.email AS customer_email,
         u_customer.phone AS customer_phone,
         u_worker.name    AS worker_name,
         u_worker.email   AS worker_email,
         u_worker.phone   AS worker_phone
       FROM payments p
       LEFT JOIN users u_customer ON p.customer_id = u_customer.id
       LEFT JOIN workers w        ON p.worker_id   = w.id
       LEFT JOIN users u_worker   ON w.user_id      = u_worker.id
       WHERE p.id = ?`,
      [id]
    );
    return rows[0] || null;
  },

  /**
   * Paginated history for a single user (customer or worker).
   * @param {Object} filters
   * @returns {{ payments: Object[], total: number }}
   */
  async findByUser({ userId, userType, status, page = 1, limit = 10 }) {
    const offset = (page - 1) * limit;
    const conditions = [];
    const params = [];

    if (userType === 'homeowner') {
      conditions.push('p.customer_id = ?');
      params.push(userId);
    } else {
      // worker — resolve worker profile id first
      conditions.push('w.user_id = ?');
      params.push(userId);
    }

    if (status) {
      conditions.push('p.status = ?');
      params.push(status);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const baseQuery = `
      FROM payments p
      LEFT JOIN users u_customer ON p.customer_id = u_customer.id
      LEFT JOIN workers w        ON p.worker_id   = w.id
      LEFT JOIN users u_worker   ON w.user_id      = u_worker.id
      ${where}
    `;

    const [countRows] = await pool.query(`SELECT COUNT(*) AS total ${baseQuery}`, params);
    const total = countRows[0].total;

    const [payments] = await pool.query(
      `SELECT
         p.*,
         u_customer.name  AS customer_name,
         u_customer.phone AS customer_phone,
         u_worker.name    AS worker_name,
         u_worker.phone   AS worker_phone
       ${baseQuery}
       ORDER BY p.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    return { payments, total };
  },

  /**
   * Update the status (and optionally transaction_reference) of a payment.
   * @param {number} id
   * @param {string} status
   * @param {string|null} transactionReference
   * @returns {boolean} affected rows > 0
   */
  async updateStatus(id, status, transactionReference = null) {
    const [result] = await pool.query(
      `UPDATE payments
       SET status = ?, transaction_reference = COALESCE(?, transaction_reference), updated_at = NOW()
       WHERE id = ?`,
      [status, transactionReference, id]
    );
    return result.affectedRows > 0;
  },

  /**
   * Check if a payment already exists for a booking (to prevent duplicates).
   * @param {number} bookingId
   * @returns {Object|null}
   */
  async findByBookingId(bookingId) {
    const [rows] = await pool.query(
      `SELECT id, status FROM payments WHERE booking_id = ? AND status NOT IN ('cancelled', 'refunded') LIMIT 1`,
      [bookingId]
    );
    return rows[0] || null;
  },
};

module.exports = PaymentModel;
