const pool = require('../config/database');

async function migrateBlockchainJobs() {
  try {
    console.log('🚀 Running DB Migration: Creating blockchain_jobs table...');

    await pool.query(`
      CREATE TABLE IF NOT EXISTS blockchain_jobs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        job_type ENUM('REGISTER_CERTIFICATE', 'REGISTER_INVOICE', 'REGISTER_RECEIPT') NOT NULL,
        entity_type VARCHAR(50) NOT NULL,
        entity_id INT NOT NULL,
        booking_id INT NOT NULL,
        entity_hash VARCHAR(64) NOT NULL UNIQUE,
        status ENUM('PENDING', 'PROCESSING', 'RETRYING', 'CONFIRMED', 'FAILED', 'DEAD_LETTER') DEFAULT 'PENDING',
        attempt_count INT DEFAULT 0,
        max_attempts INT DEFAULT 5,
        next_retry_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        transaction_hash VARCHAR(100) NULL,
        block_number INT NULL,
        network VARCHAR(100) NULL,
        last_error TEXT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        completed_at DATETIME NULL,
        INDEX idx_status_retry (status, next_retry_at),
        INDEX idx_entity (entity_type, entity_id),
        INDEX idx_booking (booking_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    console.log('✅ blockchain_jobs table created / verified successfully!');
  } catch (error) {
    console.error('❌ Migration Error:', error.message);
  } finally {
    process.exit(0);
  }
}

migrateBlockchainJobs();
