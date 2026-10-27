/**
 * Seed Script Runner
 * Applies database/seed-demo-data.sql into MySQL
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function seed() {
  console.log('--- Seeding Local Tourism Package Booking System Demo Data ---');
  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT, 10) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'tourism_booking',
      multipleStatements: true
    });

    const seedSqlPath = path.join(__dirname, '..', 'database', 'seed-demo-data.sql');
    if (!fs.existsSync(seedSqlPath)) {
      throw new Error(`Seed SQL file not found at: ${seedSqlPath}`);
    }

    const sql = fs.readFileSync(seedSqlPath, 'utf8');
    await connection.query(sql);

    // Verify row counts
    const [dest] = await connection.query('SELECT COUNT(*) as count FROM destinations');
    const [cats] = await connection.query('SELECT COUNT(*) as count FROM categories');
    const [pkgs] = await connection.query('SELECT COUNT(*) as count FROM tour_packages');
    const [itin] = await connection.query('SELECT COUNT(*) as count FROM package_itinerary');
    const [avail] = await connection.query('SELECT COUNT(*) as count FROM package_availability');

    console.log('Seeding completed successfully!');
    console.log(`- Destinations: ${dest[0].count}`);
    console.log(`- Categories: ${cats[0].count}`);
    console.log(`- Tour Packages: ${pkgs[0].count}`);
    console.log(`- Itinerary Steps: ${itin[0].count}`);
    console.log(`- Availability Dates: ${avail[0].count}`);
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exitCode = 1;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

if (require.main === module) {
  seed();
}

module.exports = seed;
