const BlockchainService = require('../services/BlockchainService');
const BlockchainQueue   = require('../services/BlockchainQueue');
const PdfService        = require('../services/PdfService');
const pool              = require('../config/database');

const blockchainController = {
  /** POST /api/blockchain/register-certificate — Trigger certificate queue */
  async registerCertificate(req, res, next) {
    try {
      const { booking_id } = req.body;
      const [bookings] = await pool.query('SELECT * FROM bookings WHERE id = ?', [booking_id]);
      if (!bookings.length) return res.status(404).json({ success: false, message: 'Booking not found' });
      const booking = bookings[0];

      const [invoices] = await pool.query('SELECT id FROM invoice_requests WHERE booking_id = ?', [booking_id]);
      const invoiceId = invoices.length ? invoices[0].id : 0;

      const result = await BlockchainQueue.enqueueCertificateRegistration({
        bookingId:  booking.id,
        invoiceId:  invoiceId,
        workerId:   booking.worker_id,
        customerId: booking.homeowner_id,
        req,
      });

      return res.status(202).json({
        success: true,
        message: result.alreadyConfirmed
          ? 'Certificate already registered on Polygon network'
          : 'Certificate queued for blockchain registration',
        bookingId: booking.id,
        blockchainStatus: result.status || 'PENDING',
      });
    } catch (e) { next(e); }
  },

  /** POST /api/blockchain/register-invoice — EXPLICIT INVOICE REGISTRATION ENDPOINT (FIX 3) */
  async registerInvoice(req, res, next) {
    try {
      const { invoiceId, invoice_id } = req.body;
      const targetId = parseInt(invoiceId || invoice_id, 10);

      if (!targetId || isNaN(targetId)) {
        return res.status(400).json({ success: false, message: 'Valid invoiceId is required' });
      }

      // 1. Load invoice from DB
      const [invoices] = await pool.query('SELECT * FROM invoice_requests WHERE id = ?', [targetId]);
      if (!invoices.length) {
        return res.status(404).json({ success: false, message: 'Invoice not found' });
      }
      const invoice = invoices[0];

      // 2. Authorization check: Requesting user must be worker, homeowner, or admin
      const userId = req.user ? req.user.id : null;
      const userRole = req.user ? req.user.role : null;

      if (userRole !== 'admin') {
        const [workerRows] = await pool.query('SELECT user_id FROM workers WHERE id = ?', [invoice.worker_id]);
        const workerUserId = workerRows.length ? workerRows[0].user_id : null;

        if (userId !== invoice.customer_id && userId !== workerUserId) {
          return res.status(403).json({ success: false, message: 'Unauthorized to register this invoice on blockchain' });
        }
      }

      // 3. Enqueue Invoice Job in Persistent MySQL Queue
      const result = await BlockchainQueue.enqueueInvoiceRegistration({
        invoiceId: targetId,
        req,
      });

      return res.status(202).json({
        success: true,
        message: result.alreadyConfirmed
          ? 'Invoice already verified on Polygon blockchain'
          : 'Invoice queued for blockchain registration',
        invoiceId: targetId,
        blockchainStatus: result.status || 'PENDING',
      });
    } catch (e) { next(e); }
  },

  /** POST /api/blockchain/register-receipt — Trigger receipt queue */
  async registerReceipt(req, res, next) {
    try {
      const { receipt_id } = req.body;
      const result = await BlockchainQueue.enqueueReceiptRegistration({ receiptId: parseInt(receipt_id), req });
      return res.status(202).json({
        success: true,
        message: 'Receipt queued for blockchain registration',
        receiptId: parseInt(receipt_id),
        blockchainStatus: result.status || 'PENDING',
      });
    } catch (e) { next(e); }
  },

  /** GET /api/blockchain/verify/certificate/:id — Public zero-auth endpoint */
  async verifyCertificate(req, res, next) {
    try {
      const result = await BlockchainService.verifyCertificate(req.params.id);
      return res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  /** GET /api/blockchain/verify/invoice/:id — Public zero-auth endpoint */
  async verifyInvoice(req, res, next) {
    try {
      const result = await BlockchainService.verifyInvoice(req.params.id);
      return res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  /** GET /api/blockchain/verify/receipt/:id — Public zero-auth endpoint */
  async verifyReceipt(req, res, next) {
    try {
      const result = await BlockchainService.verifyReceipt(req.params.id);
      return res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  /** GET /api/blockchain/verify/public/:hash — Public zero-auth hash lookup */
  async verifyHash(req, res, next) {
    try {
      const result = await BlockchainService.verifyByHash(req.params.hash);
      return res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  /** GET /api/blockchain/certificate/:id/pdf — Download PDF Certificate (FIX 2) */
  async downloadCertificatePdf(req, res, next) {
    try {
      const certificateId = req.params.id;
      const pdfBuffer = await PdfService.generateCertificatePdf(certificateId);

      const filename = `HFX-CERT-${certificateId}.pdf`;
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      return res.end(pdfBuffer);
    } catch (e) {
      if (e.message.includes('not found')) {
        return res.status(404).json({ success: false, message: e.message });
      }
      next(e);
    }
  },

  /** GET /api/blockchain/dashboard/summary — Admin & Worker metrics */
  async getDashboardSummary(req, res, next) {
    try {
      const summary = await BlockchainService.getDashboardSummary();
      return res.json({ success: true, data: summary });
    } catch (e) { next(e); }
  },

  /** POST /api/blockchain/jobs/:id/retry — Admin manual job retry trigger */
  async retryJob(req, res, next) {
    try {
      const jobId = parseInt(req.params.id, 10);
      const result = await BlockchainService.retryFailedJob(jobId);
      return res.json({ success: true, data: result });
    } catch (e) { next(e); }
  },

  /** GET /api/blockchain/audit-logs — Audit trail list */
  async getAuditLogs(req, res, next) {
    try {
      const [logs] = await pool.query(
        'SELECT * FROM blockchain_audit_logs ORDER BY created_at DESC LIMIT 50'
      );
      return res.json({ success: true, data: { logs } });
    } catch (e) { next(e); }
  },
};

module.exports = blockchainController;
