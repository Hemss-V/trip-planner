/**
 * Member 1: Authentication, Customer Profile & Smart Budget Finder
 *
 * - Unified login for all 4 roles with a signed, HttpOnly session cookie
 *   (the same token is also returned so clients may send it as a Bearer token).
 * - Customer profile + address management (tables: users, addresses).
 * - POST /api/packages/budget-finder: budget-tiered package discovery.
 */

const crypto = require('crypto');
const { pool } = require('./config/db');

// ==========================================
// Shared helpers
// ==========================================

function sendJSON(res, statusCode, data, extraHeaders = {}) {
  const payload = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    'Cache-Control': 'no-store',
    ...extraHeaders
  });
  res.end(payload);
}

function sendError(res, statusCode, message, extraHeaders = {}) {
  sendJSON(res, statusCode, { success: false, message }, extraHeaders);
}

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
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

async function readBodyOrFail(req, res) {
  try {
    return await readJSONBody(req);
  } catch (err) {
    if (err.message === 'PAYLOAD_TOO_LARGE') sendError(res, 413, 'Request body is too large.');
    else sendError(res, 400, 'Invalid JSON in request body.');
    return null;
  }
}

async function logAction(userId, action, description, req) {
  try {
    await pool.query(
      'INSERT INTO system_logs (user_id, action, description, ip_address) VALUES (?, ?, ?, ?)',
      [userId || null, action, description, (req && req.socket && req.socket.remoteAddress) || null]
    );
  } catch (err) {
    console.error('Failed to write system log:', err.message);
  }
}

// ==========================================
// Passwords (scrypt)
// ==========================================

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
const PHONE_PATTERN = /^(?:\+91[\s-]?)?[6-9]\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Seeded demo accounts use a non-functional "$2b$10$demo..." placeholder hash.
// Only this documented demo password unlocks them; on first login the
// placeholder is upgraded to a real scrypt hash.
const DEMO_PASSWORD = 'demoPassword123';
const DEMO_HASH_PREFIX = '$2b$10$demoHashedPassword';

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt:${salt}:${hash}`;
}

/** Returns 'ok', 'ok-upgrade' (valid but stored hash should be replaced) or 'fail'. */
function checkPassword(input, stored) {
  if (!input || !stored) return 'fail';

  if (stored.startsWith('scrypt:')) {
    const [, salt, expectedHex] = stored.split(':');
    if (!salt || !expectedHex) return 'fail';
    const expected = Buffer.from(expectedHex, 'hex');
    const actual = crypto.scryptSync(input, salt, expected.length || 64);
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected) ? 'ok' : 'fail';
  }

  if (stored.startsWith(DEMO_HASH_PREFIX)) {
    return input === DEMO_PASSWORD ? 'ok-upgrade' : 'fail';
  }

  return 'fail';
}

// ==========================================
// Sessions: HMAC-signed stateless tokens
// ==========================================

const SESSION_COOKIE = 'roamly_session';
const SESSION_TTL_SHORT = 12 * 60 * 60;       // 12 hours
const SESSION_TTL_REMEMBER = 7 * 24 * 60 * 60; // 7 days

let SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET) {
  SESSION_SECRET = crypto.randomBytes(32).toString('hex');
  console.warn('SESSION_SECRET is not set in .env; using a random secret (all sessions reset on restart).');
}

// Tokens revoked by logout, kept until they would have expired anyway.
const revokedTokens = new Map();

function sign(data) {
  return crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
}

function createSessionToken(user, ttlSeconds) {
  const payload = {
    uid: user.user_id,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
    jti: crypto.randomBytes(8).toString('hex')
  };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { token: `${body}.${sign(body)}`, expiresAt: payload.exp };
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string') return null;
  const [body, signature] = token.split('.');
  if (!body || !signature) return null;

  const expected = Buffer.from(sign(body));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !crypto.timingSafeEqual(expected, given)) return null;

  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (!payload || !payload.uid || !payload.exp || payload.exp < now) return null;
  if (revokedTokens.has(token)) return null;
  return payload;
}

function pruneRevokedTokens() {
  const now = Math.floor(Date.now() / 1000);
  for (const [token, exp] of revokedTokens) {
    if (exp < now) revokedTokens.delete(token);
  }
}

function parseCookies(req) {
  const header = req.headers.cookie || '';
  const cookies = {};
  header.split(';').forEach((part) => {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const value = part.slice(idx + 1).trim();
      try {
        cookies[key] = decodeURIComponent(value);
      } catch (e) {
        cookies[key] = value;
      }
    }
  });
  return cookies;
}

function getRequestToken(req) {
  const auth = req.headers.authorization || '';
  if (auth.startsWith('Bearer ')) return auth.slice(7).trim();
  return parseCookies(req)[SESSION_COOKIE] || null;
}

function sessionCookie(token, maxAgeSeconds) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(token)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax'];
  if (maxAgeSeconds !== null) parts.push(`Max-Age=${maxAgeSeconds}`);
  return parts.join('; ');
}

function clearSessionCookie() {
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

const DASHBOARD_PATHS = {
  CUSTOMER: '/customer/customer-dashboard.html',
  PROVIDER: '/provider/dashboard.html',
  ADMIN: '/admin/dashboard.html',
  SUPER_ADMIN: '/superadmin/dashboard.html'
};

async function loadPermissions(user) {
  if (user.role === 'SUPER_ADMIN') {
    return ['ALL', 'MODERATE_PACKAGES', 'MANAGE_DESTINATIONS', 'MANAGE_CATEGORIES', 'MANAGE_USERS', 'VIEW_REPORTS', 'MANAGE_ADMINS', 'VIEW_LOGS'];
  }
  if (user.role !== 'ADMIN') return [];
  const [rows] = await pool.query('SELECT permission_name FROM admin_permissions WHERE admin_id = ?', [user.user_id]);
  return rows.map((r) => r.permission_name);
}

function publicUser(user, permissions = []) {
  return {
    user_id: user.user_id,
    name: user.name,
    email: user.email,
    mobile: user.mobile,
    role: user.role,
    status: user.status,
    created_at: user.created_at,
    permissions,
    dashboard: DASHBOARD_PATHS[user.role] || '/'
  };
}

/**
 * Resolve the logged-in user for a request (or null).
 * Re-reads the user so blocked/deactivated accounts lose access immediately.
 */
async function getSessionUser(req) {
  const token = getRequestToken(req);
  const payload = verifySessionToken(token);
  if (!payload) return null;
  const [rows] = await pool.query(
    'SELECT user_id, name, email, mobile, role, status, created_at FROM users WHERE user_id = ?',
    [payload.uid]
  );
  const user = rows[0];
  if (!user || user.status !== 'ACTIVE') return null;
  return { ...user, _token: token, _exp: payload.exp };
}

/** Sends 401/403 and returns null when the request is not allowed. */
async function requireUser(req, res, roles) {
  let user;
  try {
    user = await getSessionUser(req);
  } catch (err) {
    console.error('Session lookup failed:', err.message);
    sendError(res, 500, 'Unable to verify your session.');
    return null;
  }
  if (!user) {
    sendError(res, 401, 'Please sign in to continue.');
    return null;
  }
  if (roles && !roles.includes(user.role)) {
    sendError(res, 403, 'Your account does not have access to this resource.');
    return null;
  }
  return user;
}

// ==========================================
// POST /api/auth/login
// ==========================================

const ROLE_LABELS = {
  CUSTOMER: 'Customer',
  PROVIDER: 'Tour Provider',
  ADMIN: 'Administrator',
  SUPER_ADMIN: 'Super Administrator'
};

async function handleLogin(req, res) {
  const body = await readBodyOrFail(req, res);
  if (!body) return;

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const expectedRole = String(body.role || '').trim().toUpperCase();
  const remember = Boolean(body.remember);

  if (!EMAIL_PATTERN.test(email)) return sendError(res, 400, 'Enter a valid email address.');
  if (!password) return sendError(res, 400, 'Password is required.');

  try {
    const [rows] = await pool.query(
      'SELECT user_id, name, email, password, mobile, role, status, created_at FROM users WHERE email = ?',
      [email]
    );
    const user = rows[0];
    const result = user ? checkPassword(password, user.password) : 'fail';

    // Same message for unknown email and wrong password (no account enumeration).
    if (result === 'fail') {
      return sendError(res, 401, 'Incorrect email or password.');
    }

    if (user.status === 'BLOCKED') return sendError(res, 403, 'Your account has been blocked by administrators.');
    if (user.status === 'PENDING') return sendError(res, 403, 'Your provider account is pending administrator review.');
    if (user.status === 'INACTIVE') return sendError(res, 403, 'Your account is inactive. Please contact support.');

    if (expectedRole && expectedRole !== 'AUTO' && expectedRole !== user.role) {
      return sendError(res, 403,
        `This account is registered as a ${ROLE_LABELS[user.role] || user.role}. ` +
        `Choose "${ROLE_LABELS[user.role] || user.role}" or "Auto-detect" and try again.`);
    }

    if (result === 'ok-upgrade') {
      await pool.query('UPDATE users SET password = ? WHERE user_id = ?', [hashPassword(password), user.user_id]);
    }

    const ttl = remember ? SESSION_TTL_REMEMBER : SESSION_TTL_SHORT;
    const { token, expiresAt } = createSessionToken(user, ttl);
    const permissions = await loadPermissions(user);

    await logAction(user.user_id, 'USER_LOGIN', `${user.role} ${user.name} signed in`, req);

    sendJSON(res, 200, {
      success: true,
      message: 'Login successful.',
      data: {
        ...publicUser(user, permissions),
        token,
        expires_at: new Date(expiresAt * 1000).toISOString()
      }
    }, {
      // Without "remember me" the cookie lives for the browser session only.
      'Set-Cookie': sessionCookie(token, remember ? ttl : null)
    });
  } catch (err) {
    console.error('Error during login:', err.message);
    sendError(res, 500, 'Server error during sign in.');
  }
}

// ==========================================
// POST /api/auth/logout
// ==========================================

async function handleLogout(req, res) {
  const token = getRequestToken(req);
  const payload = verifySessionToken(token);
  if (payload) {
    revokedTokens.set(token, payload.exp);
    pruneRevokedTokens();
    await logAction(payload.uid, 'USER_LOGOUT', 'User signed out', req);
  }
  sendJSON(res, 200, { success: true, message: 'Signed out.' }, { 'Set-Cookie': clearSessionCookie() });
}

// ==========================================
// GET /api/auth/me
// ==========================================

async function handleGetMe(req, res) {
  const user = await requireUser(req, res);
  if (!user) return;
  try {
    const permissions = await loadPermissions(user);
    sendJSON(res, 200, {
      success: true,
      data: { ...publicUser(user, permissions), expires_at: new Date(user._exp * 1000).toISOString() }
    });
  } catch (err) {
    console.error('Error loading session user:', err.message);
    sendError(res, 500, 'Unable to load your account.');
  }
}

// ==========================================
// Customer profile
// ==========================================

async function handleGetCustomerProfile(req, res) {
  const user = await requireUser(req, res, ['CUSTOMER']);
  if (!user) return;
  try {
    const [[stats]] = await pool.query(
      `SELECT
         COUNT(*) AS total_bookings,
         COALESCE(SUM(booking_status IN ('PENDING','CONFIRMED')), 0) AS active_bookings,
         COALESCE(SUM(CASE WHEN booking_status <> 'CANCELLED' THEN total_amount ELSE 0 END), 0) AS total_spent
       FROM bookings WHERE customer_id = ?`,
      [user.user_id]
    );
    const [[addr]] = await pool.query('SELECT COUNT(*) AS c FROM addresses WHERE user_id = ?', [user.user_id]);
    sendJSON(res, 200, {
      success: true,
      data: {
        ...publicUser(user),
        stats: {
          total_bookings: Number(stats.total_bookings) || 0,
          active_bookings: Number(stats.active_bookings) || 0,
          total_spent: Number(stats.total_spent) || 0,
          addresses: Number(addr.c) || 0
        }
      }
    });
  } catch (err) {
    console.error('Error loading profile:', err.message);
    sendError(res, 500, 'Unable to load your profile.');
  }
}

async function handleUpdateCustomerProfile(req, res) {
  const user = await requireUser(req, res, ['CUSTOMER']);
  if (!user) return;
  const body = await readBodyOrFail(req, res);
  if (!body) return;

  const updates = [];
  const params = [];

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (name.length < 2 || name.length > 100) return sendError(res, 400, 'Name must be between 2 and 100 characters.');
    updates.push('name = ?');
    params.push(name);
  }

  if (body.mobile !== undefined || body.phone !== undefined) {
    const mobile = String(body.mobile !== undefined ? body.mobile : body.phone).trim().replace(/\s+/g, '');
    if (!PHONE_PATTERN.test(mobile)) return sendError(res, 400, 'Enter a valid 10-digit Indian mobile number.');
    updates.push('mobile = ?');
    params.push(mobile);
  }

  const newPassword = body.new_password ? String(body.new_password) : '';
  if (newPassword) {
    const currentPassword = String(body.current_password || '');
    if (!PASSWORD_PATTERN.test(newPassword)) {
      return sendError(res, 400, 'New password must be at least 8 characters and include uppercase, lowercase, and a number.');
    }
    const [[row]] = await pool.query('SELECT password FROM users WHERE user_id = ?', [user.user_id]);
    if (checkPassword(currentPassword, row && row.password) === 'fail') {
      return sendError(res, 401, 'Your current password is incorrect.');
    }
    if (currentPassword === newPassword) {
      return sendError(res, 400, 'New password must be different from your current password.');
    }
    updates.push('password = ?');
    params.push(hashPassword(newPassword));
  }

  if (updates.length === 0) return sendError(res, 400, 'Nothing to update.');

  try {
    params.push(user.user_id);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE user_id = ?`, params);
    await logAction(user.user_id, 'PROFILE_UPDATED',
      newPassword ? 'Customer updated profile and changed password' : 'Customer updated profile', req);

    const [[fresh]] = await pool.query(
      'SELECT user_id, name, email, mobile, role, status, created_at FROM users WHERE user_id = ?',
      [user.user_id]
    );
    sendJSON(res, 200, {
      success: true,
      message: newPassword ? 'Profile and password updated.' : 'Profile updated.',
      data: publicUser(fresh)
    });
  } catch (err) {
    console.error('Error updating profile:', err.message);
    sendError(res, 500, 'Unable to update your profile.');
  }
}

// ==========================================
// Customer addresses
// ==========================================

const ADDRESS_TYPES = ['HOME', 'BILLING', 'DELIVERY', 'OTHER'];
const PINCODE_PATTERN = /^[1-9]\d{5}$/;

function validateAddress(body) {
  const address = {
    address_type: String(body.address_type || 'HOME').trim().toUpperCase(),
    address_line: String(body.address_line || '').trim(),
    city: String(body.city || '').trim(),
    state: String(body.state || '').trim(),
    pincode: String(body.pincode || '').trim(),
    is_default: body.is_default ? 1 : 0
  };
  if (!ADDRESS_TYPES.includes(address.address_type)) return { error: 'Choose a valid address type.' };
  if (address.address_line.length < 5 || address.address_line.length > 255) return { error: 'Address line must be 5–255 characters.' };
  if (address.city.length < 2 || address.city.length > 100) return { error: 'City is required.' };
  if (address.state.length < 2 || address.state.length > 100) return { error: 'State is required.' };
  if (address.pincode && !PINCODE_PATTERN.test(address.pincode)) return { error: 'Enter a valid 6-digit PIN code.' };
  return { address };
}

const ADDRESS_COLUMNS = 'address_id, address_type, address_line, city, state, pincode, is_default';

async function listAddresses(userId) {
  const [rows] = await pool.query(
    `SELECT ${ADDRESS_COLUMNS} FROM addresses WHERE user_id = ? ORDER BY is_default DESC, address_id DESC`,
    [userId]
  );
  return rows.map((r) => ({ ...r, is_default: Boolean(r.is_default) }));
}

async function handleGetAddresses(req, res) {
  const user = await requireUser(req, res, ['CUSTOMER']);
  if (!user) return;
  try {
    sendJSON(res, 200, { success: true, data: await listAddresses(user.user_id) });
  } catch (err) {
    console.error('Error loading addresses:', err.message);
    sendError(res, 500, 'Unable to load your addresses.');
  }
}

async function handleCreateAddress(req, res) {
  const user = await requireUser(req, res, ['CUSTOMER']);
  if (!user) return;
  const body = await readBodyOrFail(req, res);
  if (!body) return;
  const { address, error } = validateAddress(body);
  if (error) return sendError(res, 400, error);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[count]] = await conn.query('SELECT COUNT(*) AS c FROM addresses WHERE user_id = ?', [user.user_id]);
    if (count.c >= 10) {
      await conn.rollback();
      return sendError(res, 400, 'You can save up to 10 addresses.');
    }
    // First address of a user always becomes the default.
    if (count.c === 0) address.is_default = 1;
    if (address.is_default) {
      await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [user.user_id]);
    }
    const [result] = await conn.query(
      `INSERT INTO addresses (user_id, address_type, address_line, city, state, pincode, is_default)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [user.user_id, address.address_type, address.address_line, address.city, address.state, address.pincode || null, address.is_default]
    );
    await conn.commit();
    sendJSON(res, 201, {
      success: true,
      message: 'Address saved.',
      data: { address_id: result.insertId, addresses: await listAddresses(user.user_id) }
    });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Error creating address:', err.message);
    sendError(res, 500, 'Unable to save the address.');
  } finally {
    conn.release();
  }
}

async function handleUpdateAddress(req, res, addressId) {
  const user = await requireUser(req, res, ['CUSTOMER']);
  if (!user) return;
  const body = await readBodyOrFail(req, res);
  if (!body) return;
  const { address, error } = validateAddress(body);
  if (error) return sendError(res, 400, error);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[existing]] = await conn.query(
      'SELECT address_id, is_default FROM addresses WHERE address_id = ? AND user_id = ?',
      [addressId, user.user_id]
    );
    if (!existing) {
      await conn.rollback();
      return sendError(res, 404, 'Address not found.');
    }
    // The default address can only lose its flag by another address taking it.
    if (existing.is_default) address.is_default = 1;
    if (address.is_default) {
      await conn.query('UPDATE addresses SET is_default = 0 WHERE user_id = ?', [user.user_id]);
    }
    await conn.query(
      `UPDATE addresses SET address_type = ?, address_line = ?, city = ?, state = ?, pincode = ?, is_default = ?
       WHERE address_id = ? AND user_id = ?`,
      [address.address_type, address.address_line, address.city, address.state, address.pincode || null,
        address.is_default, addressId, user.user_id]
    );
    await conn.commit();
    sendJSON(res, 200, { success: true, message: 'Address updated.', data: { addresses: await listAddresses(user.user_id) } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Error updating address:', err.message);
    sendError(res, 500, 'Unable to update the address.');
  } finally {
    conn.release();
  }
}

async function handleDeleteAddress(req, res, addressId) {
  const user = await requireUser(req, res, ['CUSTOMER']);
  if (!user) return;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [[existing]] = await conn.query(
      'SELECT is_default FROM addresses WHERE address_id = ? AND user_id = ?',
      [addressId, user.user_id]
    );
    if (!existing) {
      await conn.rollback();
      return sendError(res, 404, 'Address not found.');
    }
    await conn.query('DELETE FROM addresses WHERE address_id = ? AND user_id = ?', [addressId, user.user_id]);
    if (existing.is_default) {
      // Promote the most recent remaining address to default.
      await conn.query(
        'UPDATE addresses SET is_default = 1 WHERE user_id = ? ORDER BY address_id DESC LIMIT 1',
        [user.user_id]
      );
    }
    await conn.commit();
    sendJSON(res, 200, { success: true, message: 'Address removed.', data: { addresses: await listAddresses(user.user_id) } });
  } catch (err) {
    await conn.rollback().catch(() => {});
    console.error('Error deleting address:', err.message);
    sendError(res, 500, 'Unable to delete the address.');
  } finally {
    conn.release();
  }
}

// ==========================================
// POST /api/packages/budget-finder
// ==========================================

const SAVER_THRESHOLD = 0.8; // cost <= 80% of budget => "Budget Saver"
const DEFAULT_STRETCH_PCT = 20;

async function handleBudgetFinder(req, res) {
  const body = await readBodyOrFail(req, res);
  if (!body) return;

  const budget = Number(body.budget);
  const travelers = parseInt(body.travelers, 10);
  const duration = parseInt(body.duration_days, 10) || 0; // 0 = any length
  const flexDays = Math.min(Math.max(parseInt(body.duration_flex, 10) || 1, 0), 5);
  const categoryId = parseInt(body.category_id, 10) || null;
  const stretchPct = Math.min(Math.max(Number(body.stretch_pct) || DEFAULT_STRETCH_PCT, 5), 50);

  if (!Number.isFinite(budget) || budget < 1000 || budget > 10000000) {
    return sendError(res, 400, 'Enter a total budget between ₹1,000 and ₹1,00,00,000.');
  }
  if (!Number.isInteger(travelers) || travelers < 1 || travelers > 20) {
    return sendError(res, 400, 'Number of travelers must be between 1 and 20.');
  }
  if (duration < 0 || duration > 30) return sendError(res, 400, 'Duration must be between 1 and 30 days.');

  const stretchCeiling = budget * (1 + stretchPct / 100);
  const maxPricePerPerson = stretchCeiling / travelers;

  let sql = `
    SELECT
      p.package_id, p.title, p.description, p.duration_days, p.price, p.capacity, p.image,
      d.destination_id, d.name AS destination_name, d.city, d.state,
      c.category_id, c.category_name,
      u.name AS provider_name,
      (SELECT MIN(pa.available_date) FROM package_availability pa
        WHERE pa.package_id = p.package_id AND pa.status = 'AVAILABLE'
          AND pa.seats_available >= ? AND pa.available_date >= CURDATE()) AS next_available_date,
      (SELECT ROUND(AVG(r.rating), 1) FROM reviews r WHERE r.package_id = p.package_id) AS avg_rating,
      (SELECT COUNT(*) FROM reviews r WHERE r.package_id = p.package_id) AS review_count,
      (SELECT COUNT(*) FROM package_itinerary pi WHERE pi.package_id = p.package_id) AS itinerary_days
    FROM tour_packages p
    JOIN destinations d ON p.destination_id = d.destination_id
    JOIN categories c ON p.category_id = c.category_id
    LEFT JOIN users u ON p.provider_id = u.user_id
    WHERE p.status = 'APPROVED' AND d.status = 'ACTIVE' AND c.status = 'ACTIVE'
      AND p.capacity >= ?
      AND p.price <= ?
  `;
  const params = [travelers, travelers, maxPricePerPerson];

  if (duration > 0) {
    sql += ' AND p.duration_days BETWEEN ? AND ?';
    params.push(Math.max(1, duration - flexDays), duration + flexDays);
  }
  if (categoryId) {
    sql += ' AND p.category_id = ?';
    params.push(categoryId);
  }

  try {
    const [rows] = await pool.query(sql, params);

    const within = [];
    const saver = [];
    const stretch = [];

    rows.forEach((row) => {
      const price = Number(row.price);
      const tripCost = price * travelers;
      const leftover = budget - tripCost;
      const item = {
        package_id: row.package_id,
        title: row.title,
        description: row.description,
        duration_days: row.duration_days,
        price_per_person: price,
        trip_cost: tripCost,
        image: row.image,
        destination_name: row.destination_name,
        city: row.city,
        state: row.state,
        category_id: row.category_id,
        category_name: row.category_name,
        provider_name: row.provider_name,
        next_available_date: row.next_available_date,
        avg_rating: row.avg_rating !== null ? Number(row.avg_rating) : null,
        review_count: Number(row.review_count) || 0,
        itinerary_days: Number(row.itinerary_days) || 0,
        budget_used_pct: Math.round((tripCost / budget) * 100)
      };

      if (leftover >= 0) {
        item.leftover = leftover;
        item.leftover_per_person = leftover / travelers;
        item.daily_allowance_per_person = leftover / travelers / row.duration_days;
        if (tripCost <= budget * SAVER_THRESHOLD) saver.push(item);
        else within.push(item);
      } else {
        item.over_by = -leftover;
        item.over_by_per_person = -leftover / travelers;
        stretch.push(item);
      }
    });

    // Within: best use of the budget first. Saver: most money left first. Stretch: smallest jump first.
    within.sort((a, b) => b.trip_cost - a.trip_cost);
    saver.sort((a, b) => b.leftover - a.leftover);
    stretch.sort((a, b) => a.over_by - b.over_by);

    // Describe what the stretch upgrade buys compared with the best affordable option.
    const affordable = within.concat(saver);
    const bestAffordable = affordable.reduce((best, p) => (!best || p.trip_cost > best.trip_cost ? p : best), null);
    stretch.forEach((p) => {
      const perks = [];
      if (bestAffordable) {
        const extraDays = p.duration_days - bestAffordable.duration_days;
        if (extraDays > 0) perks.push(`+${extraDays} extra day${extraDays > 1 ? 's' : ''} vs. your top in-budget pick`);
      }
      if (p.avg_rating !== null && p.avg_rating >= 4.5) perks.push(`Highly rated ${p.avg_rating}★ by travelers`);
      if (p.itinerary_days >= p.duration_days && p.duration_days > 0) perks.push('Fully planned day-by-day itinerary');
      if (p.price_per_person >= 20000) perks.push('Premium stays & curated experiences');
      if (perks.length === 0) perks.push(`Only ${Math.round((p.over_by / budget) * 100)}% above your budget`);
      p.premium_highlights = perks;
    });

    sendJSON(res, 200, {
      success: true,
      data: {
        summary: {
          budget,
          travelers,
          per_person_budget: budget / travelers,
          per_person_per_day: duration > 0 ? budget / travelers / duration : null,
          duration_days: duration || null,
          duration_range: duration > 0 ? [Math.max(1, duration - flexDays), duration + flexDays] : null,
          category_id: categoryId,
          stretch_pct: stretchPct,
          stretch_ceiling: stretchCeiling,
          saver_threshold: budget * SAVER_THRESHOLD,
          total_matches: within.length + saver.length + stretch.length
        },
        tiers: { within_budget: within, budget_saver: saver, stretch_match: stretch }
      }
    });
  } catch (err) {
    console.error('Budget finder error:', err.message);
    sendError(res, 500, 'Unable to search packages right now.');
  }
}

// ==========================================
// Schema migration for Member 1 tables
// ==========================================

/** Adds address_type / is_default to existing databases created before this module. */
async function ensureMember1Schema() {
  const [cols] = await pool.query(
    `SELECT COLUMN_NAME FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'addresses'`
  );
  const names = new Set(cols.map((c) => c.COLUMN_NAME));
  if (names.size === 0) return; // table missing; schema.sql not applied yet
  if (!names.has('address_type')) {
    await pool.query(
      `ALTER TABLE addresses ADD COLUMN address_type ENUM('HOME','BILLING','DELIVERY','OTHER')
       NOT NULL DEFAULT 'HOME' AFTER user_id`
    );
    console.log('Migrated: addresses.address_type added.');
  }
  if (!names.has('is_default')) {
    await pool.query('ALTER TABLE addresses ADD COLUMN is_default TINYINT(1) NOT NULL DEFAULT 0');
    console.log('Migrated: addresses.is_default added.');
  }
}

module.exports = {
  // session utilities (usable by other modules)
  getSessionUser,
  requireUser,
  hashPassword,
  checkPassword,
  ensureMember1Schema,
  // handlers
  handleLogin,
  handleLogout,
  handleGetMe,
  handleGetCustomerProfile,
  handleUpdateCustomerProfile,
  handleGetAddresses,
  handleCreateAddress,
  handleUpdateAddress,
  handleDeleteAddress,
  handleBudgetFinder
};
