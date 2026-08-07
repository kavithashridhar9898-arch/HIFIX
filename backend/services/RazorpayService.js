const crypto = require('crypto');
const pool = require('../config/database');
const { RAZORPAY_CONFIG } = require('../config/payment');

/**
 * RazorpayService — provider-agnostic payment gateway wrapper.
 *
 * DEMO_MODE (no keys configured):
 *   - createOrder() returns a deterministic fake order (DEMO-xxxxxxxx)
 *   - verifySignature() accepts any signature starting with "DEMO_"
 *   - The frontend WebView payment screen shows a simulated checkout UI
 *
 * LIVE_MODE (keys configured in .env):
 *   - Uses the official Razorpay Node SDK
 *   - All security checks are enforced
 *
 * To swap to Stripe: create StripeService.js with the same exported interface
 * and update the import in PaymentService.js — no other changes needed.
 */

let razorpayInstance = null;

function getRazorpayInstance() {
  if (RAZORPAY_CONFIG.DEMO_MODE) return null;
  if (razorpayInstance) return razorpayInstance;
  try {
    const Razorpay = require('razorpay');
    razorpayInstance = new Razorpay({
      key_id:     RAZORPAY_CONFIG.KEY_ID,
      key_secret: RAZORPAY_CONFIG.KEY_SECRET,
    });
    return razorpayInstance;
  } catch (e) {
    console.warn('⚠️  Razorpay SDK not installed. Run: npm install razorpay');
    return null;
  }
}

const RazorpayService = {
  get demoMode() {
    return RAZORPAY_CONFIG.DEMO_MODE;
  },

  /**
   * Create a payment order.
   * Returns { orderId, amount, currency, key, demo } object.
   * Amount is in INR; we store/send in paise internally.
   */
  async createOrder({ amountINR, receipt, notes = {} }) {
    const amountPaise = Math.round(amountINR * 100); // paise, integer

    // ── DEMO MODE ─────────────────────────────────────────────────────────────
    if (RAZORPAY_CONFIG.DEMO_MODE) {
      const demoOrderId = `DEMO-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      return {
        orderId:     demoOrderId,
        amount:      amountPaise,
        currency:    'INR',
        key:         'DEMO_KEY',
        demo:        true,
        receipt,
      };
    }

    // ── LIVE MODE ─────────────────────────────────────────────────────────────
    const rz = getRazorpayInstance();
    if (!rz) throw new Error('Razorpay not available');

    const order = await rz.orders.create({
      amount:   amountPaise,
      currency: 'INR',
      receipt,
      notes,
    });

    return {
      orderId:  order.id,
      amount:   order.amount,
      currency: order.currency,
      key:      RAZORPAY_CONFIG.KEY_ID,
      demo:     false,
      receipt,
    };
  },

  /**
   * Verify payment signature (HMAC-SHA256).
   * orderId + "|" + paymentId → sign with KEY_SECRET → compare.
   */
  verifySignature({ orderId, paymentId, signature }) {
    // ── DEMO MODE ─────────────────────────────────────────────────────────────
    if (RAZORPAY_CONFIG.DEMO_MODE || orderId.startsWith('DEMO-')) {
      // Accept demo signatures that start with "DEMO_"
      return signature && signature.startsWith('DEMO_');
    }

    // ── LIVE MODE ─────────────────────────────────────────────────────────────
    const body    = `${orderId}|${paymentId}`;
    const expected = crypto
      .createHmac('sha256', RAZORPAY_CONFIG.KEY_SECRET)
      .update(body)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature,  'hex')
    );
  },

  /**
   * Verify webhook signature from X-Razorpay-Signature header.
   */
  verifyWebhookSignature({ rawBody, signature }) {
    if (RAZORPAY_CONFIG.DEMO_MODE) return true;
    const expected = crypto
      .createHmac('sha256', RAZORPAY_CONFIG.WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');
    return crypto.timingSafeEqual(
      Buffer.from(expected,  'hex'),
      Buffer.from(signature, 'hex')
    );
  },

  /**
   * Fetch payment details from Razorpay (e.g., to get payment method).
   * Returns null in demo mode.
   */
  async fetchPayment(paymentId) {
    if (RAZORPAY_CONFIG.DEMO_MODE || paymentId.startsWith('DEMO_PAY_')) {
      return { id: paymentId, method: 'demo', status: 'captured' };
    }
    const rz = getRazorpayInstance();
    if (!rz) return null;
    return rz.payments.fetch(paymentId);
  },

  /**
   * Save a Razorpay order to DB for audit + idempotency.
   */
  async saveOrderToDB({ orderId, invoiceId, bookingId, customerId, workerId, amountPaise, receipt }) {
    const [existing] = await pool.query(
      'SELECT id FROM razorpay_orders WHERE invoice_id = ? AND status = ?',
      [invoiceId, 'created']
    );
    if (existing.length > 0) {
      // Return existing — idempotent
      const [rows] = await pool.query('SELECT * FROM razorpay_orders WHERE id = ?', [existing[0].id]);
      return rows[0];
    }

    const [result] = await pool.query(
      `INSERT INTO razorpay_orders
         (invoice_id, booking_id, customer_id, worker_id, razorpay_order_id, amount_paise, receipt_ref)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [invoiceId, bookingId, customerId, workerId, orderId, amountPaise, receipt]
    );
    const [rows] = await pool.query('SELECT * FROM razorpay_orders WHERE id = ?', [result.insertId]);
    return rows[0];
  },

  /**
   * Update razorpay_orders status after payment.
   */
  async updateOrderStatus(orderId, status) {
    await pool.query(
      'UPDATE razorpay_orders SET status = ?, updated_at = NOW() WHERE razorpay_order_id = ?',
      [status, orderId]
    );
  },
};

module.exports = RazorpayService;
