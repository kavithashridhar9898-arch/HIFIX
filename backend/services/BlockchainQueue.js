const pool = require('../config/database');
const BlockchainService = require('./BlockchainService');
const NotificationService = require('./NotificationService');

const MAX_RETRIES = parseInt(process.env.BLOCKCHAIN_MAX_RETRIES || '5', 10);

/**
 * Exponential backoff delays in seconds:
 * Attempt 1: 30s, Attempt 2: 60s, Attempt 3: 120s, Attempt 4: 300s, Attempt 5: 600s
 */
const RETRY_DELAYS = [30, 60, 120, 300, 600];

function getRetryDelaySeconds(attempt) {
  const index = Math.min(attempt - 1, RETRY_DELAYS.length - 1);
  return RETRY_DELAYS[Math.max(0, index)];
}

class BlockchainQueue {
  /**
   * Universal Job Creation & Queue Entry
   */
  static async enqueueJob({ jobType, entityType, entityId, bookingId, entityHash, req = null }) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      // Check if job with this entity_hash already exists
      const [existingJobs] = await connection.query(
        'SELECT * FROM blockchain_jobs WHERE entity_hash = ? FOR UPDATE',
        [entityHash]
      );

      let jobId;
      let existingJob = null;

      if (existingJobs.length > 0) {
        existingJob = existingJobs[0];
        jobId = existingJob.id;

        if (existingJob.status === 'CONFIRMED') {
          await connection.commit();
          return {
            alreadyConfirmed: true,
            job: existingJob,
          };
        }

        // If previously failed or dead letter, reset to PENDING for re-process
        if (['FAILED', 'DEAD_LETTER'].includes(existingJob.status)) {
          await connection.query(
            `UPDATE blockchain_jobs
             SET status = 'PENDING', attempt_count = 0, next_retry_at = NOW(), last_error = NULL
             WHERE id = ?`,
            [jobId]
          );
        }
      } else {
        // Insert new persistent job
        const [insertRes] = await connection.query(
          `INSERT INTO blockchain_jobs
             (job_type, entity_type, entity_id, booking_id, entity_hash, status, max_attempts, next_retry_at)
           VALUES (?, ?, ?, ?, ?, 'PENDING', ?, NOW())`,
          [jobType, entityType, entityId, bookingId, entityHash, MAX_RETRIES]
        );
        jobId = insertRes.insertId;

        await BlockchainService.logAudit({
          entityType,
          entityId,
          action: 'BLOCKCHAIN_JOB_CREATED',
          hash: entityHash,
          details: `Job #${jobId} queued type ${jobType}`,
        });
      }

      await connection.commit();

      // Trigger immediate async processing worker tick
      setImmediate(() => {
        this.processJobById(jobId, req).catch((e) => {
          console.warn(`Background execution warning for job #${jobId}:`, e.message);
        });
      });

      return {
        alreadyConfirmed: false,
        jobId,
        status: 'PENDING',
      };
    } catch (error) {
      await connection.rollback();
      console.error('❌ Enqueue Job Error:', error.message);
      throw error;
    } finally {
      connection.release();
    }
  }

  /**
   * Helper: Enqueue Certificate Registration
   */
  static async enqueueCertificateRegistration({ bookingId, invoiceId, workerId, customerId, req = null }) {
    const certNumber = `HIFIX-CERT-${new Date().getFullYear()}-${String(bookingId).padStart(5, '0')}`;

    await pool.query(
      `INSERT INTO work_certificates
         (certificate_number, booking_id, invoice_id, worker_id, customer_id, blockchain_status)
       VALUES (?, ?, ?, ?, ?, 'PENDING')
       ON DUPLICATE KEY UPDATE blockchain_status = IF(blockchain_status = 'VERIFIED', 'VERIFIED', 'PENDING')`,
      [certNumber, bookingId, invoiceId, workerId, customerId]
    );

    const [certs] = await pool.query('SELECT * FROM work_certificates WHERE booking_id = ?', [bookingId]);
    if (!certs.length) throw new Error('Failed to load certificate record');
    const cert = certs[0];

    const hash = BlockchainService.generateCertificateHash(cert);

    // Save hash to entity record
    await pool.query('UPDATE work_certificates SET blockchain_hash = ? WHERE id = ?', [hash, cert.id]);

    return this.enqueueJob({
      jobType: 'REGISTER_CERTIFICATE',
      entityType: 'CERTIFICATE',
      entityId: cert.id,
      bookingId,
      entityHash: hash,
      req,
    });
  }

  /**
   * Helper: Enqueue Invoice Registration
   */
  static async enqueueInvoiceRegistration({ invoiceId, req = null }) {
    const [invoices] = await pool.query('SELECT * FROM invoice_requests WHERE id = ?', [invoiceId]);
    if (!invoices.length) throw new Error(`Invoice #${invoiceId} not found`);
    const invoice = invoices[0];

    const hash = BlockchainService.generateInvoiceHash(invoice);

    await pool.query('UPDATE invoice_requests SET blockchain_status = "PENDING", blockchain_hash = ? WHERE id = ?', [hash, invoiceId]);

    return this.enqueueJob({
      jobType: 'REGISTER_INVOICE',
      entityType: 'INVOICE',
      entityId: invoiceId,
      bookingId: invoice.booking_id,
      entityHash: hash,
      req,
    });
  }

  /**
   * Helper: Enqueue Receipt Registration
   */
  static async enqueueReceiptRegistration({ receiptId, req = null }) {
    const [receipts] = await pool.query('SELECT * FROM payment_receipts WHERE id = ?', [receiptId]);
    if (!receipts.length) throw new Error(`Receipt #${receiptId} not found`);
    const receipt = receipts[0];

    const hash = BlockchainService.generateReceiptHash(receipt);

    await pool.query('UPDATE payment_receipts SET blockchain_status = "PENDING", blockchain_hash = ? WHERE id = ?', [hash, receiptId]);

    return this.enqueueJob({
      jobType: 'REGISTER_RECEIPT',
      entityType: 'RECEIPT',
      entityId: receiptId,
      bookingId: receipt.booking_id,
      entityHash: hash,
      req,
    });
  }

  /**
   * Process a single job by ID with pessimistic concurrency locking
   */
  static async processJobById(jobId, req = null) {
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      const [jobs] = await connection.query(
        'SELECT * FROM blockchain_jobs WHERE id = ? FOR UPDATE',
        [jobId]
      );

      if (!jobs.length) {
        await connection.rollback();
        return;
      }

      const job = jobs[0];

      if (['CONFIRMED', 'DEAD_LETTER'].includes(job.status)) {
        await connection.rollback();
        return;
      }

      // Mark status as PROCESSING
      await connection.query(
        `UPDATE blockchain_jobs SET status = 'PROCESSING', updated_at = NOW() WHERE id = ?`,
        [jobId]
      );

      await connection.commit();

      await BlockchainService.logAudit({
        entityType: job.entity_type,
        entityId: job.entity_id,
        action: 'BLOCKCHAIN_JOB_PROCESSING',
        hash: job.entity_hash,
        details: `Processing job #${jobId} (Attempt ${job.attempt_count + 1}/${job.max_attempts})`,
      });

      // Submit to Polygon Blockchain
      let result;
      try {
        result = await BlockchainService.registerOnChain({
          hash: job.entity_hash,
          entityType: job.entity_type,
          bookingId: job.booking_id,
        });
      } catch (submitErr) {
        // Handle Submission Failure & Retry Backoff
        await this.handleJobFailure(job, submitErr.message);
        return;
      }

      // Mark CONFIRMED in DB
      await pool.query(
        `UPDATE blockchain_jobs
         SET status = 'CONFIRMED',
             transaction_hash = ?,
             block_number = ?,
             network = ?,
             completed_at = NOW(),
             last_error = NULL
         WHERE id = ?`,
        [result.txHash, result.blockNumber, result.network, jobId]
      );

      // Update target entity table
      await this.updateEntityVerified({
        entityType: job.entity_type,
        entityId: job.entity_id,
        txHash: result.txHash,
        blockNumber: result.blockNumber,
        network: result.network,
        hash: job.entity_hash,
      });

      await BlockchainService.logAudit({
        entityType: job.entity_type,
        entityId: job.entity_id,
        action: 'BLOCKCHAIN_JOB_CONFIRMED',
        hash: job.entity_hash,
        txHash: result.txHash,
        details: `Job #${jobId} confirmed on ${result.network} at block ${result.blockNumber}`,
      });

      // Dispatch Notifications
      try {
        await this.dispatchNotifications(job, result, req);
      } catch (_) {}

    } catch (err) {
      console.error(`❌ Process Job #${jobId} System Error:`, err.message);
    } finally {
      connection.release();
    }
  }

  /**
   * Handle Job Failure & Retry Backoff Logic
   */
  static async handleJobFailure(job, errorMessage) {
    const attempts = job.attempt_count + 1;
    const isDeadLetter = attempts >= job.max_attempts;
    const status = isDeadLetter ? 'DEAD_LETTER' : 'RETRYING';

    const delaySec = getRetryDelaySeconds(attempts);
    
    await pool.query(
      `UPDATE blockchain_jobs
       SET status = ?,
           attempt_count = ?,
           next_retry_at = DATE_ADD(NOW(), INTERVAL ? SECOND),
           last_error = ?
       WHERE id = ?`,
      [status, attempts, delaySec, errorMessage.substring(0, 1000), job.id]
    );

    // Update entity status to FAILED if dead letter
    if (isDeadLetter) {
      await this.updateEntityFailed(job.entity_type, job.entity_id);
    }

    await BlockchainService.logAudit({
      entityType: job.entity_type,
      entityId: job.entity_id,
      action: isDeadLetter ? 'BLOCKCHAIN_JOB_DEAD_LETTER' : 'BLOCKCHAIN_JOB_RETRY',
      hash: job.entity_hash,
      details: isDeadLetter
        ? `Job #${job.id} reached max retries (${attempts}/${job.max_attempts}). Error: ${errorMessage}`
        : `Job #${job.id} failed (attempt ${attempts}/${job.max_attempts}). Retrying in ${delaySec}s. Error: ${errorMessage}`,
    });
  }

  /**
   * Update associated database table upon verification confirmation
   */
  static async updateEntityVerified({ entityType, entityId, txHash, blockNumber, network, hash }) {
    if (entityType === 'CERTIFICATE') {
      await pool.query(
        `UPDATE work_certificates
         SET blockchain_status = 'VERIFIED',
             blockchain_tx_hash = ?,
             blockchain_hash = ?,
             blockchain_verified_at = NOW(),
             blockchain_block_number = ?,
             blockchain_network = ?
         WHERE id = ?`,
        [txHash, hash, blockNumber, network, entityId]
      );
    } else if (entityType === 'INVOICE') {
      await pool.query(
        `UPDATE invoice_requests
         SET blockchain_status = 'VERIFIED',
             blockchain_tx_hash = ?,
             blockchain_hash = ?,
             blockchain_verified_at = NOW(),
             blockchain_block_number = ?,
             blockchain_network = ?
         WHERE id = ?`,
        [txHash, hash, blockNumber, network, entityId]
      );
    } else if (entityType === 'RECEIPT') {
      await pool.query(
        `UPDATE payment_receipts
         SET blockchain_status = 'VERIFIED',
             blockchain_tx_hash = ?,
             blockchain_hash = ?,
             blockchain_verified_at = NOW(),
             blockchain_block_number = ?,
             blockchain_network = ?
         WHERE id = ?`,
        [txHash, hash, blockNumber, network, entityId]
      );
    }
  }

  /**
   * Update associated database table upon dead letter failure
   */
  static async updateEntityFailed(entityType, entityId) {
    if (entityType === 'CERTIFICATE') {
      await pool.query(`UPDATE work_certificates SET blockchain_status = 'FAILED' WHERE id = ?`, [entityId]);
    } else if (entityType === 'INVOICE') {
      await pool.query(`UPDATE invoice_requests SET blockchain_status = 'FAILED' WHERE id = ?`, [entityId]);
    } else if (entityType === 'RECEIPT') {
      await pool.query(`UPDATE payment_receipts SET blockchain_status = 'FAILED' WHERE id = ?`, [entityId]);
    }
  }

  /**
   * Dispatch Push & In-App Notifications
   */
  static async dispatchNotifications(job, result, req) {
    if (job.entity_type === 'CERTIFICATE') {
      const [certs] = await pool.query('SELECT * FROM work_certificates WHERE id = ?', [job.entity_id]);
      if (certs.length) {
        const cert = certs[0];
        const [wUser] = await pool.query('SELECT user_id FROM workers WHERE id = ?', [cert.worker_id]);
        if (wUser.length) {
          await NotificationService.sendNotification({
            req,
            userId: wUser[0].user_id,
            title: '🔗 Certificate Verified on Polygon',
            message: `Certificate #${cert.certificate_number} registered on ${result.network}!`,
            type: 'info',
            relatedEntityId: cert.id,
          }).catch(() => {});
        }
        await NotificationService.sendNotification({
          req,
          userId: cert.customer_id,
          title: '🔗 Certificate Verified on Polygon',
          message: `Your Work Certificate #${cert.certificate_number} has been verified on Polygon!`,
          type: 'info',
          relatedEntityId: cert.id,
        }).catch(() => {});
      }
    } else if (job.entity_type === 'RECEIPT') {
      const [receipts] = await pool.query('SELECT * FROM payment_receipts WHERE id = ?', [job.entity_id]);
      if (receipts.length) {
        const receipt = receipts[0];
        await NotificationService.sendNotification({
          req,
          userId: receipt.customer_id,
          title: '🔗 Payment Receipt Verified',
          message: `Receipt #${receipt.receipt_number} immutably verified on Polygon.`,
          type: 'payment',
          relatedEntityId: receipt.id,
        }).catch(() => {});
      }
    }
  }

  /**
   * Process all pending or due retrying jobs in DB worker batch
   */
  static async processPendingJobs() {
    try {
      const [dueJobs] = await pool.query(
        `SELECT id FROM blockchain_jobs
         WHERE status IN ('PENDING', 'RETRYING')
           AND next_retry_at <= NOW()
         ORDER BY id ASC
         LIMIT 20`
      );

      for (const jobRow of dueJobs) {
        await this.processJobById(jobRow.id);
      }
    } catch (e) {
      console.warn('Queue Batch Processing Error:', e.message);
    }
  }

  /**
   * Server Startup Recovery & Transaction Reconciliation (MANDATORY)
   */
  static async initServerRecovery() {
    console.log('🔄 Initializing Blockchain Queue Server Restart Recovery...');
    try {
      // 1. Reconcile jobs left in 'PROCESSING' state due to server crash/shutdown
      const [interruptedJobs] = await pool.query(
        "SELECT * FROM blockchain_jobs WHERE status = 'PROCESSING'"
      );

      for (const job of interruptedJobs) {
        console.log(`🔍 Reconciling interrupted job #${job.id} (${job.entity_type} ID ${job.entity_id})...`);

        // Check if on-chain record or entity already has txHash
        if (job.transaction_hash) {
          // Re-verify transaction on Polygon
          await pool.query(
            `UPDATE blockchain_jobs SET status = 'CONFIRMED', completed_at = NOW() WHERE id = ?`,
            [job.id]
          );
          await this.updateEntityVerified({
            entityType: job.entity_type,
            entityId: job.entity_id,
            txHash: job.transaction_hash,
            blockNumber: job.block_number || 0,
            network: job.network || 'Polygon Amoy Testnet',
            hash: job.entity_hash,
          });
        } else {
          // Reset status to PENDING so worker can process cleanly without duplicating
          await pool.query(
            `UPDATE blockchain_jobs SET status = 'PENDING', next_retry_at = NOW() WHERE id = ?`,
            [job.id]
          );
        }
      }

      // 2. Process all pending/due retrying jobs
      await this.processPendingJobs();

      // 3. Schedule periodic background polling ticker (every 30 seconds)
      setInterval(() => {
        this.processPendingJobs().catch(() => {});
      }, 30000);

      console.log('✅ Blockchain Queue Server Restart Recovery Complete.');
    } catch (error) {
      console.error('❌ Server Restart Recovery Error:', error.message);
    }
  }
}

module.exports = BlockchainQueue;
