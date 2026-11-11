/**
 * Database Connection Module
 * Uses mysql2/promise connection pool
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT, 10) || 3306,
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || 'tourism_booking',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  multipleStatements: true,
  dateStrings: true // Return date as YYYY-MM-DD string instead of Date object
});

// Test connection on initial load
async function testConnection() {
  const dbName = process.env.DB_NAME || process.env.MYSQLDATABASE || 'tourism_booking';
  try {
    const connection = await pool.getConnection();
    connection.release();
    return { ok: true };
  } catch (err) {
    if (err.code === 'ER_BAD_DB_ERROR' || (err.message && err.message.includes('Unknown database'))) {
      console.log(`Database '${dbName}' not found. Creating it...`);
      try {
        const adminConn = await mysql.createConnection({
          host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
          port: parseInt(process.env.DB_PORT || process.env.MYSQLPORT, 10) || 3306,
          user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
          password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
          multipleStatements: true
        });
        await adminConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
        await adminConn.end();
        console.log(`Database '${dbName}' created successfully.`);
        const retryConn = await pool.getConnection();
        retryConn.release();
        return { ok: true };
      } catch (createErr) {
        return { ok: false, error: createErr.message };
      }
    }
    return { ok: false, error: err.message };
  }
}

module.exports = {
  pool,
  testConnection
};
