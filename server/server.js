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
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
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
// Main HTTP Request Router
// ==========================================
const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname || '/';

  // REST API Routes
  if (pathname.startsWith('/api/')) {
    if (pathname === '/api/auth/register' && req.method === 'POST') {
      await handleRegister(req, res);
      return;
    }

    if (req.method !== 'GET') {
      sendError(res, 405, 'Method Not Allowed');
      return;
    }

    // Destinations routes
    if (pathname === '/api/destinations') {
      await handleGetDestinations(req, res);
      return;
    }
    const destMatch = pathname.match(/^\/api\/destinations\/(\d+)$/);
    if (destMatch) {
      await handleGetDestinationById(req, res, destMatch[1]);
      return;
    }

    // Categories routes
    if (pathname === '/api/categories') {
      await handleGetCategories(req, res);
      return;
    }

    // Packages routes
    if (pathname === '/api/packages') {
      await handleGetPackages(req, res, parsedUrl);
      return;
    }
    const pkgMatch = pathname.match(/^\/api\/packages\/(\d+)$/);
    if (pkgMatch) {
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
