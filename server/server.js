/**
 * Local Tourism Package Booking System - HTTP Server
 * Built with pure Node.js (http, url, fs, path) - No Express
 * Member 2: Destinations & Tour Package Discovery Module
 */

require('dotenv').config();
const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { pool, testConnection } = require('./config/db');

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
// Member 3: Provider Portal & Package Admin
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
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      await handleRegister(req, res);
      return;
    }

    // Provider Portal routes (Member 3)
    if (pathname === '/api/providers' && req.method === 'GET') {
      await handleGetProviders(req, res);
      return;
    }

    if (pathname === '/api/provider/dashboard' && req.method === 'GET') {
      await handleGetProviderDashboard(req, res, parsedUrl);
      return;
    }

    if (pathname === '/api/provider/packages' && req.method === 'POST') {
      await handleCreateProviderPackage(req, res);
      return;
    }

    const provStatusMatch = pathname.match(/^\/api\/provider\/packages\/(\d+)\/status$/);
    if (provStatusMatch && (req.method === 'PATCH' || req.method === 'PUT')) {
      await handleUpdatePackageStatus(req, res, provStatusMatch[1]);
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
  }

  server.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(` Roamly - Local Tourism Package Booking System Server `);
    console.log(` Running on: http://localhost:${PORT}`);
    console.log(` Member 2: Destinations & Tour Package Discovery`);
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
