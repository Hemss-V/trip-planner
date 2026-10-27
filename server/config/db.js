/**
 * Database Connection Module
 * Uses mysql2/promise connection pool
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'tourism_booking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  dateStrings: true // Return date as YYYY-MM-DD string instead of Date object
});

// Test connection on initial load
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    connection.release();
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = {
  pool,
  testConnection
};
