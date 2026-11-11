/**
 * Local Tourism Package Booking System - HTTP Server
 * Built with pure Node.js (http, url, fs, path) - No Express
 * Roamly - Tourism Platform Server
 */

require('dotenv').config();
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool, testConnection } = require('./config/db');
const member3 = require('./member3_handlers');
const member1 = require('./member1_handlers');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC_DIR = path.resolve(__dirname, '..', 'public');

// MIME types dictionary
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon'
};

/**
 * Send JSON response
 */
function sendJSON(res, statusCode, data) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(payload);
}

/**
 * Send error response
 */
function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, {
    success: false,
    message: message || 'An unexpected error occurred.'
  });
}

/**
 * Read a JSON request body (used by auth POST routes)
 */
function readJSONBody(req, maxBytes = 1e6) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (Buffer.byteLength(raw) > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/**
 * Serve static files from public/
 */
function serveStaticFile(req, res, pathname) {
  let relativePath = pathname;
  if (relativePath === '/' || relativePath === '') {
    relativePath = '/index.html';
  } else if (!path.extname(relativePath)) {
    // If route has no extension, try corresponding .html file
    if (fs.existsSync(path.join(PUBLIC_DIR, `${relativePath}.html`))) {
      relativePath = `${relativePath}.html`;
    }
  }

  const safePath = path.normalize(relativePath).replace(/^(\.\.[\/\\])+/, '');
  const filePath = path.join(PUBLIC_DIR, safePath);

  // Security check: ensure file is inside PUBLIC_DIR
  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendError(res, 403, 'Forbidden');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // 404 Not Found
      res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>404 Not Found - Roamly</title>
          <style>
            body { font-family: sans-serif; background: #FAF7F2; color: #1D2520; text-align: center; padding: 4rem 1rem; }
            h1 { font-size: 2.5rem; color: #183B2B; margin-bottom: 1rem; }
            p { font-size: 1.1rem; color: #59655E; margin-bottom: 2rem; }
            a { display: inline-block; background: #183B2B; color: #fff; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 8px; font-weight: 600; }
          </style>
        </head>
        <body>
          <h1>404 - Page Not Found</h1>
          <p>The page you are looking for does not exist.</p>
          <a href="/">Back to Home</a>
        </body>
        </html>
      `);
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': stats.size,
      'Cache-Control': 'no-cache'
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
}

// ==========================================
// REST API Handlers
// ==========================================

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PUBLIC_ROLES = new Set(['CUSTOMER', 'PROVIDER']);

/**
 * POST /api/auth/register
 * Public customer / provider registration. Admin roles are rejected.
 */
async function handleRegister(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (err) {
    if (err.message === 'PAYLOAD_TOO_LARGE') {
      sendError(res, 413, 'Request body is too large.');
      return;
    }
    sendError(res, 400, 'Invalid JSON in request body.');
    return;
  }

  const name = String(body.name || body.fullName || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const phone = String(body.phone || body.mobile || '').trim().replace(/\s+/g, '');
  const password = String(body.password || '');
  const role = String(body.role || body.accountType || 'CUSTOMER').trim().toUpperCase();

  if (!name || name.length < 2) {
    sendError(res, 400, 'Full name is required.');
    return;
  }
  if (!EMAIL_PATTERN.test(email)) {
    sendError(res, 400, 'Enter a valid email address.');
    return;
  }
  if (!PHONE_PATTERN.test(phone)) {
    sendError(res, 400, 'Enter a valid 10-digit Indian mobile number.');
    return;
  }
  if (!PASSWORD_PATTERN.test(password)) {
    sendError(res, 400, 'Password must be at least 8 characters and include uppercase, lowercase, and a number.');
    return;
  }
  if (!PUBLIC_ROLES.has(role)) {
    sendError(res, 403, 'Admin and superadmin accounts cannot be created through public registration.');
    return;
  }

  const status = role === 'PROVIDER' ? 'PENDING' : 'ACTIVE';

  try {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, mobile, role, status)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [name, email, hashPassword(password), phone, role, status]
    );

    sendJSON(res, 201, {
      success: true,
      message: role === 'PROVIDER'
        ? 'Provider account created and is pending review. You can sign in after approval.'
        : 'Account created successfully. Redirecting to sign in…',
      data: {
        user_id: result.insertId,
        name,
        email,
        role,
        status
      }
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      sendError(res, 409, 'An account with this email already exists.');
      return;
    }
    console.error('Error registering user:', err.message);
    sendError(res, 500, 'Unable to create your account right now.');
  }
}


/**
 * GET /api/destinations
 * Returns active destinations with package counts & starting price
 */
async function handleGetDestinations(req, res) {
  try {
    const query = `
      SELECT 
        d.destination_id,
        d.name,
        d.city,
        d.state,
        d.country,
        d.description,
        d.status,
        COUNT(DISTINCT p.package_id) AS package_count,
        COALESCE(MIN(p.price), 0) AS starting_price,
        (
          SELECT p2.image 
          FROM tour_packages p2 
          WHERE p2.destination_id = d.destination_id 
            AND p2.status = 'APPROVED' 
            AND p2.image IS NOT NULL 
          ORDER BY p2.package_id ASC 
          LIMIT 1
        ) AS image
      FROM destinations d
      LEFT JOIN tour_packages p ON p.destination_id = d.destination_id AND p.status = 'APPROVED'
      WHERE d.status = 'ACTIVE'
      GROUP BY d.destination_id, d.name, d.city, d.state, d.country, d.description, d.status
      ORDER BY d.destination_id ASC
    `;

    const [rows] = await pool.query(query);
    sendJSON(res, 200, {
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching destinations:', err.message);
    sendError(res, 500, 'Unable to load destinations at this time.');
  }
}

/**
 * GET /api/destinations/:id
 * Retrieve a specific destination and its approved packages
 */
async function handleGetDestinationById(req, res, destinationId) {
  const id = parseInt(destinationId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid destination ID provided.');
    return;
  }

  try {
    const destQuery = `
      SELECT 
        d.destination_id,
        d.name,
        d.city,
        d.state,
        d.country,
        d.description,
        d.status,
        COUNT(DISTINCT p.package_id) AS package_count,
        COALESCE(MIN(p.price), 0) AS starting_price
      FROM destinations d
      LEFT JOIN tour_packages p ON p.destination_id = d.destination_id AND p.status = 'APPROVED'
      WHERE d.destination_id = ? AND d.status = 'ACTIVE'
      GROUP BY d.destination_id, d.name, d.city, d.state, d.country, d.description, d.status
    `;
    const [destRows] = await pool.query(destQuery, [id]);

    if (destRows.length === 0) {
      sendError(res, 404, 'Destination not found.');
      return;
    }

    const destination = destRows[0];

    // Fetch packages for this destination
    const pkgQuery = `
      SELECT 
        p.package_id,
        p.title,
        p.description,
        p.duration_days,
        p.price,
        p.capacity,
        p.image,
        c.category_id,
        c.category_name
      FROM tour_packages p
      JOIN categories c ON p.category_id = c.category_id
      WHERE p.destination_id = ? AND p.status = 'APPROVED'
      ORDER BY p.price ASC
    `;
    const [pkgRows] = await pool.query(pkgQuery, [id]);
    destination.packages = pkgRows;

    sendJSON(res, 200, {
      success: true,
      data: destination
    });
  } catch (err) {
    console.error('Error fetching destination by id:', err.message);
    sendError(res, 500, 'Unable to load destination details.');
  }
}

/**
 * GET /api/categories
 * Returns active categories with package count
 */
async function handleGetCategories(req, res) {
  try {
    const query = `
      SELECT 
        c.category_id,
        c.category_name,
        c.description,
        c.status,
        COUNT(DISTINCT p.package_id) AS package_count
      FROM categories c
      LEFT JOIN tour_packages p ON p.category_id = c.category_id AND p.status = 'APPROVED'
      WHERE c.status = 'ACTIVE'
      GROUP BY c.category_id, c.category_name, c.description, c.status
      ORDER BY c.category_id ASC
    `;

    const [rows] = await pool.query(query);
    sendJSON(res, 200, {
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching categories:', err.message);
    sendError(res, 500, 'Unable to load categories at this time.');
  }
}

/**
 * GET /api/packages
 * Filtered & sorted tour packages discovery
 * Query params:
 *   search / q
 *   destination (id or name)
 *   category (id or name)
 *   minPrice, maxPrice
 *   minDuration, maxDuration
 *   date (availability filter)
 *   sort (recommended, price_asc, price_desc, duration_asc, duration_desc)
 */
async function handleGetPackages(req, res, parsedUrl) {
  try {
    const queryParams = parsedUrl.query;
    const search = (queryParams.search || queryParams.q || '').trim();
    const destination = (queryParams.destination || '').trim();
    const category = (queryParams.category || '').trim();
    const minPrice = parseFloat(queryParams.minPrice);
    const maxPrice = parseFloat(queryParams.maxPrice);
    const minDuration = parseInt(queryParams.minDuration, 10);
    const maxDuration = parseInt(queryParams.maxDuration, 10);
    const availableDate = (queryParams.date || '').trim();
    const sort = (queryParams.sort || 'recommended').trim().toLowerCase();

    let sql = `
      SELECT 
        p.package_id,
        p.title,
        p.description,
        p.duration_days,
        p.price,
        p.capacity,
        p.image,
        p.status,
        p.created_at,
        d.destination_id,
        d.name AS destination_name,
        d.city,
        d.state,
        d.country,
        c.category_id,
        c.category_name,
        u.name AS provider_name,
        (
          SELECT MIN(pa.available_date)
          FROM package_availability pa
          WHERE pa.package_id = p.package_id 
            AND pa.seats_available > 0 
            AND pa.available_date >= CURDATE()
        ) AS next_available_date,
        (
          SELECT COALESCE(SUM(pa.seats_available), 0)
          FROM package_availability pa
          WHERE pa.package_id = p.package_id 
            AND pa.available_date >= CURDATE()
        ) AS total_seats_available
      FROM tour_packages p
      JOIN destinations d ON p.destination_id = d.destination_id
      JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN users u ON p.provider_id = u.user_id
      WHERE p.status = 'APPROVED' AND d.status = 'ACTIVE' AND c.status = 'ACTIVE'
    `;

    const params = [];

    // Keyword search across package title, description, and destination
    if (search) {
      sql += ` AND (
        p.title LIKE ? 
        OR p.description LIKE ? 
        OR d.name LIKE ? 
        OR d.city LIKE ? 
        OR d.state LIKE ?
        OR c.category_name LIKE ?
      )`;
      const wild = `%${search}%`;
      params.push(wild, wild, wild, wild, wild, wild);
    }

    // Destination filter (id or name)
    if (destination) {
      if (/^\d+$/.test(destination)) {
        sql += ` AND p.destination_id = ?`;
        params.push(parseInt(destination, 10));
      } else {
        sql += ` AND (d.name LIKE ? OR d.city LIKE ?)`;
        params.push(`%${destination}%`, `%${destination}%`);
      }
    }

    // Category filter (id or name)
    if (category) {
      if (/^\d+$/.test(category)) {
        sql += ` AND p.category_id = ?`;
        params.push(parseInt(category, 10));
      } else {
        sql += ` AND c.category_name LIKE ?`;
        params.push(`%${category}%`);
      }
    }

    // Price range
    if (!isNaN(minPrice) && minPrice >= 0) {
      sql += ` AND p.price >= ?`;
      params.push(minPrice);
    }
    if (!isNaN(maxPrice) && maxPrice > 0) {
      sql += ` AND p.price <= ?`;
      params.push(maxPrice);
    }

    // Duration range
    if (!isNaN(minDuration) && minDuration > 0) {
      sql += ` AND p.duration_days >= ?`;
      params.push(minDuration);
    }
    if (!isNaN(maxDuration) && maxDuration > 0) {
      sql += ` AND p.duration_days <= ?`;
      params.push(maxDuration);
    }

    // Date availability filter
    if (availableDate && /^\d{4}-\d{2}-\d{2}$/.test(availableDate)) {
      sql += ` AND EXISTS (
        SELECT 1 FROM package_availability pa 
        WHERE pa.package_id = p.package_id 
          AND pa.available_date = ? 
          AND pa.seats_available > 0
      )`;
      params.push(availableDate);
    }

    // Sorting
    switch (sort) {
      case 'price_asc':
        sql += ` ORDER BY p.price ASC, p.package_id ASC`;
        break;
      case 'price_desc':
        sql += ` ORDER BY p.price DESC, p.package_id ASC`;
        break;
      case 'duration_asc':
        sql += ` ORDER BY p.duration_days ASC, p.price ASC`;
        break;
      case 'duration_desc':
        sql += ` ORDER BY p.duration_days DESC, p.price ASC`;
        break;
      case 'recommended':
      default:
        sql += ` ORDER BY p.package_id ASC`;
        break;
    }

    const [rows] = await pool.query(sql, params);

    sendJSON(res, 200, {
      success: true,
      count: rows.length,
      data: rows
    });
  } catch (err) {
    console.error('Error fetching packages:', err.message);
    sendError(res, 500, 'Unable to load tour packages at this time.');
  }
}

/**
 * GET /api/packages/:id
 * Retrieve package details, full itinerary (ordered by day_no), and availability
 */
async function handleGetPackageById(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid tour package ID provided.');
    return;
  }

  try {
    const pkgQuery = `
      SELECT 
        p.package_id,
        p.title,
        p.description,
        p.duration_days,
        p.price,
        p.capacity,
        p.image,
        p.status,
        p.created_at,
        d.destination_id,
        d.name AS destination_name,
        d.city,
        d.state,
        d.country,
        d.description AS destination_description,
        c.category_id,
        c.category_name,
        c.description AS category_description,
        u.user_id AS provider_id,
        u.name AS provider_name,
        u.email AS provider_email,
        u.mobile AS provider_mobile
      FROM tour_packages p
      JOIN destinations d ON p.destination_id = d.destination_id
      JOIN categories c ON p.category_id = c.category_id
      LEFT JOIN users u ON p.provider_id = u.user_id
      WHERE p.package_id = ? AND p.status = 'APPROVED'
    `;

    const [pkgRows] = await pool.query(pkgQuery, [id]);
    if (pkgRows.length === 0) {
      sendError(res, 404, 'Tour package not found or inactive.');
      return;
    }

    const packageData = pkgRows[0];

    // Fetch itinerary in day order
    const itinQuery = `
      SELECT itinerary_id, day_no, title, description
      FROM package_itinerary
      WHERE package_id = ?
      ORDER BY day_no ASC
    `;
    const [itinRows] = await pool.query(itinQuery, [id]);
    packageData.itinerary = itinRows;

    // Fetch upcoming availability
    const availQuery = `
      SELECT availability_id, available_date, seats_available, status
      FROM package_availability
      WHERE package_id = ? AND available_date >= CURDATE()
      ORDER BY available_date ASC
    `;
    const [availRows] = await pool.query(availQuery, [id]);
    packageData.availability = availRows;

    sendJSON(res, 200, {
      success: true,
      data: packageData
    });
  } catch (err) {
    console.error('Error fetching package details by id:', err.message);
    sendError(res, 500, 'Unable to load tour package details.');
  }
}

// ==========================================
// Provider Portal & Package Admin
// ==========================================

/**
 * GET /api/providers
 * Returns list of registered tour providers with package counts
 */
async function handleGetProviders(req, res) {
  try {
    const query = `
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.mobile,
        u.status,
        u.created_at,
        COUNT(p.package_id) AS total_packages,
        SUM(CASE WHEN p.status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_packages,
        SUM(CASE WHEN p.status = 'PENDING' THEN 1 ELSE 0 END) AS pending_packages,
        SUM(CASE WHEN p.status IN ('REJECTED', 'INACTIVE') THEN 1 ELSE 0 END) AS other_packages
      FROM users u
      LEFT JOIN tour_packages p ON u.user_id = p.provider_id
      WHERE u.role = 'PROVIDER'
      GROUP BY u.user_id
      ORDER BY u.user_id ASC
    `;
    const [rows] = await pool.query(query);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching providers:', err.message);
    sendError(res, 500, 'Failed to fetch providers.');
  }
}

/**
 * GET /api/provider/dashboard
 * Query: ?provider_id=1
 */
async function handleGetProviderDashboard(req, res, parsedUrl) {
  const providerIdParam = parsedUrl.query.provider_id;
  let providerId = parseInt(providerIdParam, 10);

  try {
    // If no provider_id is specified or invalid, fetch the first active provider
    if (isNaN(providerId) || providerId <= 0) {
      const [firstProvider] = await pool.query(
        "SELECT user_id FROM users WHERE role = 'PROVIDER' ORDER BY user_id ASC LIMIT 1"
      );
      if (firstProvider.length === 0) {
        sendError(res, 404, 'No provider accounts found in the database.');
        return;
      }
      providerId = firstProvider[0].user_id;
    }

    // 1. Fetch provider user profile
    const [userRows] = await pool.query(
      "SELECT user_id, name, email, mobile, role, status, created_at FROM users WHERE user_id = ? AND role = 'PROVIDER'",
      [providerId]
    );
    if (userRows.length === 0) {
      sendError(res, 404, 'Tour provider not found.');
      return;
    }
    const provider = userRows[0];

    // 2. Fetch aggregated metrics for packages
    const statsQuery = `
      SELECT
        COUNT(*) AS total_packages,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_packages,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_packages,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_packages,
        SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive_packages
      FROM tour_packages
      WHERE provider_id = ?
    `;
    const [statsRows] = await pool.query(statsQuery, [providerId]);
    const stats = statsRows[0] || {};

    const totalPackages = Number(stats.total_packages) || 0;
    const approvedPackages = Number(stats.approved_packages) || 0;
    const pendingPackages = Number(stats.pending_packages) || 0;
    const rejectedPackages = Number(stats.rejected_packages) || 0;
    const inactivePackages = Number(stats.inactive_packages) || 0;
    const rejectedOrInactive = rejectedPackages + inactivePackages;

    // 3. Fetch bookings and revenue
    const bookingStatsQuery = `
      SELECT 
        COUNT(b.booking_id) AS total_bookings,
        COALESCE(SUM(b.total_amount), 0) AS total_revenue
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      WHERE p.provider_id = ?
    `;
    const [bookingStatsRows] = await pool.query(bookingStatsQuery, [providerId]);
    const bookingStats = bookingStatsRows[0] || { total_bookings: 0, total_revenue: 0 };

    // 4. Fetch provider's packages with details
    const packagesQuery = `
      SELECT 
        p.package_id,
        p.provider_id,
        p.destination_id,
        p.category_id,
        p.title,
        p.description,
        p.duration_days,
        p.price,
        p.capacity,
        p.image,
        p.status,
        p.created_at,
        d.name AS destination_name,
        d.city,
        d.state,
        c.category_name,
        (SELECT COUNT(*) FROM package_itinerary pi WHERE pi.package_id = p.package_id) AS itinerary_count,
        (SELECT COUNT(*) FROM package_availability pa WHERE pa.package_id = p.package_id AND pa.available_date >= CURDATE()) AS upcoming_availability_count,
        (SELECT COUNT(*) FROM bookings b WHERE b.package_id = p.package_id) AS booking_count
      FROM tour_packages p
      LEFT JOIN destinations d ON p.destination_id = d.destination_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.provider_id = ?
      ORDER BY p.created_at DESC, p.package_id DESC
    `;
    const [packages] = await pool.query(packagesQuery, [providerId]);

    sendJSON(res, 200, {
      success: true,
      data: {
        provider,
        stats: {
          total: totalPackages,
          approved: approvedPackages,
          pending: pendingPackages,
          rejected: rejectedPackages,
          inactive: inactivePackages,
          rejected_or_inactive: rejectedOrInactive,
          total_bookings: Number(bookingStats.total_bookings) || 0,
          total_revenue: Number(bookingStats.total_revenue) || 0
        },
        packages
      }
    });
  } catch (err) {
    console.error('Error fetching provider dashboard:', err.message);
    sendError(res, 500, 'Failed to fetch provider dashboard data.');
  }
}

/**
 * POST /api/provider/packages
 * Create new tour package (defaults to PENDING approval)
 */
async function handleCreateProviderPackage(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (err) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const providerId = parseInt(body.provider_id, 10);
  const destinationId = parseInt(body.destination_id, 10);
  const categoryId = parseInt(body.category_id, 10);
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();
  const durationDays = parseInt(body.duration_days, 10);
  const price = parseFloat(body.price);
  const capacity = parseInt(body.capacity, 10);
  const image = String(body.image || '').trim() || 'https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=1200&q=80';

  if (!providerId || isNaN(providerId)) {
    sendError(res, 400, 'Provider ID is required.');
    return;
  }
  if (!destinationId || isNaN(destinationId)) {
    sendError(res, 400, 'Destination is required.');
    return;
  }
  if (!categoryId || isNaN(categoryId)) {
    sendError(res, 400, 'Category is required.');
    return;
  }
  if (!title || title.length < 5) {
    sendError(res, 400, 'Package title must be at least 5 characters.');
    return;
  }
  if (isNaN(durationDays) || durationDays <= 0) {
    sendError(res, 400, 'Duration must be at least 1 day.');
    return;
  }
  if (isNaN(price) || price < 0) {
    sendError(res, 400, 'Price must be a valid positive number.');
    return;
  }
  if (isNaN(capacity) || capacity <= 0) {
    sendError(res, 400, 'Capacity must be at least 1 traveler.');
    return;
  }

  try {
    const insertQuery = `
      INSERT INTO tour_packages 
        (provider_id, destination_id, category_id, title, description, duration_days, price, capacity, image, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `;
    const [result] = await pool.query(insertQuery, [
      providerId, destinationId, categoryId, title, description, durationDays, price, capacity, image
    ]);
    const packageId = result.insertId;

    // Optional initial availability date
    if (body.initial_date && /^\d{4}-\d{2}-\d{2}$/.test(body.initial_date)) {
      await pool.query(
        "INSERT IGNORE INTO package_availability (package_id, available_date, seats_available, status) VALUES (?, ?, ?, 'AVAILABLE')",
        [packageId, body.initial_date, capacity]
      );
    }

    sendJSON(res, 201, {
      success: true,
      message: 'Package created successfully and submitted for administrator review.',
      data: {
        package_id: packageId,
        title,
        status: 'PENDING'
      }
    });
  } catch (err) {
    console.error('Error creating package:', err.message);
    sendError(res, 500, 'Failed to create tour package.');
  }
}

/**
 * PATCH /api/provider/packages/:id/status
 * Update package status (APPROVED, PENDING, INACTIVE, REJECTED)
 */
async function handleUpdatePackageStatus(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid package ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (err) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const validStatuses = ['APPROVED', 'PENDING', 'INACTIVE', 'REJECTED'];
  const newStatus = String(body.status || '').toUpperCase();
  if (!validStatuses.includes(newStatus)) {
    sendError(res, 400, 'Invalid status. Must be APPROVED, PENDING, INACTIVE, or REJECTED.');
    return;
  }

  try {
    const [result] = await pool.query(
      "UPDATE tour_packages SET status = ? WHERE package_id = ?",
      [newStatus, id]
    );
    if (result.affectedRows === 0) {
      sendError(res, 404, 'Package not found.');
      return;
    }
    sendJSON(res, 200, {
      success: true,
      message: `Package status updated to ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Error updating package status:', err.message);
    sendError(res, 500, 'Failed to update package status.');
  }
}

/**
 * GET /api/provider/packages/:id/availability
 * List availability dates for a package
 */
async function handleGetPackageAvailability(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid package ID.');
    return;
  }

  try {
    const [rows] = await pool.query(
      "SELECT availability_id, package_id, available_date, seats_available, status FROM package_availability WHERE package_id = ? ORDER BY available_date ASC",
      [id]
    );
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching package availability:', err.message);
    sendError(res, 500, 'Failed to fetch package availability.');
  }
}

/**
 * POST /api/provider/packages/:id/availability
 * Add or update availability date for a package
 */
async function handleAddPackageAvailability(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid package ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (err) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const availableDate = String(body.available_date || '').trim();
  const seatsAvailable = parseInt(body.seats_available, 10);
  const status = String(body.status || 'AVAILABLE').toUpperCase();

  if (!/^\d{4}-\d{2}-\d{2}$/.test(availableDate)) {
    sendError(res, 400, 'Valid date in YYYY-MM-DD format is required.');
    return;
  }
  if (isNaN(seatsAvailable) || seatsAvailable < 0) {
    sendError(res, 400, 'Seats available must be 0 or more.');
    return;
  }

  try {
    const query = `
      INSERT INTO package_availability (package_id, available_date, seats_available, status)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE seats_available = VALUES(seats_available), status = VALUES(status)
    `;
    const [result] = await pool.query(query, [id, availableDate, seatsAvailable, status]);
    sendJSON(res, 201, {
      success: true,
      message: 'Availability date saved successfully.',
      data: {
        availability_id: result.insertId || undefined,
        package_id: id,
        available_date: availableDate,
        seats_available: seatsAvailable,
        status
      }
    });
  } catch (err) {
    console.error('Error adding availability:', err.message);
    sendError(res, 500, 'Failed to save availability.');
  }
}

/**
 * DELETE /api/provider/availability/:id
 * Remove availability date
 */
async function handleDeletePackageAvailability(req, res, availabilityId) {
  const id = parseInt(availabilityId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid availability ID.');
    return;
  }

  try {
    const [result] = await pool.query(
      "DELETE FROM package_availability WHERE availability_id = ?",
      [id]
    );
    if (result.affectedRows === 0) {
      sendError(res, 404, 'Availability entry not found.');
      return;
    }
    sendJSON(res, 200, { success: true, message: 'Availability date removed successfully.' });
  } catch (err) {
    console.error('Error deleting availability:', err.message);
    sendError(res, 500, 'Failed to remove availability date.');
  }
}

// ==========================================
// ==========================================
// Booking Engine, Payments, Coupons & Reviews
// ==========================================

/**
 * GET /api/coupons
 * Returns active promotional coupons
 */
async function handleGetCoupons(req, res) {
  try {
    const query = `
      SELECT 
        coupon_id,
        code,
        description,
        discount_type,
        discount_value,
        min_booking_amount,
        max_discount,
        valid_until
      FROM coupons
      WHERE status = 'ACTIVE' 
        AND valid_until >= CURDATE()
        AND times_used < usage_limit
      ORDER BY discount_value DESC
    `;
    const [rows] = await pool.query(query);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching coupons:', err.message);
    sendError(res, 500, 'Unable to load available coupons.');
  }
}

/**
 * POST /api/coupons/validate
 * Validates a coupon code against subtotal amount
 */
async function handleValidateCoupon(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (err) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const code = String(body.code || '').trim().toUpperCase();
  const totalAmount = parseFloat(body.total_amount);

  if (!code) {
    sendError(res, 400, 'Please enter a coupon code.');
    return;
  }
  if (isNaN(totalAmount) || totalAmount <= 0) {
    sendError(res, 400, 'A valid booking amount is required for validation.');
    return;
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM coupons WHERE UPPER(code) = ? AND status = 'ACTIVE'",
      [code]
    );

    if (rows.length === 0) {
      sendError(res, 404, 'Coupon code "' + code + '" is invalid or expired.');
      return;
    }

    const coupon = rows[0];

    // Check validity date
    const todayStr = new Date().toISOString().split('T')[0];
    if (coupon.valid_until && coupon.valid_until < todayStr) {
      sendError(res, 400, 'This coupon has expired on ' + coupon.valid_until + '.');
      return;
    }

    // Check usage limit
    if (coupon.times_used >= coupon.usage_limit) {
      sendError(res, 400, 'This coupon has reached its maximum usage limit.');
      return;
    }

    // Check minimum booking threshold
    const minAmount = parseFloat(coupon.min_booking_amount) || 0;
    if (totalAmount < minAmount) {
      sendError(res, 400, 'This coupon requires a minimum booking amount of ₹' + Math.round(minAmount).toLocaleString('en-IN') + '.');
      return;
    }

    // Calculate discount
    let discountAmount = 0;
    const discountVal = parseFloat(coupon.discount_value);
    if (coupon.discount_type === 'PERCENT') {
      discountAmount = (totalAmount * discountVal) / 100;
      const maxDiscount = parseFloat(coupon.max_discount);
      if (!isNaN(maxDiscount) && maxDiscount > 0 && discountAmount > maxDiscount) {
        discountAmount = maxDiscount;
      }
    } else {
      // FLAT discount
      discountAmount = Math.min(discountVal, totalAmount);
    }

    discountAmount = Math.round(discountAmount * 100) / 100;
    const finalAmount = Math.max(0, Math.round((totalAmount - discountAmount) * 100) / 100);

    sendJSON(res, 200, {
      success: true,
      message: 'Coupon ' + coupon.code + ' applied successfully!',
      data: {
        coupon_id: coupon.coupon_id,
        code: coupon.code,
        description: coupon.description,
        discount_type: coupon.discount_type,
        discount_value: discountVal,
        discount_amount: discountAmount,
        final_amount: finalAmount
      }
    });
  } catch (err) {
    console.error('Error validating coupon:', err.message);
    sendError(res, 500, 'Error validating coupon.');
  }
}

/**
 * POST /api/bookings
 * Customer Reservation & Payment Transaction
 */
async function handleCreateBooking(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (err) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const customerId = parseInt(body.customer_id, 10) || 3; // Default to Aarav Sharma for demo if unauth
  const packageId = parseInt(body.package_id, 10);
  const availabilityId = parseInt(body.availability_id, 10);
  const travelers = parseInt(body.travelers, 10);
  const couponCode = String(body.coupon_code || '').trim().toUpperCase();
  const paymentMethod = String(body.payment_method || 'UPI').toUpperCase();

  const leadPassenger = body.lead_passenger || {};
  const fullName = String(leadPassenger.full_name || body.full_name || '').trim();
  const email = String(leadPassenger.email || body.email || '').trim().toLowerCase();
  const phone = String(leadPassenger.phone || body.phone || '').trim();
  const notes = String(leadPassenger.special_requests || body.special_requests || '').trim();

  // Basic Validations
  if (isNaN(packageId) || packageId <= 0) {
    sendError(res, 400, 'Valid Tour Package is required.');
    return;
  }
  if (isNaN(availabilityId) || availabilityId <= 0) {
    sendError(res, 400, 'Please select a scheduled departure date.');
    return;
  }
  if (isNaN(travelers) || travelers <= 0) {
    sendError(res, 400, 'Number of travelers must be at least 1.');
    return;
  }
  if (!fullName || fullName.length < 2) {
    sendError(res, 400, 'Lead passenger full name is required.');
    return;
  }
  if (!email || !EMAIL_PATTERN.test(email)) {
    sendError(res, 400, 'A valid contact email address is required.');
    return;
  }
  if (!phone || !PHONE_PATTERN.test(phone)) {
    sendError(res, 400, 'A valid 10-digit contact mobile number is required.');
    return;
  }

  try {
    // 1. Fetch Package details
    const [pkgRows] = await pool.query(
      "SELECT package_id, title, price, capacity, status, destination_id FROM tour_packages WHERE package_id = ?",
      [packageId]
    );
    if (pkgRows.length === 0 || pkgRows[0].status !== 'APPROVED') {
      sendError(res, 404, 'Tour package is not available for booking.');
      return;
    }
    const pkg = pkgRows[0];

    // 2. Fetch Availability and check seats
    const [availRows] = await pool.query(
      "SELECT availability_id, available_date, seats_available, status FROM package_availability WHERE availability_id = ? AND package_id = ?",
      [availabilityId, packageId]
    );
    if (availRows.length === 0 || availRows[0].status === 'CLOSED') {
      sendError(res, 404, 'The selected departure date is not available.');
      return;
    }
    const avail = availRows[0];

    if (avail.seats_available < travelers) {
      sendError(res, 400, 'Only ' + avail.seats_available + ' seat(s) remaining on ' + avail.available_date + '. Please reduce traveler count.');
      return;
    }

    // 3. Compute base amount
    const pricePerPerson = parseFloat(pkg.price);
    const baseAmount = pricePerPerson * travelers;

    // 4. Calculate coupon discount if provided
    let discountAmount = 0;
    let appliedCouponId = null;

    if (couponCode) {
      const [couponRows] = await pool.query(
        "SELECT * FROM coupons WHERE UPPER(code) = ? AND status = 'ACTIVE' AND valid_until >= CURDATE() AND times_used < usage_limit",
        [couponCode]
      );
      if (couponRows.length > 0) {
        const c = couponRows[0];
        const minReq = parseFloat(c.min_booking_amount) || 0;
        if (baseAmount >= minReq) {
          appliedCouponId = c.coupon_id;
          const discVal = parseFloat(c.discount_value);
          if (c.discount_type === 'PERCENT') {
            discountAmount = (baseAmount * discVal) / 100;
            const maxDisc = parseFloat(c.max_discount);
            if (!isNaN(maxDisc) && maxDisc > 0 && discountAmount > maxDisc) {
              discountAmount = maxDisc;
            }
          } else {
            discountAmount = Math.min(discVal, baseAmount);
          }
          discountAmount = Math.round(discountAmount * 100) / 100;
        }
      }
    }

    const finalAmount = Math.max(0, Math.round((baseAmount - discountAmount) * 100) / 100);

    // 5. Atomically decrement seats
    const [seatUpdate] = await pool.query(
      "UPDATE package_availability SET seats_available = seats_available - ? WHERE availability_id = ? AND seats_available >= ?",
      [travelers, availabilityId, travelers]
    );
    if (seatUpdate.affectedRows === 0) {
      sendError(res, 409, 'Seats on this departure were just reserved by another customer. Please try again.');
      return;
    }

    // Update status to FULL if seats reached 0
    await pool.query(
      "UPDATE package_availability SET status = 'FULL' WHERE availability_id = ? AND seats_available = 0",
      [availabilityId]
    );

    // 6. Insert into bookings table
    const [bookingResult] = await pool.query(
      `INSERT INTO bookings 
        (customer_id, package_id, availability_id, travelers, total_amount, booking_status, payment_status)
       VALUES (?, ?, ?, ?, ?, 'CONFIRMED', 'PAID')`,
      [customerId, packageId, availabilityId, travelers, finalAmount]
    );
    const bookingId = bookingResult.insertId;

    // 7. Insert payment record
    const [paymentResult] = await pool.query(
      `INSERT INTO payments 
        (booking_id, customer_id, amount, payment_method, payment_status, paid_at)
       VALUES (?, ?, ?, ?, 'SUCCESS', NOW())`,
      [bookingId, customerId, finalAmount, paymentMethod]
    );

    // 8. If coupon used, increment times_used
    if (appliedCouponId) {
      await pool.query(
        "UPDATE coupons SET times_used = times_used + 1 WHERE coupon_id = ?",
        [appliedCouponId]
      );
    }

    // 9. Audit system log
    try {
      await pool.query(
        "INSERT INTO system_logs (user_id, action, description) VALUES (?, 'BOOKING_CONFIRMED', ?)",
        [customerId, 'Booking #' + bookingId + ' confirmed for "' + pkg.title + '" (' + travelers + ' travelers, ₹' + finalAmount + ').']
      );
    } catch (logErr) {
      // non-fatal
    }

    const bookingReference = 'ROAM-' + String(bookingId).padStart(6, '0');

    sendJSON(res, 201, {
      success: true,
      message: 'Booking confirmed! Your holiday is reserved.',
      data: {
        booking_id: bookingId,
        booking_reference: bookingReference,
        package_id: packageId,
        package_title: pkg.title,
        travel_date: avail.available_date,
        travelers: travelers,
        price_per_person: pricePerPerson,
        base_amount: baseAmount,
        discount_amount: discountAmount,
        total_amount: finalAmount,
        payment_method: paymentMethod,
        lead_passenger: {
          full_name: fullName,
          email: email,
          phone: phone,
          notes: notes
        },
        booking_status: 'CONFIRMED',
        payment_status: 'PAID'
      }
    });
  } catch (err) {
    console.error('Error creating booking:', err.message);
    sendError(res, 500, 'Failed to complete package reservation.');
  }
}

/**
 * GET /api/customer/bookings
 * Returns booking history for customer
 */
async function handleGetCustomerBookings(req, res, parsedUrl) {
  const customerIdParam = parsedUrl.query.customer_id;
  let customerId = parseInt(customerIdParam, 10);
  if (isNaN(customerId) || customerId <= 0) {
    customerId = 3; // Default demo customer Aarav Sharma
  }

  try {
    const query = `
      SELECT 
        b.booking_id,
        b.customer_id,
        b.package_id,
        b.availability_id,
        b.travelers,
        b.total_amount,
        b.booking_status,
        b.payment_status,
        b.booked_at,
        p.title AS package_title,
        p.duration_days,
        p.price AS package_price,
        p.image AS package_image,
        d.name AS destination_name,
        d.city AS destination_city,
        d.state AS destination_state,
        c.category_name,
        pa.available_date,
        pay.payment_id,
        pay.payment_method,
        pay.paid_at,
        r.review_id,
        r.rating,
        r.comment AS review_comment,
        r.created_at AS review_date
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      JOIN destinations d ON p.destination_id = d.destination_id
      JOIN categories c ON p.category_id = c.category_id
      JOIN package_availability pa ON b.availability_id = pa.availability_id
      LEFT JOIN payments pay ON b.booking_id = pay.booking_id
      LEFT JOIN reviews r ON b.booking_id = r.booking_id
      WHERE b.customer_id = ?
      ORDER BY b.booked_at DESC, b.booking_id DESC
    `;

    const [rows] = await pool.query(query, [customerId]);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching customer bookings:', err.message);
    sendError(res, 500, 'Unable to load booking history.');
  }
}

/**
 * GET /api/bookings/:id
 * Retrieve details for a single booking confirmation
 */
async function handleGetBookingById(req, res, bookingId) {
  const id = parseInt(bookingId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid booking ID.');
    return;
  }

  try {
    const query = `
      SELECT 
        b.booking_id,
        b.customer_id,
        b.package_id,
        b.availability_id,
        b.travelers,
        b.total_amount,
        b.booking_status,
        b.payment_status,
        b.booked_at,
        p.title AS package_title,
        p.duration_days,
        p.price AS package_price,
        p.image AS package_image,
        d.name AS destination_name,
        d.city AS destination_city,
        d.state AS destination_state,
        c.category_name,
        pa.available_date,
        u.name AS provider_name,
        u.email AS provider_email,
        u.mobile AS provider_mobile,
        pay.payment_method,
        pay.paid_at
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      JOIN destinations d ON p.destination_id = d.destination_id
      JOIN categories c ON p.category_id = c.category_id
      JOIN package_availability pa ON b.availability_id = pa.availability_id
      LEFT JOIN users u ON p.provider_id = u.user_id
      LEFT JOIN payments pay ON b.booking_id = pay.booking_id
      WHERE b.booking_id = ?
    `;

    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      sendError(res, 404, 'Booking record not found.');
      return;
    }

    sendJSON(res, 200, { success: true, data: rows[0] });
  } catch (err) {
    console.error('Error loading booking by id:', err.message);
    sendError(res, 500, 'Failed to load booking details.');
  }
}

/**
 * POST /api/bookings/:id/cancel
 * Cancel an eligible booking & restock seats to package_availability
 */
async function handleCancelBooking(req, res, bookingId) {
  const id = parseInt(bookingId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid booking ID.');
    return;
  }

  try {
    const [rows] = await pool.query(
      "SELECT * FROM bookings WHERE booking_id = ?",
      [id]
    );
    if (rows.length === 0) {
      sendError(res, 404, 'Booking not found.');
      return;
    }

    const booking = rows[0];
    if (booking.booking_status === 'CANCELLED') {
      sendError(res, 400, 'This booking has already been cancelled.');
      return;
    }

    // 1. Restock seats in package_availability
    await pool.query(
      "UPDATE package_availability SET seats_available = seats_available + ?, status = 'AVAILABLE' WHERE availability_id = ?",
      [booking.travelers, booking.availability_id]
    );

    // 2. Update booking status
    await pool.query(
      "UPDATE bookings SET booking_status = 'CANCELLED', payment_status = 'REFUNDED' WHERE booking_id = ?",
      [id]
    );

    // 3. Update payment status
    await pool.query(
      "UPDATE payments SET payment_status = 'REFUNDED' WHERE booking_id = ?",
      [id]
    );

    // 4. Log to system_logs
    try {
      await pool.query(
        "INSERT INTO system_logs (user_id, action, description) VALUES (?, 'BOOKING_CANCELLED', ?)",
        [booking.customer_id, 'Booking #' + id + ' was cancelled. ' + booking.travelers + ' seat(s) restored.']
      );
    } catch (e) {
      // non-fatal
    }

    sendJSON(res, 200, {
      success: true,
      message: 'Booking #' + id + ' has been cancelled successfully. Your payment will be refunded.'
    });
  } catch (err) {
    console.error('Error cancelling booking:', err.message);
    sendError(res, 500, 'Failed to cancel booking.');
  }
}

/**
 * POST /api/reviews
 * Submit a customer review and star rating for a completed experience
 */
async function handleCreateReview(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (err) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const bookingId = parseInt(body.booking_id, 10);
  const rating = parseInt(body.rating, 10);
  const comment = String(body.comment || '').trim();

  if (isNaN(bookingId) || bookingId <= 0) {
    sendError(res, 400, 'Valid booking reference is required.');
    return;
  }
  if (isNaN(rating) || rating < 1 || rating > 5) {
    sendError(res, 400, 'Please select a rating between 1 and 5 stars.');
    return;
  }
  if (!comment || comment.length < 5) {
    sendError(res, 400, 'Please write a review of at least 5 characters.');
    return;
  }

  try {
    const [bRows] = await pool.query(
      "SELECT customer_id, package_id, booking_status FROM bookings WHERE booking_id = ?",
      [bookingId]
    );
    if (bRows.length === 0) {
      sendError(res, 404, 'Booking not found.');
      return;
    }
    const b = bRows[0];
    if (b.booking_status === 'CANCELLED') {
      sendError(res, 400, 'Cannot review a cancelled booking.');
      return;
    }

    const insertSql = `
      INSERT INTO reviews (booking_id, customer_id, package_id, rating, comment)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE rating = VALUES(rating), comment = VALUES(comment), created_at = NOW()
    `;
    const [result] = await pool.query(insertSql, [bookingId, b.customer_id, b.package_id, rating, comment]);

    sendJSON(res, 201, {
      success: true,
      message: 'Thank you for your review! It helps other travelers.',
      data: {
        review_id: result.insertId || undefined,
        booking_id: bookingId,
        rating: rating,
        comment: comment
      }
    });
  } catch (err) {
    console.error('Error creating review:', err.message);
    sendError(res, 500, 'Failed to submit review.');
  }
}

/**
 * GET /api/packages/:id/reviews
 * Return reviews and rating metrics for a package
 */
async function handleGetPackageReviews(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid tour package ID.');
    return;
  }

  try {
    const query = `
      SELECT 
        r.review_id,
        r.rating,
        r.comment,
        r.created_at,
        u.name AS customer_name
      FROM reviews r
      JOIN users u ON r.customer_id = u.user_id
      WHERE r.package_id = ?
      ORDER BY r.created_at DESC
    `;
    const [rows] = await pool.query(query, [id]);

    let avgRating = 0;
    if (rows.length > 0) {
      const sum = rows.reduce((acc, curr) => acc + curr.rating, 0);
      avgRating = Math.round((sum / rows.length) * 10) / 10;
    }

    sendJSON(res, 200, {
      success: true,
      data: {
        total_reviews: rows.length,
        average_rating: avgRating,
        reviews: rows
      }
    });
  } catch (err) {
    console.error('Error fetching package reviews:', err.message);
    sendError(res, 500, 'Failed to load package reviews.');
  }
}

// ==========================================
// Main HTTP Request Router
// ==========================================
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';

  // REST API Routes
  if (pathname.startsWith('/api/')) {
    // Auth routes
    // Coupons & Discounts
    if (pathname === '/api/coupons' && req.method === 'GET') {
      await handleGetCoupons(req, res);
      return;
    }
    if (pathname === '/api/coupons/validate' && req.method === 'POST') {
      await handleValidateCoupon(req, res);
      return;
    }

    // Bookings & Reservations
    if (pathname === '/api/bookings' && req.method === 'POST') {
      await handleCreateBooking(req, res);
      return;
    }
    if (pathname === '/api/customer/bookings' && req.method === 'GET') {
      await handleGetCustomerBookings(req, res, parsedUrl);
      return;
    }
    const bookingMatch = pathname.match(/^\/api\/bookings\/(\d+)$/);
    if (bookingMatch && req.method === 'GET') {
      await handleGetBookingById(req, res, bookingMatch[1]);
      return;
    }
    const bookingCancelMatch = pathname.match(/^\/api\/bookings\/(\d+)\/cancel$/);
    if (bookingCancelMatch && req.method === 'POST') {
      await handleCancelBooking(req, res, bookingCancelMatch[1]);
      return;
    }

    // Reviews & Ratings
    if (pathname === '/api/reviews' && req.method === 'POST') {
      await handleCreateReview(req, res);
      return;
    }
    const pkgReviewsMatch = pathname.match(/^\/api\/packages\/(\d+)\/reviews$/);
    if (pkgReviewsMatch && req.method === 'GET') {
      await handleGetPackageReviews(req, res, pkgReviewsMatch[1]);
      return;
    }

    if (pathname === '/api/auth/register' && req.method === 'POST') {
      await handleRegister(req, res);
      return;
    }
    // Authentication & sessions
    if (pathname === '/api/auth/login' && req.method === 'POST') {
      await member1.handleLogin(req, res);
      return;
    }
    if (pathname === '/api/auth/logout' && req.method === 'POST') {
      await member1.handleLogout(req, res);
      return;
    }
    if (pathname === '/api/auth/me' && req.method === 'GET') {
      await member1.handleGetMe(req, res);
      return;
    }

    // Customer profile & addresses
    if (pathname === '/api/customer/profile') {
      if (req.method === 'GET') { await member1.handleGetCustomerProfile(req, res); return; }
      if (req.method === 'PUT') { await member1.handleUpdateCustomerProfile(req, res); return; }
    }
    if (pathname === '/api/customer/addresses') {
      if (req.method === 'GET') { await member1.handleGetAddresses(req, res); return; }
      if (req.method === 'POST') { await member1.handleCreateAddress(req, res); return; }
    }
    const addressMatch = pathname.match(/^\/api\/customer\/addresses\/(\d+)$/);
    if (addressMatch) {
      if (req.method === 'PUT') { await member1.handleUpdateAddress(req, res, parseInt(addressMatch[1], 10)); return; }
      if (req.method === 'DELETE') { await member1.handleDeleteAddress(req, res, parseInt(addressMatch[1], 10)); return; }
    }

    // Smart Budget-Based Package Finder
    if (pathname === '/api/packages/budget-finder' && req.method === 'POST') {
      await member1.handleBudgetFinder(req, res);
      return;
    }

    // Provider Portal routes
    if (pathname === '/api/providers' && req.method === 'GET') {
      await handleGetProviders(req, res);
      return;
    }

    if (pathname === '/api/provider/dashboard' && req.method === 'GET') {
      await handleGetProviderDashboard(req, res, parsedUrl);
      return;
    }

    if (pathname === '/api/provider/packages') {
      if (req.method === 'GET') {
        await member3.handleGetProviderPackages(req, res, parsedUrl);
        return;
      }
      if (req.method === 'POST') {
        await handleCreateProviderPackage(req, res);
        return;
      }
    }

    const provPkgIdMatch = pathname.match(/^\/api\/provider\/packages\/(\d+)$/);
    if (provPkgIdMatch) {
      if (req.method === 'PUT') {
        await member3.handleUpdateProviderPackage(req, res, provPkgIdMatch[1]);
        return;
      }
      if (req.method === 'DELETE') {
        await member3.handleDeleteProviderPackage(req, res, provPkgIdMatch[1], parsedUrl);
        return;
      }
    }

    const provStatusMatch = pathname.match(/^\/api\/provider\/packages\/(\d+)\/status$/);
    if (provStatusMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
      await handleUpdatePackageStatus(req, res, provStatusMatch[1]);
      return;
    }

    const provItinMatch = pathname.match(/^\/api\/provider\/packages\/(\d+)\/itinerary$/);
    if (provItinMatch) {
      if (req.method === 'GET') {
        await member3.handleGetPackageItinerary(req, res, provItinMatch[1]);
        return;
      }
      if (req.method === 'POST') {
        await member3.handleAddPackageItineraryDay(req, res, provItinMatch[1]);
        return;
      }
    }

    const provItinDelMatch = pathname.match(/^\/api\/provider\/itinerary\/(\d+)$/);
    if (provItinDelMatch && req.method === 'DELETE') {
      await member3.handleDeleteItineraryItem(req, res, provItinDelMatch[1]);
      return;
    }

    const provAvailMatch = pathname.match(/^\/api\/provider\/packages\/(\d+)\/availability$/);
    if (provAvailMatch) {
      if (req.method === 'GET') {
        await handleGetPackageAvailability(req, res, provAvailMatch[1]);
        return;
      }
      if (req.method === 'POST') {
        await handleAddPackageAvailability(req, res, provAvailMatch[1]);
        return;
      }
    }

    const provAvailDelMatch = pathname.match(/^\/api\/provider\/availability\/(\d+)$/);
    if (provAvailDelMatch && req.method === 'DELETE') {
      await handleDeletePackageAvailability(req, res, provAvailDelMatch[1]);
      return;
    }

    if (pathname === '/api/provider/bookings' && req.method === 'GET') {
      await member3.handleGetProviderBookings(req, res, parsedUrl);
      return;
    }

    const provBookingStatusMatch = pathname.match(/^\/api\/provider\/bookings\/(\d+)\/status$/);
    if (provBookingStatusMatch && req.method === 'PATCH') {
      await member3.handleUpdateProviderBookingStatus(req, res, provBookingStatusMatch[1]);
      return;
    }

    if (pathname === '/api/provider/reports' && req.method === 'GET') {
      await member3.handleGetProviderReports(req, res, parsedUrl);
      return;
    }

    if (pathname === '/api/provider/custom-requests' && req.method === 'GET') {
      await member3.handleGetProviderCustomRequests(req, res, parsedUrl);
      return;
    }

    const provCustReqMatch = pathname.match(/^\/api\/provider\/custom-requests\/(\d+)\/status$/);
    if (provCustReqMatch && req.method === 'PATCH') {
      await member3.handleUpdateCustomRequestStatus(req, res, provCustReqMatch[1]);
      return;
    }

    // Admin Portal routes
    if (pathname === '/api/admin/dashboard' && req.method === 'GET') {
      await member3.handleGetAdminDashboard(req, res);
      return;
    }

    if (pathname === '/api/admin/packages' && req.method === 'GET') {
      await member3.handleGetAdminPackages(req, res, parsedUrl);
      return;
    }

    const adminPkgStatusMatch = pathname.match(/^\/api\/admin\/packages\/(\d+)\/status$/);
    if (adminPkgStatusMatch && req.method === 'PATCH') {
      await member3.handleAdminModeratePackage(req, res, adminPkgStatusMatch[1]);
      return;
    }

    if (pathname === '/api/admin/destinations') {
      if (req.method === 'GET') {
        await member3.handleAdminGetDestinations(req, res);
        return;
      }
      if (req.method === 'POST') {
        await member3.handleAdminCreateDestination(req, res);
        return;
      }
    }

    const adminDestMatch = pathname.match(/^\/api\/admin\/destinations\/(\d+)$/);
    if (adminDestMatch) {
      if (req.method === 'PUT') {
        await member3.handleAdminUpdateDestination(req, res, adminDestMatch[1]);
        return;
      }
      if (req.method === 'DELETE') {
        await member3.handleAdminDeleteDestination(req, res, adminDestMatch[1], parsedUrl);
        return;
      }
    }

    if (pathname === '/api/admin/categories') {
      if (req.method === 'GET') {
        await member3.handleAdminGetCategories(req, res);
        return;
      }
      if (req.method === 'POST') {
        await member3.handleAdminCreateCategory(req, res);
        return;
      }
    }

    const adminCatMatch = pathname.match(/^\/api\/admin\/categories\/(\d+)$/);
    if (adminCatMatch) {
      if (req.method === 'PUT') {
        await member3.handleAdminUpdateCategory(req, res, adminCatMatch[1]);
        return;
      }
      if (req.method === 'DELETE') {
        await member3.handleAdminDeleteCategory(req, res, adminCatMatch[1], parsedUrl);
        return;
      }
    }

    if (pathname === '/api/admin/users' && req.method === 'GET') {
      await member3.handleAdminGetUsers(req, res, parsedUrl);
      return;
    }

    const adminUserStatusMatch = pathname.match(/^\/api\/admin\/users\/(\d+)\/status$/);
    if (adminUserStatusMatch && req.method === 'PATCH') {
      await member3.handleAdminUpdateUserStatus(req, res, adminUserStatusMatch[1]);
      return;
    }

    if (pathname === '/api/admin/reports' && req.method === 'GET') {
      await member3.handleGetAdminReports(req, res);
      return;
    }

    // Super Admin Portal routes
    if (pathname === '/api/superadmin/admins') {
      if (req.method === 'GET') {
        await member3.handleGetSuperAdminAdmins(req, res);
        return;
      }
      if (req.method === 'POST') {
        await member3.handleCreateAdmin(req, res);
        return;
      }
    }

    const superAdminPermMatch = pathname.match(/^\/api\/superadmin\/admins\/(\d+)\/permissions$/);
    if (superAdminPermMatch && req.method === 'PATCH') {
      await member3.handleUpdateAdminPermissions(req, res, superAdminPermMatch[1]);
      return;
    }

    const superAdminStatusMatch = pathname.match(/^\/api\/superadmin\/admins\/(\d+)\/status$/);
    if (superAdminStatusMatch && req.method === 'PATCH') {
      await member3.handleUpdateAdminStatus(req, res, superAdminStatusMatch[1]);
      return;
    }

    if (pathname === '/api/superadmin/logs' && req.method === 'GET') {
      await member3.handleGetSystemLogs(req, res, parsedUrl);
      return;
    }

    // Customer Itinerary Planner routes
    if (pathname === '/api/customer/itineraries') {
      if (req.method === 'GET') {
        await member3.handleGetCustomerItineraries(req, res, parsedUrl);
        return;
      }
      if (req.method === 'POST') {
        await member3.handleCreateCustomItinerary(req, res);
        return;
      }
    }

    const custItinMatch = pathname.match(/^\/api\/customer\/itineraries\/(\d+)$/);
    if (custItinMatch) {
      if (req.method === 'GET') {
        await member3.handleGetCustomItineraryById(req, res, custItinMatch[1]);
        return;
      }
      if (req.method === 'DELETE') {
        await member3.handleDeleteCustomItinerary(req, res, custItinMatch[1]);
        return;
      }
    }

    const custItinSubmitMatch = pathname.match(/^\/api\/customer\/itineraries\/(\d+)\/submit$/);
    if (custItinSubmitMatch && req.method === 'POST') {
      await member3.handleSubmitCustomItinerary(req, res, custItinSubmitMatch[1]);
      return;
    }

    // Destinations routes
    if (pathname === '/api/destinations' && req.method === 'GET') {
      await handleGetDestinations(req, res);
      return;
    }
    const destMatch = pathname.match(/^\/api\/destinations\/(\d+)$/);
    if (destMatch && req.method === 'GET') {
      await handleGetDestinationById(req, res, destMatch[1]);
      return;
    }

    // Categories routes
    if (pathname === '/api/categories' && req.method === 'GET') {
      await handleGetCategories(req, res);
      return;
    }

    // Packages routes
    if (pathname === '/api/packages' && req.method === 'GET') {
      await handleGetPackages(req, res, parsedUrl);
      return;
    }
    const pkgMatch = pathname.match(/^\/api\/packages\/(\d+)$/);
    if (pkgMatch && req.method === 'GET') {
      await handleGetPackageById(req, res, pkgMatch[1]);
      return;
    }

    // Unknown API endpoint
    sendError(res, 404, 'API endpoint not found.');
    return;
  }

  // Serve static files
  serveStaticFile(req, res, pathname);
});

// Start Server after checking DB
(async () => {
  console.log('Testing MySQL connection...');
  const dbStatus = await testConnection();
  if (!dbStatus.ok) {
    console.error('WARNING: Database connection failed on startup:', dbStatus.error);
    console.error('Verify your .env configuration.');
  } else {
    console.log('Database connected successfully to MySQL.');
    try {
      const [tables] = await pool.query("SHOW TABLES LIKE 'users'");
      if (tables.length === 0) {
        console.log('Database tables missing. Bootstrapping schema and demo seed data...');
        const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
        const seedPath = path.join(__dirname, '..', 'database', 'seed-demo-data.sql');
        if (fs.existsSync(schemaPath)) {
          const schemaSql = fs.readFileSync(schemaPath, 'utf8');
          await pool.query(schemaSql);
          console.log('Schema applied successfully.');
        }
        if (fs.existsSync(seedPath)) {
          const seedSql = fs.readFileSync(seedPath, 'utf8');
          await pool.query(seedSql);
          console.log('Demo seed data applied successfully.');
        }
      }
    } catch (bootErr) {
      console.warn('Database bootstrap notice:', bootErr.message);
    }
    try {
      await member1.ensureMember1Schema();
    } catch (err) {
      console.error('WARNING: Schema migration failed:', err.message);
    }
  }

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Roamly - Local Tourism Package Booking System Server `);
    console.log(` Running on: http://localhost:${PORT}`);
    console.log(` Roamly Tourism Platform — Ready`);
    console.log(`=======================================================`);
  });
})();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\nShutting down server gracefully...');
  server.close(async () => {
    try {
      await pool.end();
      console.log('Database pool closed.');
    } catch (e) {
      // ignore
    }
    process.exit(0);
  });
});
