const pool = require('../config/database');

async function updateBookingsTable() {
  try {
    console.log('🔄 Updating bookings table schema...');

    // Add missing columns
    const columnsToAdd = [
      { name: 'service_type', sql: `ADD COLUMN service_type VARCHAR(100)` },
      { name: 'service_id', sql: `ADD COLUMN service_id INT` },
      { name: 'estimated_hours', sql: `ADD COLUMN estimated_hours DECIMAL(5, 2)` },
      { name: 'estimated_price', sql: `ADD COLUMN estimated_price DECIMAL(10, 2)` },
      { name: 'payment_status', sql: `ADD COLUMN payment_status ENUM('pending_payment', 'paid', 'payment_failed') DEFAULT 'pending_payment'` },
      { name: 'payment_method', sql: `ADD COLUMN payment_method ENUM('none', 'upi', 'mock', 'cash') DEFAULT 'none'` },
      { name: 'payment_amount', sql: `ADD COLUMN payment_amount DECIMAL(10, 2)` },
      { name: 'latitude', sql: `ADD COLUMN latitude DECIMAL(10, 8)` },
      { name: 'longitude', sql: `ADD COLUMN longitude DECIMAL(11, 8)` },
      { name: 'completed_at', sql: `ADD COLUMN completed_at TIMESTAMP NULL` },
      { name: 'created_at', sql: `ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP` },
      { name: 'updated_at', sql: `ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP` }
    ];

    for (const column of columnsToAdd) {
      try {
        await pool.query(`ALTER TABLE bookings ${column.sql}`);
        console.log(`✅ Added column: ${column.name}`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⏭️  Column already exists: ${column.name}`);
        } else {
          console.error(`❌ Error adding column ${column.name}:`, error.message);
        }
      }
    }

    console.log('✅ Bookings table updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating bookings table:', error);
    process.exit(1);
  }
}

updateBookingsTable();
