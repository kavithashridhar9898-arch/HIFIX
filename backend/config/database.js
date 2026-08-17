const mysql = require('mysql2/promise');
require('dotenv').config();

const poolOptions = {
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || '25', 10),
  queueLimit: 0,

  enableKeepAlive: true,
  keepAliveInitialDelay: 0
};

// Enable SSL/TLS for Aiven Cloud MySQL and production SSL connections
if (
  process.env.DB_SSL === 'true' ||
  (process.env.DB_HOST && process.env.DB_HOST.includes('aivencloud.com')) ||
  process.env.NODE_ENV === 'production'
) {
  poolOptions.ssl = {
    rejectUnauthorized: false
  };
}

const pool = mysql.createPool(poolOptions);

pool.getConnection()
  .then(connection => {
    console.log('✅ MySQL database connected successfully');
    connection.release();
  })
  .catch(err => {
    console.error('❌ Database connection error:', err.message);
  });

module.exports = pool;
