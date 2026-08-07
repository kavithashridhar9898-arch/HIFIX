/**
 * Payment Configuration — Phase 3
 * Central source of truth for payment constants and Razorpay config.
 * Swap RAZORPAY_CONFIG to a different provider's config to support Stripe/PayPal.
 */

const PAYMENT_STATUS = {
  PENDING:     'pending',
  REQUESTED:   'requested',
  INITIATED:   'initiated',    // Order created, checkout opened
  PROCESSING:  'processing',   // Payment captured, awaiting verify
  PAID:        'paid',         // Verified and captured
  FAILED:      'failed',       // Razorpay failed/dismissed
  CANCELLED:   'cancelled',
  REFUNDED:    'refunded',
  DISPUTED:    'disputed',
  COMPLETED:   'completed',    // Terminal — post-review state
};

const PAYMENT_METHOD = {
  CASH:          'cash',
  ONLINE:        'online',
  RAZORPAY:      'razorpay',
  UPI:           'upi',
  NETBANKING:    'netbanking',
  CARD:          'card',
  WALLET:        'wallet',
  BANK_TRANSFER: 'bank_transfer',
};

/** Legal status transitions */
const ALLOWED_TRANSITIONS = {
  [PAYMENT_STATUS.PENDING]:    [PAYMENT_STATUS.REQUESTED, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.REQUESTED]:  [PAYMENT_STATUS.INITIATED, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.INITIATED]:  [PAYMENT_STATUS.PROCESSING, PAYMENT_STATUS.FAILED, PAYMENT_STATUS.CANCELLED],
  [PAYMENT_STATUS.PROCESSING]: [PAYMENT_STATUS.PAID, PAYMENT_STATUS.FAILED],
  [PAYMENT_STATUS.PAID]:       [PAYMENT_STATUS.COMPLETED, PAYMENT_STATUS.REFUNDED, PAYMENT_STATUS.DISPUTED],
  [PAYMENT_STATUS.FAILED]:     [PAYMENT_STATUS.INITIATED],   // Allow retry
  [PAYMENT_STATUS.COMPLETED]:  [],
  [PAYMENT_STATUS.CANCELLED]:  [],
  [PAYMENT_STATUS.REFUNDED]:   [],
  [PAYMENT_STATUS.DISPUTED]:   [PAYMENT_STATUS.REFUNDED],
};

/** Amount limits in INR */
const AMOUNT_LIMITS = {
  MIN: 1,
  MAX: 1_000_000,
};

/**
 * Razorpay configuration — provider-agnostic interface.
 * Replace with StripeService config to swap providers.
 * DEMO_MODE is active when no key is configured.
 */
const RAZORPAY_CONFIG = {
  KEY_ID:          process.env.RAZORPAY_KEY_ID          || null,
  KEY_SECRET:      process.env.RAZORPAY_KEY_SECRET       || null,
  WEBHOOK_SECRET:  process.env.RAZORPAY_WEBHOOK_SECRET   || null,
  CURRENCY:        'INR',
  DEMO_MODE:       !process.env.RAZORPAY_KEY_ID,   // true when no keys configured
};

module.exports = {
  PAYMENT_STATUS,
  PAYMENT_METHOD,
  ALLOWED_TRANSITIONS,
  AMOUNT_LIMITS,
  RAZORPAY_CONFIG,
};
