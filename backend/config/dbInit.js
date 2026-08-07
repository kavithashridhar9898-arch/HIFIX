const pool = require('./database');

async function initializeDatabase() {
  try {
    const dbName = process.env.DB_NAME || 'hifix_db';
    await pool.query(`CREATE DATABASE IF NOT EXISTS 
      ${dbName}
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await pool.query(`USE 
      ${dbName}
    `);

    console.log('✅ Database selected');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone VARCHAR(20),
        password VARCHAR(255) NOT NULL,
        user_type ENUM('homeowner', 'worker') NOT NULL,
        profile_image VARCHAR(500),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS workers (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        service_type ENUM('painter', 'electrician', 'plumber', 'carpenter', 'handyman', 'hvac') NOT NULL,
        experience_years INT DEFAULT 0,
        hourly_rate DECIMAL(10, 2) DEFAULT 20.00,
        min_charge DECIMAL(10, 2) DEFAULT 50.00,
        bio TEXT,
        skills TEXT,
        availability_status ENUM('available', 'busy', 'offline') DEFAULT 'available',
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        address TEXT,
        city VARCHAR(100),
        state VARCHAR(100),
        zip_code VARCHAR(20),
        license_number VARCHAR(100),
        verified BOOLEAN DEFAULT FALSE,
        total_jobs INT DEFAULT 0,
        average_rating DECIMAL(3, 2) DEFAULT 0.00,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS bookings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        homeowner_id INT NOT NULL,
        worker_id INT NOT NULL,
        booking_date DATETIME NOT NULL,
        address TEXT,
        description TEXT,
        status ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'paid') DEFAULT 'pending',
        FOREIGN KEY (homeowner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS reviews (
        id INT AUTO_INCREMENT PRIMARY KEY,
        booking_id INT NOT NULL,
        reviewer_id INT NOT NULL,
        worker_id INT NOT NULL,
        rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
        comment TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_gallery (
        id INT AUTO_INCREMENT PRIMARY KEY,
        worker_id INT NOT NULL,
        image_url VARCHAR(500) NOT NULL,
        description VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);
    
    await pool.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        message TEXT NOT NULL,
        type ENUM('info', 'security', 'booking', 'payment') DEFAULT 'info',
        is_read BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS notification_settings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL UNIQUE,
        email_notifications BOOLEAN DEFAULT TRUE,
        push_notifications BOOLEAN DEFAULT TRUE,
        sms_notifications BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // ── Payment Module ────────────────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id                    INT AUTO_INCREMENT PRIMARY KEY,
        booking_id            INT NOT NULL,
        worker_id             INT NOT NULL,
        customer_id           INT NOT NULL,
        requested_amount      DECIMAL(12, 2) NOT NULL,
        status                ENUM('pending','requested','paid','cancelled','refunded','completed')
                              NOT NULL DEFAULT 'pending',
        payment_method        ENUM('cash','online','razorpay','upi','bank_transfer')
                              NOT NULL DEFAULT 'cash',
        transaction_reference VARCHAR(255) DEFAULT NULL,
        notes                 TEXT DEFAULT NULL,
        created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id)   REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id)    REFERENCES workers(id)  ON DELETE CASCADE,
        FOREIGN KEY (customer_id)  REFERENCES users(id)    ON DELETE CASCADE,
        INDEX idx_payments_booking_id   (booking_id),
        INDEX idx_payments_customer_id  (customer_id),
        INDEX idx_payments_worker_id    (worker_id),
        INDEX idx_payments_status       (status)
      ) ENGINE=InnoDB;
    `);

    // ── Phase 2: Worker Professional Details columns ───────────────────────────
    // Safely add new columns to existing workers table (no-op if already present)
    const workerColumnsToAdd = [
      { name: 'travel_charge_per_km', def: 'DECIMAL(8,2) DEFAULT NULL' },
      { name: 'emergency_charge',     def: 'DECIMAL(8,2) DEFAULT NULL' },
      { name: 'working_hours',        def: "VARCHAR(100) DEFAULT '9am - 6pm'" },
      { name: 'service_radius',       def: 'INT DEFAULT 10' },
    ];
    await Promise.all(workerColumnsToAdd.map(async (col) => {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'workers' AND COLUMN_NAME = ?`,
        [dbName, col.name]
      );
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE workers ADD COLUMN ${col.name} ${col.def}`);
        console.log(`✅ Added workers.${col.name}`);
      }
    }));

    // ── Phase 2: Work Sessions (persistent timer) ─────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_sessions (
        id               INT AUTO_INCREMENT PRIMARY KEY,
        booking_id       INT NOT NULL,
        worker_id        INT NOT NULL,
        started_at       DATETIME NOT NULL,
        paused_at        DATETIME DEFAULT NULL,
        total_paused_ms  BIGINT DEFAULT 0,
        status           ENUM('active','paused','completed') NOT NULL DEFAULT 'active',
        completed_at     DATETIME DEFAULT NULL,
        total_duration_ms BIGINT DEFAULT 0,
        locked           BOOLEAN DEFAULT FALSE,
        created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_booking_session (booking_id),
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id)  REFERENCES workers(id)  ON DELETE CASCADE,
        INDEX idx_ws_worker_id   (worker_id),
        INDEX idx_ws_status      (status)
      ) ENGINE=InnoDB;
    `);

    // ── Phase 2: Invoice Requests ──────────────────────────────────────────────
    await pool.query(`
      CREATE TABLE IF NOT EXISTS invoice_requests (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        booking_id           INT NOT NULL,
        worker_id            INT NOT NULL,
        customer_id          INT NOT NULL,
        hourly_rate_snapshot DECIMAL(10,2) NOT NULL,
        worked_seconds       INT NOT NULL DEFAULT 0,
        labour_cost          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        material_items       JSON DEFAULT NULL,
        material_cost        DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        travel_cost          DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        emergency_cost       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        other_cost           DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        other_cost_note      VARCHAR(300) DEFAULT NULL,
        discount             DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        tax                  DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        platform_fee         DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        grand_total          DECIMAL(12,2) NOT NULL,
        service_description  TEXT NOT NULL,
        notes                TEXT DEFAULT NULL,
        status               ENUM('requested','viewed','accepted','rejected','expired','paid','cancelled','refunded','completed')
                             NOT NULL DEFAULT 'requested',
        viewed_at            DATETIME DEFAULT NULL,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id)  REFERENCES bookings(id)  ON DELETE CASCADE,
        FOREIGN KEY (worker_id)   REFERENCES workers(id)   ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users(id)     ON DELETE CASCADE,
        INDEX idx_ir_worker_id   (worker_id),
        INDEX idx_ir_customer_id (customer_id),
        INDEX idx_ir_booking_id  (booking_id),
        INDEX idx_ir_status      (status)
      ) ENGINE=InnoDB;
    `);

    console.log('✅ All tables created or already exist.');

    // ── Phase 3: Razorpay Payment Processing ──────────────────────────────────

    // razorpay_orders — audit + idempotency (one order per invoice attempt)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS razorpay_orders (
        id                INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id        INT NOT NULL,
        booking_id        INT NOT NULL,
        customer_id       INT NOT NULL,
        worker_id         INT NOT NULL,
        razorpay_order_id VARCHAR(100) NOT NULL UNIQUE,
        amount_paise      INT NOT NULL,
        currency          CHAR(3) DEFAULT 'INR',
        status            ENUM('created','attempted','paid','failed') DEFAULT 'created',
        receipt_ref       VARCHAR(100) NOT NULL,
        created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id)  REFERENCES invoice_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id)  REFERENCES bookings(id)         ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users(id)            ON DELETE CASCADE,
        INDEX idx_rzo_invoice  (invoice_id),
        INDEX idx_rzo_order_id (razorpay_order_id)
      ) ENGINE=InnoDB;
    `);

    // payment_receipts — digital receipts issued after successful payment
    await pool.query(`
      CREATE TABLE IF NOT EXISTS payment_receipts (
        id                   INT AUTO_INCREMENT PRIMARY KEY,
        invoice_id           INT NOT NULL UNIQUE,
        booking_id           INT NOT NULL,
        razorpay_payment_id  VARCHAR(100) NOT NULL,
        razorpay_order_id    VARCHAR(100) NOT NULL,
        razorpay_signature   VARCHAR(500) NOT NULL,
        receipt_number       VARCHAR(50)  NOT NULL UNIQUE,
        amount               DECIMAL(12,2) NOT NULL,
        currency             CHAR(3) DEFAULT 'INR',
        payment_method       VARCHAR(50) DEFAULT NULL,
        paid_at              DATETIME NOT NULL,
        worker_id            INT NOT NULL,
        customer_id          INT NOT NULL,
        created_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (invoice_id)  REFERENCES invoice_requests(id),
        FOREIGN KEY (booking_id)  REFERENCES bookings(id),
        FOREIGN KEY (worker_id)   REFERENCES workers(id),
        FOREIGN KEY (customer_id) REFERENCES users(id),
        INDEX idx_pr_invoice  (invoice_id),
        INDEX idx_pr_customer (customer_id),
        INDEX idx_pr_worker   (worker_id)
      ) ENGINE=InnoDB;
    `);

    // webhook_events — idempotency log for Razorpay webhooks
    await pool.query(`
      CREATE TABLE IF NOT EXISTS webhook_events (
        id           INT AUTO_INCREMENT PRIMARY KEY,
        event_id     VARCHAR(100) NOT NULL UNIQUE,
        event_type   VARCHAR(100) NOT NULL,
        payload      JSON,
        processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB;
    `);

    // worker_earnings — denormalized dashboard cache
    await pool.query(`
      CREATE TABLE IF NOT EXISTS worker_earnings (
        worker_id       INT NOT NULL PRIMARY KEY,
        total_earned    DECIMAL(14,2) DEFAULT 0.00,
        total_pending   DECIMAL(14,2) DEFAULT 0.00,
        total_jobs_paid INT DEFAULT 0,
        last_payment_at DATETIME DEFAULT NULL,
        updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    // Safely add new columns (no-op if already present)
    const phase3PaymentCols = [
      { name: 'razorpay_order_id',   def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'razorpay_payment_id', def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'razorpay_signature',  def: 'VARCHAR(500) DEFAULT NULL' },
      { name: 'paid_at',             def: 'DATETIME DEFAULT NULL' },
      { name: 'failure_reason',      def: 'TEXT DEFAULT NULL' },
    ];
    for (const col of phase3PaymentCols) {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payments' AND COLUMN_NAME = ?`,
        [dbName, col.name]
      );
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE payments ADD COLUMN ${col.name} ${col.def}`);
        console.log(`✅ Added payments.${col.name}`);
      }
    }

    const phase3InvoiceCols = [
      { name: 'accepted_at',        def: 'DATETIME DEFAULT NULL' },
      { name: 'min_charge_applied', def: 'BOOLEAN DEFAULT FALSE' },
      { name: 'min_charge',         def: 'DECIMAL(12,2) DEFAULT 0.00' },
    ];
    for (const col of phase3InvoiceCols) {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoice_requests' AND COLUMN_NAME = ?`,
        [dbName, col.name]
      );
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE invoice_requests ADD COLUMN ${col.name} ${col.def}`);
        console.log(`✅ Added invoice_requests.${col.name}`);
      }
    }

    // Expand payments.status ENUM to include new statuses
    try {
      await pool.query(`
        ALTER TABLE payments
        MODIFY COLUMN status
          ENUM('pending','requested','initiated','processing','paid','failed','cancelled','refunded','disputed','completed')
          NOT NULL DEFAULT 'pending'
      `);
    } catch (_) { /* already updated */ }

    console.log('✅ Phase 3 schema ready.');

    // ── Phase 4: Polygon Blockchain Integration ───────────────────────────────

    // 1. Digital Work Completion Certificates table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS work_certificates (
        id                      INT AUTO_INCREMENT PRIMARY KEY,
        certificate_number      VARCHAR(50) NOT NULL UNIQUE,
        booking_id              INT NOT NULL UNIQUE,
        invoice_id              INT NOT NULL,
        worker_id               INT NOT NULL,
        customer_id             INT NOT NULL,
        issued_at               DATETIME DEFAULT CURRENT_TIMESTAMP,
        blockchain_status       ENUM('NONE','PENDING','VERIFIED','FAILED','TAMPERED') DEFAULT 'NONE',
        blockchain_tx_hash      VARCHAR(100) DEFAULT NULL,
        blockchain_hash         CHAR(64) DEFAULT NULL,
        blockchain_verified_at  DATETIME DEFAULT NULL,
        blockchain_block_number BIGINT DEFAULT NULL,
        blockchain_network      VARCHAR(50) DEFAULT 'Polygon Amoy',
        FOREIGN KEY (booking_id)  REFERENCES bookings(id)         ON DELETE CASCADE,
        FOREIGN KEY (invoice_id)  REFERENCES invoice_requests(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id)   REFERENCES workers(id)          ON DELETE CASCADE,
        FOREIGN KEY (customer_id) REFERENCES users(id)            ON DELETE CASCADE,
        INDEX idx_cert_booking (booking_id),
        INDEX idx_cert_status  (blockchain_status)
      ) ENGINE=InnoDB;
    `);

    // 2. Blockchain Audit Logs table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS blockchain_audit_logs (
        id          INT AUTO_INCREMENT PRIMARY KEY,
        entity_type ENUM('CERTIFICATE','INVOICE','RECEIPT') NOT NULL,
        entity_id   INT NOT NULL,
        action      ENUM('REGISTER_REQUESTED','REGISTER_SUCCESS','REGISTER_FAILED','VERIFICATION_REQUESTED','VERIFICATION_SUCCESS','TAMPER_DETECTED') NOT NULL,
        hash        CHAR(64) NOT NULL,
        tx_hash     VARCHAR(100) DEFAULT NULL,
        details     TEXT DEFAULT NULL,
        created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_bal_entity (entity_type, entity_id),
        INDEX idx_bal_hash   (hash)
      ) ENGINE=InnoDB;
    `);

    // 3. Extend invoice_requests table for Blockchain
    const phase4InvoiceCols = [
      { name: 'blockchain_status',       def: "ENUM('NONE','PENDING','VERIFIED','FAILED','TAMPERED') DEFAULT 'NONE'" },
      { name: 'blockchain_tx_hash',      def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'blockchain_hash',         def: 'CHAR(64) DEFAULT NULL' },
      { name: 'blockchain_verified_at',  def: 'DATETIME DEFAULT NULL' },
      { name: 'blockchain_block_number', def: 'BIGINT DEFAULT NULL' },
      { name: 'blockchain_network',      def: "VARCHAR(50) DEFAULT 'Polygon Amoy'" },
    ];
    for (const col of phase4InvoiceCols) {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'invoice_requests' AND COLUMN_NAME = ?`,
        [dbName, col.name]
      );
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE invoice_requests ADD COLUMN ${col.name} ${col.def}`);
        console.log(`✅ Added invoice_requests.${col.name}`);
      }
    }

    // 4. Extend payment_receipts table for Blockchain
    const phase4ReceiptCols = [
      { name: 'blockchain_status',       def: "ENUM('NONE','PENDING','VERIFIED','FAILED','TAMPERED') DEFAULT 'NONE'" },
      { name: 'blockchain_tx_hash',      def: 'VARCHAR(100) DEFAULT NULL' },
      { name: 'blockchain_hash',         def: 'CHAR(64) DEFAULT NULL' },
      { name: 'blockchain_verified_at',  def: 'DATETIME DEFAULT NULL' },
      { name: 'blockchain_block_number', def: 'BIGINT DEFAULT NULL' },
      { name: 'blockchain_network',      def: "VARCHAR(50) DEFAULT 'Polygon Amoy'" },
    ];
    for (const col of phase4ReceiptCols) {
      const [cols] = await pool.query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'payment_receipts' AND COLUMN_NAME = ?`,
        [dbName, col.name]
      );
      if (cols.length === 0) {
        await pool.query(`ALTER TABLE payment_receipts ADD COLUMN ${col.name} ${col.def}`);
        console.log(`✅ Added payment_receipts.${col.name}`);
      }
    }

    // 5. Performance Indexes
    const perfIndexes = [
      { table: 'workers', name: 'idx_workers_lat_lng', def: '(latitude, longitude)' },
      { table: 'workers', name: 'idx_workers_service_city', def: '(service_type, city)' },
      { table: 'bookings', name: 'idx_bookings_lat_lng', def: '(latitude, longitude)' },
      { table: 'bookings', name: 'idx_bookings_status_date', def: '(status, booking_date)' },
      { table: 'invoice_requests', name: 'idx_ir_cust_status', def: '(customer_id, status)' },
      { table: 'invoice_requests', name: 'idx_ir_work_status', def: '(worker_id, status)' }
    ];

    for (const idx of perfIndexes) {
      try {
        const [existing] = await pool.query(
          `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
           WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ?`,
          [dbName, idx.table, idx.name]
        );
        if (existing.length === 0) {
          await pool.query(`ALTER TABLE ${idx.table} ADD INDEX ${idx.name} ${idx.def}`);
          console.log(`✅ Added index ${idx.table}.${idx.name}`);
        }
      } catch (_) {}
    }

    console.log('✅ Phase 4 Blockchain schema & Performance Indexes ready.');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
}

module.exports = initializeDatabase;