const pool = require('../config/database');

async function updateSchema() {
  try {
    // 1. Add google_id to users and modify password to allow NULL
    console.log("Altering users table to support Google Authentication...");
    await pool.query(`
      ALTER TABLE users 
      ADD COLUMN google_id VARCHAR(255) DEFAULT NULL UNIQUE AFTER email,
      MODIFY COLUMN password VARCHAR(255) DEFAULT NULL;
    `);
    
    console.log("✅ Database schema updated successfully for Google Auth.");
    process.exit(0);
  } catch (error) {
    console.error("❌ Schema update failed:", error);
    process.exit(1);
  }
}

updateSchema();
