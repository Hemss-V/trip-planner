/**
 * Initialize new tables and run seed data
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

async function init() {
  console.log('Initializing database tables...');
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT, 10) || 3306,
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'tourism_booking',
    multipleStatements: true
  });

  const createTablesSql = `
    CREATE TABLE IF NOT EXISTS coupons (
        coupon_id INT AUTO_INCREMENT PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        description VARCHAR(255) NOT NULL,
        discount_type ENUM('PERCENT', 'FLAT') NOT NULL DEFAULT 'PERCENT',
        discount_value DECIMAL(10,2) NOT NULL,
        min_booking_amount DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        max_discount DECIMAL(10,2) NULL,
        valid_until DATE NOT NULL,
        usage_limit INT NOT NULL DEFAULT 100,
        times_used INT NOT NULL DEFAULT 0,
        status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS custom_itineraries (
        itinerary_id INT AUTO_INCREMENT PRIMARY KEY,
        customer_id INT NOT NULL,
        destination_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        start_date DATE NOT NULL,
        duration_days INT NOT NULL,
        travel_pace ENUM('Relaxed', 'Moderate', 'Adventure') NOT NULL DEFAULT 'Moderate',
        interests VARCHAR(255) NOT NULL,
        accommodation_tier ENUM('Budget', 'Standard', 'Luxury') NOT NULL DEFAULT 'Standard',
        estimated_cost DECIMAL(10,2) NOT NULL DEFAULT 0.00,
        notes TEXT,
        day_plan JSON,
        booking_request_status ENUM('DRAFT', 'SUBMITTED', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
        provider_id INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT fk_custom_customer FOREIGN KEY (customer_id) REFERENCES users(user_id) ON DELETE CASCADE,
        CONSTRAINT fk_custom_destination FOREIGN KEY (destination_id) REFERENCES destinations(destination_id),
        CONSTRAINT fk_custom_provider FOREIGN KEY (provider_id) REFERENCES users(user_id) ON DELETE SET NULL
    );
  `;

  await connection.query(createTablesSql);
  console.log('Tables created or verified.');

  const seedSqlPath = path.join(__dirname, '..', 'database', 'seed-demo-data.sql');
  const seedSql = fs.readFileSync(seedSqlPath, 'utf8');
  await connection.query(seedSql);
  console.log('Seed demo data applied.');

  const [users] = await connection.query('SELECT user_id, name, email, role, status FROM users');
  console.log('Total users:', users.length);
  const [custItin] = await connection.query('SELECT COUNT(*) as c FROM custom_itineraries');
  console.log('Custom itineraries count:', custItin[0].c);

  await connection.end();
}

init().catch(err => {
  console.error('Database initialization failed:', err);
  process.exit(1);
});

