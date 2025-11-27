const pool = require('../config/database');

async function updateWorkerSchema() {
  try {
    const dbName = process.env.DB_NAME || 'hifix_db';
    await pool.query(`USE ${dbName}`);

    console.log('Updating workers table schema...');

    // Add columns one by one, ignoring errors if they already exist
    const columns = [
      "ALTER TABLE workers ADD COLUMN min_charge DECIMAL(10, 2) DEFAULT 50.00 AFTER hourly_rate",
      "ALTER TABLE workers ADD COLUMN skills TEXT AFTER bio",
      "ALTER TABLE workers ADD COLUMN city VARCHAR(100) AFTER address",
      "ALTER TABLE workers ADD COLUMN state VARCHAR(100) AFTER city",
      "ALTER TABLE workers ADD COLUMN zip_code VARCHAR(20) AFTER state",
      "ALTER TABLE workers ADD COLUMN license_number VARCHAR(100) AFTER zip_code",
      "ALTER TABLE workers ADD COLUMN total_jobs INT DEFAULT 0 AFTER verified",
      "ALTER TABLE workers ADD COLUMN average_rating DECIMAL(3, 2) DEFAULT 0.00 AFTER total_jobs",
      "ALTER TABLE workers ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP AFTER average_rating",
      "ALTER TABLE workers ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at"
    ];

    for (const sql of columns) {
      try {
        await pool.query(sql);
        console.log(`✅ ${sql.substring(0, 50)}...`);
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`⚠️  Column already exists, skipping...`);
        } else {
          console.error(`❌ Error: ${error.message}`);
        }
      }
    }

    console.log('\n✅ Schema update completed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error updating schema:', error);
    process.exit(1);
  }
}

updateWorkerSchema();
