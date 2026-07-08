const pool = require('./config/database');

async function updateSchema() {
  try {
    // 1. Alter notifications table to expand ENUM and add related_entity_id
    console.log("Altering notifications table...");
    await pool.query(`
      ALTER TABLE notifications 
      MODIFY COLUMN type ENUM('info', 'security', 'booking', 'payment', 'chat', 'promotion', 'admin', 'system', 'offer') DEFAULT 'info',
      ADD COLUMN related_entity_id INT DEFAULT NULL AFTER type;
    `);
    
    // 2. Create device_tokens table
    console.log("Creating device_tokens table...");
    await pool.query(`
      CREATE TABLE IF NOT EXISTS device_tokens (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        fcm_token TEXT NOT NULL,
        device_type ENUM('android', 'ios', 'web') DEFAULT 'android',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE KEY unique_user_token (user_id, fcm_token(255))
      ) ENGINE=InnoDB;
    `);

    console.log("Schema updated successfully.");
    process.exit(0);
  } catch (error) {
    console.error("Schema update failed:", error);
    process.exit(1);
  }
}

updateSchema();
