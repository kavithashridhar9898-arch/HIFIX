const crypto = require('crypto');
const pool = require('../config/database');
const { ACTIVE_CONFIG, CONTRACT_ABI, PRIVATE_KEY, SIMULATION_MODE } = require('../config/blockchain');

let ethers = null;
try {
  ethers = require('ethers');
} catch (e) {
  console.warn('⚠️ ethers.js package not installed');
}

/**
 * BlockchainService — Polygon Blockchain Verification Layer.
 * Deterministic hash generation, smart contract interactions, on-chain verification.
 */
const BlockchainService = {
  /**
   * Deterministic SHA-256 Hash Helper
   */
  _sha256(data) {
    const jsonString = typeof data === 'string' ? data : JSON.stringify(data, Object.keys(data).sort());
    return crypto.createHash('sha256').update(jsonString).digest('hex');
  },

  /**
   * Generate SHA-256 Hash for an Invoice
   */
  generateInvoiceHash(invoice) {
    const canonicalPayload = {
      id: invoice.id,
      booking_id: invoice.booking_id,
      worker_id: invoice.worker_id,
      customer_id: invoice.customer_id,
      grand_total: String(parseFloat(invoice.grand_total).toFixed(2)),
      labour_cost: String(parseFloat(invoice.labour_cost || 0).toFixed(2)),
      material_cost: String(parseFloat(invoice.material_cost || 0).toFixed(2)),
      service_description: (invoice.service_description || '').trim(),
      created_at: invoice.created_at ? new Date(invoice.created_at).toISOString() : '',
    };
    return this._sha256(canonicalPayload);
  },

  /**
   * Generate SHA-256 Hash for a Certificate
   */
  generateCertificateHash(certificate) {
    const canonicalPayload = {
      certificate_number: certificate.certificate_number,
      booking_id: certificate.booking_id,
      invoice_id: certificate.invoice_id,
      worker_id: certificate.worker_id,
      customer_id: certificate.customer_id,
      issued_at: certificate.issued_at ? new Date(certificate.issued_at).toISOString() : '',
    };
    return this._sha256(canonicalPayload);
  },

  /**
   * Generate SHA-256 Hash for a Receipt
   */
  generateReceiptHash(receipt) {
    const canonicalPayload = {
      receipt_number: receipt.receipt_number,
      invoice_id: receipt.invoice_id,
      booking_id: receipt.booking_id,
      amount: String(parseFloat(receipt.amount).toFixed(2)),
      payment_method: receipt.payment_method || 'online',
      razorpay_payment_id: receipt.razorpay_payment_id || '',
      paid_at: receipt.paid_at ? new Date(receipt.paid_at).toISOString() : '',
    };
    return this._sha256(canonicalPayload);
  },

  /**
   * Audit log writer
   */
  async logAudit({ entityType, entityId, action, hash, txHash = null, details = null }) {
    try {
      await pool.query(
        `INSERT INTO blockchain_audit_logs (entity_type, entity_id, action, hash, tx_hash, details)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [entityType, entityId, action, hash, txHash, details]
      );
    } catch (e) {
      console.warn('Audit log error:', e.message);
    }
  },

  /**
   * Register a hash on Polygon Blockchain (or simulation fallback)
   */
  async registerOnChain({ hash, entityType, bookingId }) {
    const formattedHash = hash.startsWith('0x') ? hash : `0x${hash}`;
    const hashHex64 = hash.replace(/^0x/, '');

    // ── SIMULATION MODE ─────────────────────────────────────────────────────
    if (SIMULATION_MODE || !ethers || !PRIVATE_KEY) {
      const mockTxHash = `0x${crypto.randomBytes(32).toString('hex')}`;
      const mockBlockNumber = Math.floor(25000000 + Math.random() * 1000000);
      return {
        success: true,
        simulation: true,
        txHash: mockTxHash,
        blockNumber: mockBlockNumber,
        hash: hashHex64,
        network: ACTIVE_CONFIG.name,
        explorerUrl: `${ACTIVE_CONFIG.explorerUrl}/tx/${mockTxHash}`,
        timestamp: new Date().toISOString(),
      };
    }

    // ── LIVE POLYGON NETWORK ─────────────────────────────────────────────────
    try {
      const rpcUrls = [
        ACTIVE_CONFIG.rpcUrl,
        'https://polygon-amoy.drpc.org',
        'https://rpc.ankr.com/polygon_amoy',
        'https://polygon-amoy.blockpi.network/v1/rpc/public',
      ].filter(Boolean);

      let provider = null;
      let wallet = null;

      for (const url of rpcUrls) {
        try {
          const p = new ethers.JsonRpcProvider(url);
          const w = new ethers.Wallet(PRIVATE_KEY, p);
          await p.getBlockNumber();
          provider = p;
          wallet = w;
          break;
        } catch (_) {}
      }

      if (!provider || !wallet) {
        throw new Error('Could not connect to any Polygon Amoy RPC endpoint');
      }

      const contract = new ethers.Contract(ACTIVE_CONFIG.contractAddress, CONTRACT_ABI, wallet);

      const tx = await contract.registerRecord(formattedHash, entityType, bookingId);
      const receipt = await tx.wait();

      return {
        success: true,
        simulation: false,
        txHash: receipt.hash,
        blockNumber: receipt.blockNumber,
        hash: hashHex64,
        network: ACTIVE_CONFIG.name,
        explorerUrl: `${ACTIVE_CONFIG.explorerUrl}/tx/${receipt.hash}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error(`❌ Blockchain write error for ${entityType}:`, error.message);
      throw error;
    }
  },

  /**
   * Public Verification for Certificate
   */
  async verifyCertificate(certificateId) {
    const [rows] = await pool.query(
      `SELECT c.*,
              ir.grand_total, ir.service_description,
              u_w.name AS worker_name, u_w.email AS worker_email,
              u_c.name AS customer_name, u_c.email AS customer_email,
              w.service_type,
              b.booking_date, b.address AS booking_address
       FROM work_certificates c
       INNER JOIN invoice_requests ir ON c.invoice_id  = ir.id
       INNER JOIN workers w           ON c.worker_id   = w.id
       INNER JOIN users u_w           ON w.user_id       = u_w.id
       INNER JOIN users u_c           ON c.customer_id  = u_c.id
       INNER JOIN bookings b          ON c.booking_id   = b.id
       WHERE c.id = ? OR c.certificate_number = ?`,
      [certificateId, certificateId]
    );

    if (!rows.length) {
      return { status: 'INVALID', message: 'Certificate not found in database' };
    }

    const cert = rows[0];
    const currentHash = this.generateCertificateHash(cert);
    let status = cert.blockchain_status || 'PENDING';

    // Verify hash integrity
    if (cert.blockchain_hash && cert.blockchain_hash !== currentHash) {
      status = 'TAMPERED';
      await this.logAudit({
        entityType: 'CERTIFICATE',
        entityId: cert.id,
        action: 'TAMPER_DETECTED',
        hash: currentHash,
        details: `Stored hash: ${cert.blockchain_hash}, Computed: ${currentHash}`,
      });
    } else {
      await this.logAudit({
        entityType: 'CERTIFICATE',
        entityId: cert.id,
        action: 'VERIFICATION_SUCCESS',
        hash: currentHash,
        txHash: cert.blockchain_tx_hash,
      });
    }

    return {
      status,
      isValid: status === 'VERIFIED',
      isTampered: status === 'TAMPERED',
      certificate: cert,
      hash: currentHash,
      txHash: cert.blockchain_tx_hash,
      blockNumber: cert.blockchain_block_number,
      network: cert.blockchain_network || ACTIVE_CONFIG.name,
      explorerUrl: cert.blockchain_tx_hash ? `${ACTIVE_CONFIG.explorerUrl}/tx/${cert.blockchain_tx_hash}` : null,
      verifiedAt: cert.blockchain_verified_at,
    };
  },

  /**
   * Public Verification for Invoice
   */
  async verifyInvoice(invoiceId) {
    const [rows] = await pool.query(
      `SELECT ir.*,
              u_w.name AS worker_name,
              u_c.name AS customer_name,
              w.service_type
       FROM invoice_requests ir
       INNER JOIN workers w   ON ir.worker_id  = w.id
       INNER JOIN users u_w   ON w.user_id      = u_w.id
       INNER JOIN users u_c   ON ir.customer_id = u_c.id
       WHERE ir.id = ?`,
      [invoiceId]
    );

    if (!rows.length) {
      return { status: 'INVALID', message: 'Invoice not found' };
    }

    const inv = rows[0];
    const currentHash = this.generateInvoiceHash(inv);
    let status = inv.blockchain_status || 'PENDING';

    if (inv.blockchain_hash && inv.blockchain_hash !== currentHash) {
      status = 'TAMPERED';
    }

    // Fallback: If invoice status is not direct VERIFIED/TAMPERED, check associated verified receipt or certificate
    if (status !== 'VERIFIED' && status !== 'TAMPERED') {
      const [receipts] = await pool.query(
        'SELECT * FROM payment_receipts WHERE invoice_id = ? AND blockchain_status = ? ORDER BY id DESC LIMIT 1',
        [invoiceId, 'VERIFIED']
      );
      if (receipts.length) {
        const rec = receipts[0];
        return {
          status: 'VERIFIED',
          isValid: true,
          isTampered: false,
          invoice: inv,
          receipt: rec,
          hash: rec.blockchain_hash,
          txHash: rec.blockchain_tx_hash,
          blockNumber: rec.blockchain_block_number,
          network: rec.blockchain_network || ACTIVE_CONFIG.name,
          explorerUrl: rec.blockchain_tx_hash ? `${ACTIVE_CONFIG.explorerUrl}/tx/${rec.blockchain_tx_hash}` : null,
        };
      }

      const [certs] = await pool.query(
        'SELECT * FROM work_certificates WHERE invoice_id = ? AND blockchain_status = ? ORDER BY id DESC LIMIT 1',
        [invoiceId, 'VERIFIED']
      );
      if (certs.length) {
        const cert = certs[0];
        return {
          status: 'VERIFIED',
          isValid: true,
          isTampered: false,
          invoice: inv,
          certificate: cert,
          hash: cert.blockchain_hash,
          txHash: cert.blockchain_tx_hash,
          blockNumber: cert.blockchain_block_number,
          network: cert.blockchain_network || ACTIVE_CONFIG.name,
          explorerUrl: cert.blockchain_tx_hash ? `${ACTIVE_CONFIG.explorerUrl}/tx/${cert.blockchain_tx_hash}` : null,
        };
      }
    }

    return {
      status,
      isValid: status === 'VERIFIED',
      isTampered: status === 'TAMPERED',
      invoice: inv,
      hash: currentHash,
      txHash: inv.blockchain_tx_hash,
      blockNumber: inv.blockchain_block_number,
      network: inv.blockchain_network || ACTIVE_CONFIG.name,
      explorerUrl: inv.blockchain_tx_hash ? `${ACTIVE_CONFIG.explorerUrl}/tx/${inv.blockchain_tx_hash}` : null,
    };
  },

  /**
   * Public Verification for Receipt
   */
  async verifyReceipt(receiptId) {
    const [rows] = await pool.query(
      `SELECT pr.*,
              u_w.name AS worker_name,
              u_c.name AS customer_name,
              w.service_type
       FROM payment_receipts pr
       INNER JOIN workers w ON pr.worker_id   = w.id
       INNER JOIN users u_w ON w.user_id       = u_w.id
       INNER JOIN users u_c ON pr.customer_id  = u_c.id
       WHERE pr.id = ? OR pr.receipt_number = ?`,
      [receiptId, receiptId]
    );

    if (!rows.length) {
      return { status: 'INVALID', message: 'Receipt not found' };
    }

    const receipt = rows[0];
    const currentHash = this.generateReceiptHash(receipt);
    let status = receipt.blockchain_status || 'PENDING';

    if (receipt.blockchain_hash && receipt.blockchain_hash !== currentHash) {
      status = 'TAMPERED';
    }

    return {
      status,
      isValid: status === 'VERIFIED',
      isTampered: status === 'TAMPERED',
      receipt,
      hash: currentHash,
      txHash: receipt.blockchain_tx_hash,
      blockNumber: receipt.blockchain_block_number,
      network: receipt.blockchain_network || ACTIVE_CONFIG.name,
      explorerUrl: receipt.blockchain_tx_hash ? `${ACTIVE_CONFIG.explorerUrl}/tx/${receipt.blockchain_tx_hash}` : null,
    };
  },

  /**
   * Verification by raw Hash
   */
  async verifyByHash(hash) {
    const cleanHash = hash.replace(/^0x/, '');

    // Search in certificates
    const [certs] = await pool.query('SELECT id FROM work_certificates WHERE blockchain_hash = ?', [cleanHash]);
    if (certs.length) return this.verifyCertificate(certs[0].id);

    // Search in invoices
    const [invs] = await pool.query('SELECT id FROM invoice_requests WHERE blockchain_hash = ?', [cleanHash]);
    if (invs.length) return this.verifyInvoice(invs[0].id);

    // Search in receipts
    const [receipts] = await pool.query('SELECT id FROM payment_receipts WHERE blockchain_hash = ?', [cleanHash]);
    if (receipts.length) return this.verifyReceipt(receipts[0].id);

    return { status: 'INVALID', message: 'Hash not found on platform record' };
  },

  /**
   * Admin Dashboard Metrics (Enhanced with Queue Job Metrics)
   */
  async getDashboardSummary() {
    const [certCounts] = await pool.query(
      `SELECT blockchain_status, COUNT(*) AS count FROM work_certificates GROUP BY blockchain_status`
    );
    const [receiptCounts] = await pool.query(
      `SELECT blockchain_status, COUNT(*) AS count FROM payment_receipts GROUP BY blockchain_status`
    );
    const [invoiceCounts] = await pool.query(
      `SELECT blockchain_status, COUNT(*) AS count FROM invoice_requests GROUP BY blockchain_status`
    );

    const [jobStats] = await pool.query(
      `SELECT status, COUNT(*) AS count FROM blockchain_jobs GROUP BY status`
    );

    const [lastRegistration] = await pool.query(
      `SELECT * FROM blockchain_jobs WHERE status = 'CONFIRMED' ORDER BY completed_at DESC LIMIT 1`
    );

    const [avgConfirmTime] = await pool.query(
      `SELECT AVG(TIMESTAMPDIFF(SECOND, created_at, completed_at)) AS avg_seconds
       FROM blockchain_jobs WHERE status = 'CONFIRMED' AND completed_at IS NOT NULL`
    );

    const [recentJobs] = await pool.query(
      `SELECT * FROM blockchain_jobs ORDER BY updated_at DESC LIMIT 30`
    );

    const [auditLogs] = await pool.query(
      `SELECT * FROM blockchain_audit_logs ORDER BY created_at DESC LIMIT 20`
    );

    return {
      network: ACTIVE_CONFIG.name,
      chainId: ACTIVE_CONFIG.chainId,
      simulationMode: SIMULATION_MODE,
      contractAddress: ACTIVE_CONFIG.contractAddress,
      certificateStats: certCounts,
      invoiceStats: invoiceCounts,
      receiptStats: receiptCounts,
      jobStats,
      recentJobs,
      lastSuccessfulRegistration: lastRegistration.length ? lastRegistration[0] : null,
      avgConfirmationSeconds: avgConfirmTime[0]?.avg_seconds ? Math.round(avgConfirmTime[0].avg_seconds) : 0,
      recentLogs: auditLogs,
    };
  },

  /**
   * Manual Retry Trigger for Failed / Dead Letter Job
   */
  async retryFailedJob(jobId) {
    const [jobs] = await pool.query('SELECT * FROM blockchain_jobs WHERE id = ?', [jobId]);
    if (!jobs.length) throw new Error(`Job #${jobId} not found`);

    await pool.query(
      `UPDATE blockchain_jobs
       SET status = 'PENDING', attempt_count = 0, next_retry_at = NOW(), last_error = NULL
       WHERE id = ?`,
      [jobId]
    );

    const BlockchainQueue = require('./BlockchainQueue');
    setImmediate(() => {
      BlockchainQueue.processJobById(jobId).catch(() => {});
    });

    return { success: true, message: `Job #${jobId} reset to PENDING and triggered` };
  },
};

module.exports = BlockchainService;

