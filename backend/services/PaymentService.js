const pool = require('../config/database');
const PaymentModel = require('../models/paymentModel');
const NotificationService = require('./NotificationService');
const RazorpayService = require('./RazorpayService');
const ReceiptService = require('./ReceiptService');
const { PAYMENT_STATUS, ALLOWED_TRANSITIONS } = require('../config/payment');


/**
 * PaymentService — all payment business logic.
 * Controllers call this service; it delegates DB work to PaymentModel.
 */

const PaymentService = {
  /**
   * Request a new payment for a completed/in-progress booking.
   *
   * Rules:
   *  - Only a worker may request payment.
   *  - Booking must exist and belong to that worker.
   *  - Booking must be in 'completed' or 'in_progress' status.
   *  - No active payment must already exist for the booking.
   */
  async requestPayment({ bookingId, requestingUserId, requestedAmount, paymentMethod, notes, req }) {
    // 1. Load booking
    const [bookings] = await pool.query(
      `SELECT b.*, w.user_id AS worker_user_id, w.id AS worker_profile_id
       FROM bookings b
       INNER JOIN workers w ON b.worker_id = w.id
       WHERE b.id = ?`,
      [bookingId]
    );

    if (bookings.length === 0) {
      const err = new Error('Booking not found');
      err.statusCode = 404;
      throw err;
    }

    const booking = bookings[0];

    // 2. Only the assigned worker can request payment
    if (booking.worker_user_id !== requestingUserId) {
      const err = new Error('Only the assigned worker can request payment for this booking');
      err.statusCode = 403;
      throw err;
    }

    // 3. Booking must be in a payable state
    const payableStatuses = ['in_progress', 'completed'];
    if (!payableStatuses.includes(booking.status)) {
      const err = new Error(
        `Payment can only be requested for bookings in status: ${payableStatuses.join(', ')}. Current status: ${booking.status}`
      );
      err.statusCode = 400;
      throw err;
    }

    // 4. Prevent duplicate active payments
    const existing = await PaymentModel.findByBookingId(bookingId);
    if (existing) {
      const err = new Error(
        `An active payment (id: ${existing.id}, status: ${existing.status}) already exists for this booking`
      );
      err.statusCode = 409;
      throw err;
    }

    // 5. Create the payment record
    const paymentId = await PaymentModel.create({
      booking_id:       bookingId,
      worker_id:        booking.worker_profile_id,
      customer_id:      booking.homeowner_id,
      requested_amount: requestedAmount,
      payment_method:   paymentMethod,
      notes,
    });

    // 6. Advance status to 'requested'
    await PaymentModel.updateStatus(paymentId, PAYMENT_STATUS.REQUESTED);

    // 7. Notify the customer
    try {
      await NotificationService.sendNotification({
        req,
        userId:          booking.homeowner_id,
        title:           '💳 Payment Requested',
        message:         `Your worker has requested a payment of ₹${requestedAmount} for booking #${bookingId}.`,
        type:            'payment',
        relatedEntityId: paymentId,
      });
    } catch (_) {
      // Notification failure must never break the payment flow
    }

    return await PaymentModel.findById(paymentId);
  },

  /**
   * Get paginated payment history for the requesting user.
   */
  async getHistory({ userId, userType, status, page, limit }) {
    const pageNum  = Math.max(1, parseInt(page)  || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 10));

    const { payments, total } = await PaymentModel.findByUser({
      userId,
      userType,
      status: status || null,
      page:   pageNum,
      limit:  limitNum,
    });

    return {
      payments,
      pagination: {
        total,
        page:       pageNum,
        limit:      limitNum,
        totalPages: Math.ceil(total / limitNum),
        hasNext:    pageNum * limitNum < total,
        hasPrev:    pageNum > 1,
      },
    };
  },

  /**
   * Get a single payment by ID, enforcing ownership.
   */
  async getPaymentById({ paymentId, requestingUserId, userType }) {
    const payment = await PaymentModel.findById(paymentId);

    if (!payment) {
      const err = new Error('Payment not found');
      err.statusCode = 404;
      throw err;
    }

    // Authorisation: homeowner must be the customer, worker must own the worker record
    const isCustomer = userType === 'homeowner' && payment.customer_id === requestingUserId;

    let isWorker = false;
    if (userType === 'worker') {
      const [workers] = await pool.query(
        'SELECT id FROM workers WHERE user_id = ?',
        [requestingUserId]
      );
      isWorker = workers.length > 0 && workers[0].id === payment.worker_id;
    }

    if (!isCustomer && !isWorker) {
      const err = new Error('You are not authorised to view this payment');
      err.statusCode = 403;
      throw err;
    }

    return payment;
  },

  /**
   * Cancel a payment.
   *
   * Rules:
   *  - Customer or assigned worker may cancel.
   *  - Payment must be in 'pending' or 'requested' status.
   */
  async cancelPayment({ paymentId, requestingUserId, userType, reason, req }) {
    const payment = await PaymentModel.findById(paymentId);

    if (!payment) {
      const err = new Error('Payment not found');
      err.statusCode = 404;
      throw err;
    }

    // Authorisation
    const isCustomer = userType === 'homeowner' && payment.customer_id === requestingUserId;

    let isWorker = false;
    if (userType === 'worker') {
      const [workers] = await pool.query(
        'SELECT id FROM workers WHERE user_id = ?',
        [requestingUserId]
      );
      isWorker = workers.length > 0 && workers[0].id === payment.worker_id;
    }

    if (!isCustomer && !isWorker) {
      const err = new Error('You are not authorised to cancel this payment');
      err.statusCode = 403;
      throw err;
    }

    // Validate transition
    const allowed = ALLOWED_TRANSITIONS[payment.status] || [];
    if (!allowed.includes(PAYMENT_STATUS.CANCELLED)) {
      const err = new Error(
        `Cannot cancel a payment with status '${payment.status}'. Cancellation is only allowed from: pending, requested`
      );
      err.statusCode = 400;
      throw err;
    }

    await PaymentModel.updateStatus(paymentId, PAYMENT_STATUS.CANCELLED);

    // Notify the other party
    try {
      const notifyUserId = isCustomer ? null : payment.customer_id; // if worker cancels, notify customer
      const notifyWorker = isWorker   ? null : payment.worker_id;   // if customer cancels, notify worker (user_id needed)

      let targetUserId = null;
      if (notifyUserId) {
        targetUserId = notifyUserId;
      } else if (notifyWorker) {
        const [w] = await pool.query('SELECT user_id FROM workers WHERE id = ?', [notifyWorker]);
        if (w.length) targetUserId = w[0].user_id;
      }

      if (targetUserId) {
        await NotificationService.sendNotification({
          req,
          userId:          targetUserId,
          title:           '❌ Payment Cancelled',
          message:         `Payment #${paymentId} has been cancelled.${reason ? ` Reason: ${reason}` : ''}`,
          type:            'payment',
          relatedEntityId: paymentId,
        });
      }
    } catch (_) {
      // Notification failure is non-fatal
    }

    return await PaymentModel.findById(paymentId);
  },

  // ── Phase 3: Razorpay Order Creation ───────────────────────────────────────

  /**
   * Create a Razorpay order for an accepted invoice.
   * Prevents duplicates — returns existing order if one is active.
   */
  async createOrder({ invoiceId, requestingUserId }) {
    // 1. Fetch invoice with ownership check
    const [invoices] = await pool.query(
      `SELECT ir.*, w.user_id AS worker_user_id
       FROM invoice_requests ir
       INNER JOIN workers w ON ir.worker_id = w.id
       WHERE ir.id = ?`,
      [invoiceId]
    );
    if (!invoices.length) {
      const err = new Error('Invoice not found'); err.statusCode = 404; throw err;
    }
    const invoice = invoices[0];

    if (invoice.customer_id !== requestingUserId) {
      const err = new Error('Only the customer can initiate payment for this invoice');
      err.statusCode = 403; throw err;
    }

    if (invoice.status !== 'accepted') {
      const err = new Error(
        `Invoice must be approved before payment. Current status: ${invoice.status}`
      );
      err.statusCode = 400; throw err;
    }

    // 2. Idempotency — return existing active order if present
    const [existingOrders] = await pool.query(
      'SELECT * FROM razorpay_orders WHERE invoice_id = ? AND status = ? LIMIT 1',
      [invoiceId, 'created']
    );
    if (existingOrders.length > 0) {
      const existing = existingOrders[0];
      return {
        orderId:  existing.razorpay_order_id,
        amount:   existing.amount_paise,
        currency: 'INR',
        key:      require('../config/payment').RAZORPAY_CONFIG.KEY_ID || 'DEMO_KEY',
        demo:     RazorpayService.demoMode,
        invoiceId,
        grandTotal: parseFloat(invoice.grand_total),
      };
    }

    // 3. Create Razorpay order
    const receipt  = `hifix-inv-${invoiceId}-${Date.now()}`;
    const orderRes = await RazorpayService.createOrder({
      amountINR: parseFloat(invoice.grand_total),
      receipt,
      notes: {
        invoice_id:  String(invoiceId),
        booking_id:  String(invoice.booking_id),
        customer_id: String(requestingUserId),
      },
    });

    // 4. Save to DB
    await RazorpayService.saveOrderToDB({
      orderId:    orderRes.orderId,
      invoiceId,
      bookingId:  invoice.booking_id,
      customerId: requestingUserId,
      workerId:   invoice.worker_id,
      amountPaise: orderRes.amount,
      receipt,
    });

    // 5. Notify homeowner that order was created
    try {
      await NotificationService.sendNotification({
        req: null,
        userId: requestingUserId,
        title: '🔐 Payment Initiated',
        message: `Your payment of ₹${parseFloat(invoice.grand_total).toLocaleString('en-IN')} for Booking #${invoice.booking_id} has been initiated.`,
        type: 'payment',
        relatedEntityId: invoiceId,
      });
    } catch (_) {}

    return {
      ...orderRes,
      invoiceId,
      grandTotal: parseFloat(invoice.grand_total),
    };
  },

  /**
   * Verify Razorpay payment signature and capture — marks invoice and booking as paid.
   * Generates a digital receipt.
   */
  async verifyAndCapture({ orderId, paymentId, signature, requestingUserId, req }) {
    // 1. Verify signature
    const valid = RazorpayService.verifySignature({ orderId, paymentId, signature });
    if (!valid) {
      const err = new Error('Payment verification failed — invalid signature');
      err.statusCode = 400; throw err;
    }

    // 2. Fetch the order record
    const [orders] = await pool.query(
      'SELECT * FROM razorpay_orders WHERE razorpay_order_id = ?',
      [orderId]
    );
    if (!orders.length) {
      const err = new Error('Order not found'); err.statusCode = 404; throw err;
    }
    const order = orders[0];

    if (order.customer_id !== requestingUserId) {
      const err = new Error('Not authorised'); err.statusCode = 403; throw err;
    }

    // 3. Idempotency — already processed?
    const [existingReceipt] = await pool.query(
      'SELECT * FROM payment_receipts WHERE invoice_id = ?', [order.invoice_id]
    );
    if (existingReceipt.length > 0) return existingReceipt[0];

    // 4. Get payment method from Razorpay (or demo fallback)
    let paymentMethod = 'online';
    try {
      const paymentDetail = await RazorpayService.fetchPayment(paymentId);
      paymentMethod = paymentDetail?.method || 'online';
    } catch (_) {}

    const amount = order.amount_paise / 100;

    // 5. Update statuses atomically
    await pool.query('BEGIN');
    try {
      await pool.query(
        `UPDATE invoice_requests SET status = 'paid', updated_at = NOW() WHERE id = ?`,
        [order.invoice_id]
      );
      await pool.query(
        `UPDATE bookings SET status = 'paid' WHERE id = ?`,
        [order.booking_id]
      );
      await RazorpayService.updateOrderStatus(orderId, 'paid');
      await pool.query('COMMIT');
    } catch (e) {
      await pool.query('ROLLBACK');
      throw e;
    }

    // 6. Generate receipt
    const receipt = await ReceiptService.generateReceipt({
      invoiceId:          order.invoice_id,
      bookingId:          order.booking_id,
      razorpayPaymentId:  paymentId,
      razorpayOrderId:    orderId,
      razorpaySignature:  signature,
      amount,
      paymentMethod,
      workerId:    order.worker_id,
      customerId:  order.customer_id,
      paidAt:      new Date(),
    });

    // 7. Update worker earnings
    await ReceiptService.updateWorkerEarnings({ workerId: order.worker_id, amount });

    // 8. Trigger async non-blocking Blockchain Registration for Receipt & Invoice
    try {
      const BlockchainQueue = require('./BlockchainQueue');
      BlockchainQueue.enqueueReceiptRegistration({ receiptId: receipt.id, req });
      BlockchainQueue.enqueueInvoiceRegistration({ invoiceId: order.invoice_id, req });
    } catch (_) {}

    // 8. Notify both parties
    try {
      // Notify homeowner
      await NotificationService.sendNotification({
        req,
        userId: order.customer_id,
        title:  '✅ Payment Successful!',
        message: `Payment of ₹${amount.toLocaleString('en-IN')} for Booking #${order.booking_id} was successful. Receipt: ${receipt.receipt_number}`,
        type:   'payment',
        relatedEntityId: order.invoice_id,
      });
      // Notify worker via user_id
      const [wUser] = await pool.query('SELECT user_id FROM workers WHERE id = ?', [order.worker_id]);
      if (wUser.length > 0) {
        await NotificationService.sendNotification({
          req,
          userId: wUser[0].user_id,
          title:  '💰 Payment Received!',
          message: `You received ₹${amount.toLocaleString('en-IN')} for Booking #${order.booking_id}.`,
          type:   'payment',
          relatedEntityId: order.invoice_id,
        });
      }
    } catch (_) {}

    return receipt;
  },

  /**
   * Handle Razorpay webhooks — idempotent, logs to webhook_events.
   */
  async handleWebhook({ eventId, eventType, payload, rawBody, signature }) {
    // 1. Verify webhook signature
    if (signature && rawBody) {
      const valid = RazorpayService.verifyWebhookSignature({ rawBody, signature });
      if (!valid) {
        const err = new Error('Invalid webhook signature'); err.statusCode = 400; throw err;
      }
    }

    // 2. Idempotency guard
    try {
      await pool.query(
        'INSERT INTO webhook_events (event_id, event_type, payload) VALUES (?, ?, ?)',
        [eventId, eventType, JSON.stringify(payload)]
      );
    } catch (e) {
      if (e.code === 'ER_DUP_ENTRY') {
        console.log(`⚠️ Webhook ${eventId} already processed — skipping`);
        return { already_processed: true };
      }
      throw e;
    }

    // 3. Handle event types
    const entity = payload?.payload?.payment?.entity || payload?.payload?.refund?.entity || {};

    if (eventType === 'payment.captured') {
      // Mark order as paid if not already done via /verify
      const orderId = entity.order_id;
      if (orderId) await RazorpayService.updateOrderStatus(orderId, 'paid').catch(() => {});
    }

    if (eventType === 'payment.failed') {
      const orderId = entity.order_id;
      if (orderId) {
        await RazorpayService.updateOrderStatus(orderId, 'failed').catch(() => {});
        // Notify customer
        const [orders] = await pool.query(
          'SELECT customer_id, invoice_id FROM razorpay_orders WHERE razorpay_order_id = ?', [orderId]
        );
        if (orders.length > 0) {
          await NotificationService.sendNotification({
            req: null,
            userId: orders[0].customer_id,
            title:  '❌ Payment Failed',
            message: 'Your payment attempt failed. Please try again.',
            type:   'payment',
            relatedEntityId: orders[0].invoice_id,
          }).catch(() => {});
        }
      }
    }

    if (eventType === 'refund.created') {
      // Log refund — update invoice status
      const paymentId = entity.payment_id;
      if (paymentId) {
        await pool.query(
          `UPDATE invoice_requests ir
           INNER JOIN payment_receipts pr ON pr.invoice_id = ir.id
           SET ir.status = 'refunded', ir.updated_at = NOW()
           WHERE pr.razorpay_payment_id = ?`,
          [paymentId]
        ).catch(() => {});
      }
    }

    return { processed: true, eventType };
  },
};

module.exports = PaymentService;
