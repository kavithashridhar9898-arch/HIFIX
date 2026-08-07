const express = require('express');
const router  = express.Router();
const { protect } = require('../middleware/auth');
const blockchainController = require('../controllers/blockchainController');

/**
 * Blockchain Verification & Certificate PDF Routes
 * Base path: /api/blockchain
 */

// ── Public Verification & PDF Routes (Zero Auth) ────────────────
router.get('/verify/certificate/:id', blockchainController.verifyCertificate);
router.get('/verify/invoice/:id',     blockchainController.verifyInvoice);
router.get('/verify/receipt/:id',     blockchainController.verifyReceipt);
router.get('/verify/public/:hash',    blockchainController.verifyHash);

// PDF Download Route (FIX 2)
router.get('/certificate/:id/pdf',    blockchainController.downloadCertificatePdf);

// ── Authenticated Registration & Admin Routes ───────────────────────────────
router.post('/register-certificate', protect, blockchainController.registerCertificate);
router.post('/register-invoice',     protect, blockchainController.registerInvoice); // FIX 3: Standalone Invoice Endpoint
router.post('/register-receipt',     protect, blockchainController.registerReceipt);
router.post('/jobs/:id/retry',        protect, blockchainController.retryJob);

router.get('/dashboard/summary',     protect, blockchainController.getDashboardSummary);
router.get('/audit-logs',            protect, blockchainController.getAuditLogs);

module.exports = router;
