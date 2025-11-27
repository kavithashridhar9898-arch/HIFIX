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
        address TEXT NOT NULL,
        description TEXT,
        service_type VARCHAR(100),
        service_id INT,
        estimated_hours DECIMAL(5, 2),
        estimated_price DECIMAL(10, 2),
        payment_status ENUM('pending_payment', 'paid', 'payment_failed') DEFAULT 'pending_payment',
        payment_method ENUM('none', 'upi', 'mock', 'cash') DEFAULT 'none',
        payment_amount DECIMAL(10, 2),
        latitude DECIMAL(10, 8),
        longitude DECIMAL(11, 8),
        status ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        completed_at TIMESTAMP NULL,
        FOREIGN KEY (homeowner_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE CASCADE
      ) ENGINE=InnoDB;
    `);

    const bookingColumnUpdates = [
      "ADD COLUMN service_type VARCHAR(100)",
      "ADD COLUMN service_id INT",
      "ADD COLUMN estimated_hours DECIMAL(5, 2)",
      "ADD COLUMN estimated_price DECIMAL(10, 2)",
      "ADD COLUMN payment_status ENUM('pending_payment', 'paid', 'payment_failed') DEFAULT 'pending_payment'",
      "ADD COLUMN payment_method ENUM('none', 'upi', 'mock', 'cash') DEFAULT 'none'",
      "ADD COLUMN payment_amount DECIMAL(10, 2)",
      "ADD COLUMN latitude DECIMAL(10, 8)",
      "ADD COLUMN longitude DECIMAL(11, 8)",
      "ADD COLUMN completed_at TIMESTAMP NULL",
      "ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
      "ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    ];

    for (const statement of bookingColumnUpdates) {
      try {
        await pool.query(`ALTER TABLE bookings ${statement}`);
        console.log(`✅ bookings table updated with: ${statement}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⏭️  bookings column already exists for: ${statement}`);
        } else {
          console.warn(`⚠️  Skipped adding bookings column (${statement}): ${error.message}`);
        }
      }
    }

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

    console.log('✅ All tables created or already exist.');
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    process.exit(1);
  }
}

module.exports = initializeDatabase;