const pool = require('../config/database');

async function updateBookingsSchema() {
  try {
    const dbName = process.env.DB_NAME || 'hifix_db';
    await pool.query(`USE ${dbName}`);

    // Make address nullable
    await pool.query("ALTER TABLE bookings MODIFY address TEXT NULL");
    // Add 'paid' status if not present (handled in code, but safe to add)
    await pool.query("ALTER TABLE bookings MODIFY status ENUM('pending', 'accepted', 'in_progress', 'completed', 'cancelled', 'paid') DEFAULT 'pending'");

    console.log('✅ Bookings schema updated: address is now optional, status includes paid.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating bookings schema:', error);
    process.exit(1);
  }
}

updateBookingsSchema();
