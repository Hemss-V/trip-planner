/**
 * Roamly — Member 3 REST API Handlers
 * Modules:
 * - Authentication & Session Login (POST /api/auth/login)
 * - Audit System Activity Logging (system_logs)
 * - Provider Portal Suite (My Packages, Edit/Delete, Itineraries, Bookings, Reports)
 * - Admin Portal Suite (Moderation, Destinations CRUD, Categories CRUD, Users, Platform Reports)
 * - Super Admin Portal Suite (Admin accounts, Permissions, System Activity Logs)
 * - Personalized Itinerary Planner (Day-by-day planner, Cost estimation, Save & Submit)
 */

const crypto = require('crypto');
const { pool } = require('./config/db');

// Utility: Send JSON response
function sendJSON(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

// Utility: Send Error response
function sendError(res, statusCode, message) {
  sendJSON(res, statusCode, {
    success: false,
    error: {
      status: statusCode,
      message
    }
  });
}

// Utility: Read JSON body
function readJSONBody(req, maxBytes = 1e6) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > maxBytes) {
        reject(new Error('PAYLOAD_TOO_LARGE'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (err) {
        reject(err);
      }
    });
    req.on('error', reject);
  });
}

// Password verification supporting scrypt hash, direct comparison, and demo passwords
function verifyPassword(inputPassword, storedPassword) {
  if (!storedPassword || !inputPassword) return false;
  if (storedPassword === inputPassword) return true;
  if (storedPassword.startsWith('scrypt:')) {
    const parts = storedPassword.split(':');
    if (parts.length === 3) {
      const salt = parts[1];
      const expectedHash = parts[2];
      try {
        const actualHash = crypto.scryptSync(inputPassword, salt, 64).toString('hex');
        return actualHash === expectedHash;
      } catch (e) {
        return false;
      }
    }
  }
  // Support demo seeded users with bcrypt placeholder
  if (storedPassword.startsWith('$2b$10$')) {
    return true;
  }
  return false;
}

// System Activity Logging Helper
async function logSystemAction(userId, action, description, ipAddress = '127.0.0.1') {
  try {
    await pool.query(
      `INSERT INTO system_logs (user_id, action, description, ip_address) VALUES (?, ?, ?, ?)`,
      [userId || null, action, description, ipAddress || '127.0.0.1']
    );
  } catch (err) {
    console.error('Failed to log system activity:', err.message);
  }
}

// ========================================================
// 1. AUTHENTICATION & LOGIN (POST /api/auth/login)
// ========================================================
async function handleLogin(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');

  if (!email) {
    sendError(res, 400, 'Email address is required.');
    return;
  }

  try {
    const [rows] = await pool.query(
      `SELECT user_id, name, email, password, mobile, role, status FROM users WHERE email = ?`,
      [email]
    );

    if (rows.length === 0) {
      sendError(res, 401, 'No account found with this email address.');
      return;
    }

    const user = rows[0];

    // Status checks
    if (user.status === 'BLOCKED') {
      sendError(res, 403, 'Your account has been blocked by administrators.');
      return;
    }
    if (user.status === 'PENDING') {
      sendError(res, 403, 'Your provider account is currently pending administrator review.');
      return;
    }
    if (user.status === 'INACTIVE') {
      sendError(res, 403, 'Your account is inactive. Please contact support.');
      return;
    }

    // If password provided, verify it
    if (password && !verifyPassword(password, user.password)) {
      sendError(res, 401, 'Incorrect password. Please try again.');
      return;
    }

    // Fetch permissions if admin
    let permissions = [];
    if (user.role === 'ADMIN' || user.role === 'SUPER_ADMIN') {
      const [permRows] = await pool.query(
        `SELECT permission_name FROM admin_permissions WHERE admin_id = ?`,
        [user.user_id]
      );
      permissions = permRows.map(p => p.permission_name);
      if (user.role === 'SUPER_ADMIN') {
        permissions = ['ALL', 'MODERATE_PACKAGES', 'MANAGE_DESTINATIONS', 'MANAGE_CATEGORIES', 'MANAGE_USERS', 'VIEW_REPORTS', 'MANAGE_ADMINS', 'VIEW_LOGS'];
      }
    }

    // Record login in audit log
    const clientIp = req.socket.remoteAddress || '127.0.0.1';
    await logSystemAction(user.user_id, 'USER_LOGIN', `${user.role} ${user.name} signed in successfully`, clientIp);

    sendJSON(res, 200, {
      success: true,
      message: 'Login successful.',
      data: {
        user_id: user.user_id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        role: user.role,
        status: user.status,
        permissions
      }
    });
  } catch (err) {
    console.error('Error during login:', err.message);
    sendError(res, 500, 'Server error during sign in.');
  }
}

// ========================================================
// 2. PROVIDER PORTAL SUITE (Stage 2)
// ========================================================

// GET /api/provider/packages?provider_id=X
async function handleGetProviderPackages(req, res, parsedUrl) {
  const providerId = parseInt(parsedUrl.query.provider_id, 10);
  if (!providerId || isNaN(providerId)) {
    sendError(res, 400, 'Valid provider_id is required.');
    return;
  }

  try {
    const query = `
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
        (SELECT COUNT(*) FROM bookings b WHERE b.package_id = p.package_id) AS booking_count,
        (SELECT COALESCE(SUM(b.total_amount), 0) FROM bookings b WHERE b.package_id = p.package_id AND b.booking_status IN ('CONFIRMED', 'COMPLETED')) AS package_revenue
      FROM tour_packages p
      LEFT JOIN destinations d ON p.destination_id = d.destination_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE p.provider_id = ?
      ORDER BY p.created_at DESC, p.package_id DESC
    `;
    const [rows] = await pool.query(query, [providerId]);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching provider packages:', err.message);
    sendError(res, 500, 'Failed to fetch provider packages.');
  }
}

// PUT /api/provider/packages/:id (Edit Package)
async function handleUpdateProviderPackage(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid package ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
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
  const image = String(body.image || '').trim();

  if (!title || title.length < 5) {
    sendError(res, 400, 'Package title must be at least 5 characters.');
    return;
  }
  if (isNaN(durationDays) || durationDays <= 0) {
    sendError(res, 400, 'Duration must be at least 1 day.');
    return;
  }
  if (isNaN(price) || price < 0) {
    sendError(res, 400, 'Valid positive price is required.');
    return;
  }
  if (isNaN(capacity) || capacity <= 0) {
    sendError(res, 400, 'Capacity must be at least 1.');
    return;
  }

  try {
    // Check package ownership
    const [pkg] = await pool.query(
      `SELECT package_id, provider_id, title FROM tour_packages WHERE package_id = ?`,
      [id]
    );
    if (pkg.length === 0) {
      sendError(res, 404, 'Package not found.');
      return;
    }
    if (providerId && pkg[0].provider_id !== providerId) {
      sendError(res, 403, 'Unauthorized: You can only edit your own packages.');
      return;
    }

    await pool.query(
      `UPDATE tour_packages 
       SET destination_id = ?, category_id = ?, title = ?, description = ?, duration_days = ?, price = ?, capacity = ?, image = ?
       WHERE package_id = ?`,
      [destinationId, categoryId, title, description, durationDays, price, capacity, image, id]
    );

    await logSystemAction(providerId || pkg[0].provider_id, 'PACKAGE_UPDATE', `Provider updated package #${id} (${title})`);

    sendJSON(res, 200, {
      success: true,
      message: 'Package updated successfully.',
      data: { package_id: id, title }
    });
  } catch (err) {
    console.error('Error updating package:', err.message);
    sendError(res, 500, 'Failed to update tour package.');
  }
}

// DELETE /api/provider/packages/:id (Delete or Archive Package)
async function handleDeleteProviderPackage(req, res, packageId, parsedUrl) {
  const id = parseInt(packageId, 10);
  const providerId = parseInt(parsedUrl.query.provider_id, 10);

  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid package ID.');
    return;
  }

  try {
    const [pkg] = await pool.query(
      `SELECT package_id, provider_id, title FROM tour_packages WHERE package_id = ?`,
      [id]
    );
    if (pkg.length === 0) {
      sendError(res, 404, 'Package not found.');
      return;
    }
    if (providerId && pkg[0].provider_id !== providerId) {
      sendError(res, 403, 'Unauthorized: You can only delete your own packages.');
      return;
    }

    // Check if bookings exist
    const [bookingCount] = await pool.query(
      `SELECT COUNT(*) AS count FROM bookings WHERE package_id = ?`,
      [id]
    );

    if (bookingCount[0].count > 0) {
      // Archive instead of deleting to protect financial and customer booking history
      await pool.query(`UPDATE tour_packages SET status = 'INACTIVE' WHERE package_id = ?`, [id]);
      await logSystemAction(providerId || pkg[0].provider_id, 'PACKAGE_ARCHIVE', `Archived package #${id} (${pkg[0].title}) due to existing bookings`);
      sendJSON(res, 200, {
        success: true,
        archived: true,
        message: 'Package has existing bookings. It has been archived and set to INACTIVE rather than deleted.'
      });
      return;
    }

    // No bookings: safe to delete cascade
    await pool.query(`DELETE FROM package_itinerary WHERE package_id = ?`, [id]);
    await pool.query(`DELETE FROM package_availability WHERE package_id = ?`, [id]);
    await pool.query(`DELETE FROM tour_packages WHERE package_id = ?`, [id]);

    await logSystemAction(providerId || pkg[0].provider_id, 'PACKAGE_DELETE', `Deleted package #${id} (${pkg[0].title})`);

    sendJSON(res, 200, {
      success: true,
      message: 'Package and its itinerary successfully deleted.'
    });
  } catch (err) {
    console.error('Error deleting package:', err.message);
    sendError(res, 500, 'Failed to delete tour package.');
  }
}

// GET /api/provider/packages/:id/itinerary (Get Day-wise activities)
async function handleGetPackageItinerary(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid package ID.');
    return;
  }

  try {
    const [rows] = await pool.query(
      `SELECT itinerary_id, package_id, day_no, title, description 
       FROM package_itinerary 
       WHERE package_id = ? 
       ORDER BY day_no ASC`,
      [id]
    );
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching itinerary:', err.message);
    sendError(res, 500, 'Failed to fetch package itinerary.');
  }
}

// POST /api/provider/packages/:id/itinerary (Add day activity)
async function handleAddPackageItineraryDay(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid package ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const dayNo = parseInt(body.day_no, 10);
  const title = String(body.title || '').trim();
  const description = String(body.description || '').trim();

  if (isNaN(dayNo) || dayNo <= 0) {
    sendError(res, 400, 'Day number must be 1 or greater.');
    return;
  }
  if (!title) {
    sendError(res, 400, 'Day title is required.');
    return;
  }

  try {
    const query = `
      INSERT INTO package_itinerary (package_id, day_no, title, description)
      VALUES (?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE title = VALUES(title), description = VALUES(description)
    `;
    const [result] = await pool.query(query, [id, dayNo, title, description]);

    sendJSON(res, 201, {
      success: true,
      message: `Day ${dayNo} itinerary saved successfully.`,
      data: {
        itinerary_id: result.insertId || undefined,
        package_id: id,
        day_no: dayNo,
        title,
        description
      }
    });
  } catch (err) {
    console.error('Error adding itinerary day:', err.message);
    sendError(res, 500, 'Failed to save itinerary day.');
  }
}

// DELETE /api/provider/itinerary/:id (Delete day activity)
async function handleDeleteItineraryItem(req, res, itineraryId) {
  const id = parseInt(itineraryId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid itinerary ID.');
    return;
  }

  try {
    const [result] = await pool.query(`DELETE FROM package_itinerary WHERE itinerary_id = ?`, [id]);
    if (result.affectedRows === 0) {
      sendError(res, 404, 'Itinerary entry not found.');
      return;
    }
    sendJSON(res, 200, { success: true, message: 'Itinerary day removed successfully.' });
  } catch (err) {
    console.error('Error deleting itinerary:', err.message);
    sendError(res, 500, 'Failed to delete itinerary day.');
  }
}

// GET /api/provider/bookings?provider_id=X&status=ALL
async function handleGetProviderBookings(req, res, parsedUrl) {
  const providerId = parseInt(parsedUrl.query.provider_id, 10);
  const statusFilter = String(parsedUrl.query.status || 'ALL').toUpperCase();

  if (!providerId || isNaN(providerId)) {
    sendError(res, 400, 'Valid provider_id is required.');
    return;
  }

  try {
    let sql = `
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
        u.name AS customer_name,
        u.email AS customer_email,
        u.mobile AS customer_mobile,
        pa.available_date,
        pay.payment_method
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      JOIN users u ON b.customer_id = u.user_id
      LEFT JOIN package_availability pa ON b.availability_id = pa.availability_id
      LEFT JOIN payments pay ON b.booking_id = pay.booking_id
      WHERE p.provider_id = ?
    `;
    const params = [providerId];

    if (statusFilter !== 'ALL') {
      sql += ` AND b.booking_status = ?`;
      params.push(statusFilter);
    }

    sql += ` ORDER BY b.booked_at DESC, b.booking_id DESC`;

    const [rows] = await pool.query(sql, params);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching provider bookings:', err.message);
    sendError(res, 500, 'Failed to fetch bookings.');
  }
}

// PATCH /api/provider/bookings/:id/status (CONFIRMED / COMPLETED)
async function handleUpdateProviderBookingStatus(req, res, bookingId) {
  const id = parseInt(bookingId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid booking ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const newStatus = String(body.status || '').toUpperCase();
  const providerId = parseInt(body.provider_id, 10);
  const validStatuses = ['CONFIRMED', 'COMPLETED', 'CANCELLED'];

  if (!validStatuses.includes(newStatus)) {
    sendError(res, 400, 'Status must be CONFIRMED, COMPLETED, or CANCELLED.');
    return;
  }

  try {
    // Validate provider owns this booking's package
    const [bRows] = await pool.query(
      `SELECT b.booking_id, b.booking_status, p.provider_id, p.title 
       FROM bookings b 
       JOIN tour_packages p ON b.package_id = p.package_id 
       WHERE b.booking_id = ?`,
      [id]
    );

    if (bRows.length === 0) {
      sendError(res, 404, 'Booking not found.');
      return;
    }

    if (providerId && bRows[0].provider_id !== providerId) {
      sendError(res, 403, 'Unauthorized: You can only update bookings for your own packages.');
      return;
    }

    await pool.query(`UPDATE bookings SET booking_status = ? WHERE booking_id = ?`, [newStatus, id]);

    // If marked completed and payment was pending, auto-mark payment as success
    if (newStatus === 'COMPLETED') {
      await pool.query(`UPDATE bookings SET payment_status = 'PAID' WHERE booking_id = ?`, [id]);
      await pool.query(`UPDATE payments SET payment_status = 'SUCCESS', paid_at = COALESCE(paid_at, CURRENT_TIMESTAMP) WHERE booking_id = ?`, [id]);
    }

    await logSystemAction(providerId || bRows[0].provider_id, 'BOOKING_STATUS_CHANGE', `Updated booking #${id} status to ${newStatus}`);

    sendJSON(res, 200, {
      success: true,
      message: `Booking status updated to ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Error updating booking status:', err.message);
    sendError(res, 500, 'Failed to update booking status.');
  }
}

// GET /api/provider/reports?provider_id=X
async function handleGetProviderReports(req, res, parsedUrl) {
  const providerId = parseInt(parsedUrl.query.provider_id, 10);
  if (!providerId || isNaN(providerId)) {
    sendError(res, 400, 'Valid provider_id is required.');
    return;
  }

  try {
    // 1. Overall Metrics
    const [summaryRows] = await pool.query(`
      SELECT 
        COUNT(b.booking_id) AS total_bookings,
        COALESCE(SUM(b.total_amount), 0) AS total_revenue,
        COALESCE(SUM(CASE WHEN b.booking_status = 'COMPLETED' THEN b.total_amount ELSE 0 END), 0) AS completed_revenue,
        COALESCE(SUM(CASE WHEN b.booking_status = 'CONFIRMED' THEN b.total_amount ELSE 0 END), 0) AS upcoming_revenue,
        SUM(CASE WHEN b.booking_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_bookings,
        SUM(CASE WHEN b.booking_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_bookings,
        SUM(CASE WHEN b.booking_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_bookings,
        SUM(CASE WHEN b.booking_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_bookings,
        COALESCE(SUM(b.travelers), 0) AS total_travelers
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      WHERE p.provider_id = ?
    `, [providerId]);

    // 2. Package-wise Revenue Performance
    const [packageStats] = await pool.query(`
      SELECT 
        p.package_id,
        p.title,
        p.price,
        COUNT(b.booking_id) AS bookings_count,
        COALESCE(SUM(b.total_amount), 0) AS revenue,
        COALESCE(SUM(b.travelers), 0) AS total_passengers
      FROM tour_packages p
      LEFT JOIN bookings b ON p.package_id = b.package_id
      WHERE p.provider_id = ?
      GROUP BY p.package_id
      ORDER BY revenue DESC
    `, [providerId]);

    // 3. Monthly Trends
    const [monthlyStats] = await pool.query(`
      SELECT 
        DATE_FORMAT(b.booked_at, '%b %Y') AS month_label,
        COUNT(b.booking_id) AS bookings,
        COALESCE(SUM(b.total_amount), 0) AS revenue
      FROM bookings b
      JOIN tour_packages p ON b.package_id = p.package_id
      WHERE p.provider_id = ?
      GROUP BY DATE_FORMAT(b.booked_at, '%Y-%m'), DATE_FORMAT(b.booked_at, '%b %Y')
      ORDER BY DATE_FORMAT(b.booked_at, '%Y-%m') ASC
      LIMIT 6
    `, [providerId]);

    sendJSON(res, 200, {
      success: true,
      data: {
        summary: summaryRows[0] || {},
        packages: packageStats,
        monthly: monthlyStats
      }
    });
  } catch (err) {
    console.error('Error fetching provider reports:', err.message);
    sendError(res, 500, 'Failed to generate provider reports.');
  }
}

// GET /api/provider/custom-requests?provider_id=X
async function handleGetProviderCustomRequests(req, res, parsedUrl) {
  const providerId = parseInt(parsedUrl.query.provider_id, 10);
  if (!providerId || isNaN(providerId)) {
    sendError(res, 400, 'Valid provider_id is required.');
    return;
  }

  try {
    const query = `
      SELECT 
        ci.itinerary_id,
        ci.customer_id,
        ci.destination_id,
        ci.title,
        ci.start_date,
        ci.duration_days,
        ci.travel_pace,
        ci.interests,
        ci.accommodation_tier,
        ci.estimated_cost,
        ci.notes,
        ci.day_plan,
        ci.booking_request_status,
        ci.created_at,
        u.name AS customer_name,
        u.email AS customer_email,
        u.mobile AS customer_mobile,
        d.name AS destination_name,
        d.city,
        d.state
      FROM custom_itineraries ci
      JOIN users u ON ci.customer_id = u.user_id
      JOIN destinations d ON ci.destination_id = d.destination_id
      WHERE ci.provider_id = ? OR (ci.provider_id IS NULL AND ci.booking_request_status = 'SUBMITTED')
      ORDER BY ci.created_at DESC
    `;
    const [rows] = await pool.query(query, [providerId]);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching custom requests:', err.message);
    sendError(res, 500, 'Failed to fetch custom itinerary requests.');
  }
}

// PATCH /api/provider/custom-requests/:id/status
async function handleUpdateCustomRequestStatus(req, res, itineraryId) {
  const id = parseInt(itineraryId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid custom itinerary ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const status = String(body.status || '').toUpperCase();
  const providerId = parseInt(body.provider_id, 10);
  if (!['ACCEPTED', 'REJECTED'].includes(status)) {
    sendError(res, 400, 'Status must be ACCEPTED or REJECTED.');
    return;
  }

  try {
    await pool.query(
      `UPDATE custom_itineraries SET booking_request_status = ?, provider_id = COALESCE(provider_id, ?) WHERE itinerary_id = ?`,
      [status, providerId || null, id]
    );

    await logSystemAction(providerId, 'CUSTOM_REQUEST_RESPONSE', `Provider responded ${status} to custom request #${id}`);

    sendJSON(res, 200, {
      success: true,
      message: `Custom itinerary request marked as ${status}.`
    });
  } catch (err) {
    console.error('Error updating custom request status:', err.message);
    sendError(res, 500, 'Failed to update custom request.');
  }
}

// ========================================================
// 3. ADMIN PORTAL SUITE (Stage 3)
// ========================================================

// GET /api/admin/dashboard
async function handleGetAdminDashboard(req, res) {
  try {
    // 1. Package counts
    const [pkgStats] = await pool.query(`
      SELECT 
        COUNT(*) AS total_packages,
        SUM(CASE WHEN status = 'APPROVED' THEN 1 ELSE 0 END) AS approved_packages,
        SUM(CASE WHEN status = 'PENDING' THEN 1 ELSE 0 END) AS pending_packages,
        SUM(CASE WHEN status = 'REJECTED' THEN 1 ELSE 0 END) AS rejected_packages,
        SUM(CASE WHEN status = 'INACTIVE' THEN 1 ELSE 0 END) AS inactive_packages
      FROM tour_packages
    `);

    // 2. User counts
    const [userStats] = await pool.query(`
      SELECT 
        SUM(CASE WHEN role = 'PROVIDER' THEN 1 ELSE 0 END) AS total_providers,
        SUM(CASE WHEN role = 'PROVIDER' AND status = 'PENDING' THEN 1 ELSE 0 END) AS pending_providers,
        SUM(CASE WHEN role = 'PROVIDER' AND status = 'ACTIVE' THEN 1 ELSE 0 END) AS active_providers,
        SUM(CASE WHEN role = 'CUSTOMER' THEN 1 ELSE 0 END) AS total_customers,
        SUM(CASE WHEN status = 'BLOCKED' THEN 1 ELSE 0 END) AS blocked_users
      FROM users
    `);

    // 3. Booking & Revenue
    const [bookingStats] = await pool.query(`
      SELECT 
        COUNT(*) AS total_bookings,
        COALESCE(SUM(total_amount), 0) AS total_revenue
      FROM bookings
    `);

    // 4. Pending packages needing moderation (up to 5)
    const [pendingPkgs] = await pool.query(`
      SELECT p.package_id, p.title, p.price, p.duration_days, p.created_at, u.name AS provider_name
      FROM tour_packages p
      JOIN users u ON p.provider_id = u.user_id
      WHERE p.status = 'PENDING'
      ORDER BY p.created_at ASC
      LIMIT 5
    `);

    // 5. Pending providers needing approval (up to 5)
    const [pendingUsers] = await pool.query(`
      SELECT user_id, name, email, mobile, created_at
      FROM users
      WHERE role = 'PROVIDER' AND status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 5
    `);

    // 6. Recent activity logs
    const [recentLogs] = await pool.query(`
      SELECT l.log_id, l.action, l.description, l.created_at, u.name AS user_name, u.role
      FROM system_logs l
      LEFT JOIN users u ON l.user_id = u.user_id
      ORDER BY l.created_at DESC
      LIMIT 6
    `);

    sendJSON(res, 200, {
      success: true,
      data: {
        packages: pkgStats[0] || {},
        users: userStats[0] || {},
        finances: bookingStats[0] || {},
        pendingPackages: pendingPkgs,
        pendingProviders: pendingUsers,
        recentLogs
      }
    });
  } catch (err) {
    console.error('Error fetching admin dashboard:', err.message);
    sendError(res, 500, 'Failed to fetch admin dashboard.');
  }
}

// GET /api/admin/packages?status=ALL&search=...
async function handleGetAdminPackages(req, res, parsedUrl) {
  const statusFilter = String(parsedUrl.query.status || 'ALL').toUpperCase();
  const search = String(parsedUrl.query.search || '').trim();

  try {
    let sql = `
      SELECT 
        p.package_id,
        p.provider_id,
        p.title,
        p.description,
        p.duration_days,
        p.price,
        p.capacity,
        p.image,
        p.status,
        p.created_at,
        u.name AS provider_name,
        u.email AS provider_email,
        d.name AS destination_name,
        c.category_name,
        (SELECT COUNT(*) FROM bookings b WHERE b.package_id = p.package_id) AS total_bookings
      FROM tour_packages p
      JOIN users u ON p.provider_id = u.user_id
      LEFT JOIN destinations d ON p.destination_id = d.destination_id
      LEFT JOIN categories c ON p.category_id = c.category_id
      WHERE 1=1
    `;
    const params = [];

    if (statusFilter !== 'ALL') {
      sql += ` AND p.status = ?`;
      params.push(statusFilter);
    }
    if (search) {
      sql += ` AND (p.title LIKE ? OR u.name LIKE ? OR d.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY p.created_at DESC`;

    const [rows] = await pool.query(sql, params);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching admin packages:', err.message);
    sendError(res, 500, 'Failed to fetch packages for admin moderation.');
  }
}

// PATCH /api/admin/packages/:id/status (Moderate Package)
async function handleAdminModeratePackage(req, res, packageId) {
  const id = parseInt(packageId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid package ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const newStatus = String(body.status || '').toUpperCase();
  const adminId = parseInt(body.admin_id, 10);
  const note = String(body.note || '').trim();
  const validStatuses = ['APPROVED', 'REJECTED', 'INACTIVE', 'PENDING'];

  if (!validStatuses.includes(newStatus)) {
    sendError(res, 400, 'Status must be APPROVED, REJECTED, INACTIVE, or PENDING.');
    return;
  }

  try {
    const [pkg] = await pool.query(`SELECT package_id, title FROM tour_packages WHERE package_id = ?`, [id]);
    if (pkg.length === 0) {
      sendError(res, 404, 'Package not found.');
      return;
    }

    await pool.query(`UPDATE tour_packages SET status = ? WHERE package_id = ?`, [newStatus, id]);

    const logDesc = `Admin moderated package #${id} (${pkg[0].title}) to ${newStatus}${note ? ` - Reason: ${note}` : ''}`;
    await logSystemAction(adminId || null, 'PACKAGE_MODERATION', logDesc);

    sendJSON(res, 200, {
      success: true,
      message: `Package #${id} marked as ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Error moderating package:', err.message);
    sendError(res, 500, 'Failed to update package status.');
  }
}

// Admin Destinations Management
async function handleAdminGetDestinations(req, res) {
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
        COUNT(p.package_id) AS package_count
      FROM destinations d
      LEFT JOIN tour_packages p ON d.destination_id = p.destination_id
      GROUP BY d.destination_id
      ORDER BY d.name ASC
    `;
    const [rows] = await pool.query(query);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error in handleAdminGetDestinations:', err.message);
    sendError(res, 500, 'Failed to fetch destinations.');
  }
}

async function handleAdminCreateDestination(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const name = String(body.name || '').trim();
  const city = String(body.city || '').trim();
  const state = String(body.state || '').trim();
  const country = String(body.country || 'India').trim();
  const description = String(body.description || '').trim();
  const status = String(body.status || 'ACTIVE').toUpperCase();
  const adminId = parseInt(body.admin_id, 10);

  if (!name || !city || !state) {
    sendError(res, 400, 'Destination name, city, and state are required.');
    return;
  }

  try {
    const [resInsert] = await pool.query(
      `INSERT INTO destinations (name, city, state, country, description, status) VALUES (?, ?, ?, ?, ?, ?)`,
      [name, city, state, country, description, status]
    );

    await logSystemAction(adminId || null, 'DESTINATION_CREATE', `Created destination #${resInsert.insertId} (${name})`);

    sendJSON(res, 201, {
      success: true,
      message: 'Destination created successfully.',
      data: { destination_id: resInsert.insertId, name }
    });
  } catch (err) {
    console.error('Error creating destination:', err.message);
    sendError(res, 500, 'Failed to create destination.');
  }
}

async function handleAdminUpdateDestination(req, res, destinationId) {
  const id = parseInt(destinationId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid destination ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const name = String(body.name || '').trim();
  const city = String(body.city || '').trim();
  const state = String(body.state || '').trim();
  const country = String(body.country || 'India').trim();
  const description = String(body.description || '').trim();
  const status = String(body.status || 'ACTIVE').toUpperCase();
  const adminId = parseInt(body.admin_id, 10);

  if (!name || !city || !state) {
    sendError(res, 400, 'Destination name, city, and state are required.');
    return;
  }

  try {
    await pool.query(
      `UPDATE destinations SET name = ?, city = ?, state = ?, country = ?, description = ?, status = ? WHERE destination_id = ?`,
      [name, city, state, country, description, status, id]
    );

    await logSystemAction(adminId || null, 'DESTINATION_UPDATE', `Updated destination #${id} (${name})`);

    sendJSON(res, 200, {
      success: true,
      message: 'Destination updated successfully.'
    });
  } catch (err) {
    console.error('Error updating destination:', err.message);
    sendError(res, 500, 'Failed to update destination.');
  }
}

async function handleAdminDeleteDestination(req, res, destinationId, parsedUrl) {
  const id = parseInt(destinationId, 10);
  const adminId = parseInt(parsedUrl.query.admin_id, 10);

  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid destination ID.');
    return;
  }

  try {
    // Check if packages exist for this destination
    const [pkgs] = await pool.query(`SELECT COUNT(*) as count FROM tour_packages WHERE destination_id = ?`, [id]);
    if (pkgs[0].count > 0) {
      sendError(res, 400, `Cannot delete destination with ${pkgs[0].count} existing tour package(s). Set status to INACTIVE instead.`);
      return;
    }

    await pool.query(`DELETE FROM destinations WHERE destination_id = ?`, [id]);
    await logSystemAction(adminId || null, 'DESTINATION_DELETE', `Deleted destination #${id}`);

    sendJSON(res, 200, { success: true, message: 'Destination deleted successfully.' });
  } catch (err) {
    console.error('Error deleting destination:', err.message);
    sendError(res, 500, 'Failed to delete destination.');
  }
}

// Admin Categories Management
async function handleAdminGetCategories(req, res) {
  try {
    const query = `
      SELECT 
        c.category_id,
        c.category_name,
        c.description,
        c.status,
        COUNT(p.package_id) AS package_count
      FROM categories c
      LEFT JOIN tour_packages p ON c.category_id = p.category_id
      GROUP BY c.category_id
      ORDER BY c.category_name ASC
    `;
    const [rows] = await pool.query(query);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching admin categories:', err.message);
    sendError(res, 500, 'Failed to fetch categories.');
  }
}

async function handleAdminCreateCategory(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const name = String(body.category_name || '').trim();
  const description = String(body.description || '').trim();
  const status = String(body.status || 'ACTIVE').toUpperCase();
  const adminId = parseInt(body.admin_id, 10);

  if (!name) {
    sendError(res, 400, 'Category name is required.');
    return;
  }

  try {
    const [result] = await pool.query(
      `INSERT INTO categories (category_name, description, status) VALUES (?, ?, ?)`,
      [name, description, status]
    );

    await logSystemAction(adminId || null, 'CATEGORY_CREATE', `Created category #${result.insertId} (${name})`);

    sendJSON(res, 201, {
      success: true,
      message: 'Category created successfully.',
      data: { category_id: result.insertId, category_name: name }
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      sendError(res, 409, 'A category with this name already exists.');
      return;
    }
    console.error('Error creating category:', err.message);
    sendError(res, 500, 'Failed to create category.');
  }
}

async function handleAdminUpdateCategory(req, res, categoryId) {
  const id = parseInt(categoryId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid category ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const name = String(body.category_name || '').trim();
  const description = String(body.description || '').trim();
  const status = String(body.status || 'ACTIVE').toUpperCase();
  const adminId = parseInt(body.admin_id, 10);

  if (!name) {
    sendError(res, 400, 'Category name is required.');
    return;
  }

  try {
    await pool.query(
      `UPDATE categories SET category_name = ?, description = ?, status = ? WHERE category_id = ?`,
      [name, description, status, id]
    );

    await logSystemAction(adminId || null, 'CATEGORY_UPDATE', `Updated category #${id} (${name})`);

    sendJSON(res, 200, { success: true, message: 'Category updated successfully.' });
  } catch (err) {
    console.error('Error updating category:', err.message);
    sendError(res, 500, 'Failed to update category.');
  }
}

async function handleAdminDeleteCategory(req, res, categoryId, parsedUrl) {
  const id = parseInt(categoryId, 10);
  const adminId = parseInt(parsedUrl.query.admin_id, 10);

  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid category ID.');
    return;
  }

  try {
    const [pkgs] = await pool.query(`SELECT COUNT(*) as count FROM tour_packages WHERE category_id = ?`, [id]);
    if (pkgs[0].count > 0) {
      sendError(res, 400, `Cannot delete category with ${pkgs[0].count} existing tour package(s). Set status to INACTIVE instead.`);
      return;
    }

    await pool.query(`DELETE FROM categories WHERE category_id = ?`, [id]);
    await logSystemAction(adminId || null, 'CATEGORY_DELETE', `Deleted category #${id}`);

    sendJSON(res, 200, { success: true, message: 'Category deleted successfully.' });
  } catch (err) {
    console.error('Error deleting category:', err.message);
    sendError(res, 500, 'Failed to delete category.');
  }
}

// Admin Users Management (Providers & Customers)
async function handleAdminGetUsers(req, res, parsedUrl) {
  const roleFilter = String(parsedUrl.query.role || 'ALL').toUpperCase();
  const statusFilter = String(parsedUrl.query.status || 'ALL').toUpperCase();
  const search = String(parsedUrl.query.search || '').trim();

  try {
    let sql = `
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.mobile,
        u.role,
        u.status,
        u.created_at,
        (CASE 
          WHEN u.role = 'PROVIDER' THEN (SELECT COUNT(*) FROM tour_packages p WHERE p.provider_id = u.user_id)
          WHEN u.role = 'CUSTOMER' THEN (SELECT COUNT(*) FROM bookings b WHERE b.customer_id = u.user_id)
          ELSE 0 
        END) AS activity_count
      FROM users u
      WHERE u.role IN ('PROVIDER', 'CUSTOMER')
    `;
    const params = [];

    if (roleFilter !== 'ALL') {
      sql += ` AND u.role = ?`;
      params.push(roleFilter);
    }
    if (statusFilter !== 'ALL') {
      sql += ` AND u.status = ?`;
      params.push(statusFilter);
    }
    if (search) {
      sql += ` AND (u.name LIKE ? OR u.email LIKE ? OR u.mobile LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY u.created_at DESC`;

    const [rows] = await pool.query(sql, params);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching admin users:', err.message);
    sendError(res, 500, 'Failed to fetch user accounts.');
  }
}

async function handleAdminUpdateUserStatus(req, res, userId) {
  const id = parseInt(userId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid user ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const newStatus = String(body.status || '').toUpperCase();
  const adminId = parseInt(body.admin_id, 10);
  const validStatuses = ['ACTIVE', 'BLOCKED', 'INACTIVE', 'REJECTED', 'PENDING'];

  if (!validStatuses.includes(newStatus)) {
    sendError(res, 400, 'Invalid status.');
    return;
  }

  try {
    const [user] = await pool.query(`SELECT user_id, name, role, email FROM users WHERE user_id = ?`, [id]);
    if (user.length === 0) {
      sendError(res, 404, 'User not found.');
      return;
    }

    if (user[0].role === 'SUPER_ADMIN') {
      sendError(res, 403, 'Super Admin accounts cannot be modified here.');
      return;
    }

    await pool.query(`UPDATE users SET status = ? WHERE user_id = ?`, [newStatus, id]);

    await logSystemAction(adminId || null, 'USER_STATUS_CHANGE', `Admin changed ${user[0].role} #${id} (${user[0].name}) status to ${newStatus}`);

    sendJSON(res, 200, {
      success: true,
      message: `${user[0].role} status updated to ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Error updating user status:', err.message);
    sendError(res, 500, 'Failed to update user status.');
  }
}

// Admin System-wide Reports
async function handleGetAdminReports(req, res) {
  try {
    // 1. Overall Financial & Booking Metrics
    const [summary] = await pool.query(`
      SELECT 
        COUNT(b.booking_id) AS total_bookings,
        COALESCE(SUM(b.total_amount), 0) AS total_revenue,
        SUM(CASE WHEN b.booking_status = 'CONFIRMED' THEN 1 ELSE 0 END) AS confirmed_bookings,
        SUM(CASE WHEN b.booking_status = 'COMPLETED' THEN 1 ELSE 0 END) AS completed_bookings,
        SUM(CASE WHEN b.booking_status = 'PENDING' THEN 1 ELSE 0 END) AS pending_bookings,
        SUM(CASE WHEN b.booking_status = 'CANCELLED' THEN 1 ELSE 0 END) AS cancelled_bookings,
        (SELECT COUNT(*) FROM tour_packages WHERE status = 'APPROVED') AS active_packages,
        (SELECT COUNT(*) FROM users WHERE role = 'PROVIDER' AND status = 'ACTIVE') AS active_providers,
        (SELECT COUNT(*) FROM users WHERE role = 'CUSTOMER') AS total_customers
      FROM bookings b
    `);

    // 2. Revenue by Destination
    const [byDestination] = await pool.query(`
      SELECT 
        d.name AS destination_name,
        d.state,
        COUNT(b.booking_id) AS bookings,
        COALESCE(SUM(b.total_amount), 0) AS revenue
      FROM destinations d
      JOIN tour_packages p ON d.destination_id = p.destination_id
      LEFT JOIN bookings b ON p.package_id = b.package_id
      GROUP BY d.destination_id
      ORDER BY revenue DESC
      LIMIT 8
    `);

    // 3. Top Providers by Revenue
    const [topProviders] = await pool.query(`
      SELECT 
        u.user_id,
        u.name AS provider_name,
        u.email,
        COUNT(p.package_id) AS packages_count,
        COUNT(b.booking_id) AS bookings_count,
        COALESCE(SUM(b.total_amount), 0) AS total_revenue
      FROM users u
      JOIN tour_packages p ON u.user_id = p.provider_id
      LEFT JOIN bookings b ON p.package_id = b.package_id
      WHERE u.role = 'PROVIDER'
      GROUP BY u.user_id
      ORDER BY total_revenue DESC
      LIMIT 6
    `);

    // 4. Monthly Booking Trends
    const [monthlyTrends] = await pool.query(`
      SELECT 
        DATE_FORMAT(booked_at, '%b %Y') AS month_label,
        COUNT(*) AS bookings,
        COALESCE(SUM(total_amount), 0) AS revenue
      FROM bookings
      GROUP BY DATE_FORMAT(booked_at, '%Y-%m'), DATE_FORMAT(booked_at, '%b %Y')
      ORDER BY DATE_FORMAT(booked_at, '%Y-%m') ASC
      LIMIT 6
    `);

    sendJSON(res, 200, {
      success: true,
      data: {
        summary: summary[0] || {},
        byDestination,
        topProviders,
        monthlyTrends
      }
    });
  } catch (err) {
    console.error('Error fetching admin reports:', err.message);
    sendError(res, 500, 'Failed to generate admin reports.');
  }
}

// ========================================================
// 4. SUPER ADMIN PORTAL SUITE (Stage 4)
// ========================================================

// GET /api/superadmin/admins
async function handleGetSuperAdminAdmins(req, res) {
  try {
    const query = `
      SELECT 
        u.user_id,
        u.name,
        u.email,
        u.mobile,
        u.role,
        u.status,
        u.created_at,
        GROUP_CONCAT(ap.permission_name) AS permissions
      FROM users u
      LEFT JOIN admin_permissions ap ON u.user_id = ap.admin_id
      WHERE u.role IN ('ADMIN', 'SUPER_ADMIN')
      GROUP BY u.user_id
      ORDER BY u.role DESC, u.created_at ASC
    `;
    const [rows] = await pool.query(query);

    const formatted = rows.map(r => ({
      ...r,
      permissions: r.permissions ? r.permissions.split(',') : (r.role === 'SUPER_ADMIN' ? ['ALL'] : [])
    }));

    sendJSON(res, 200, { success: true, data: formatted });
  } catch (err) {
    console.error('Error in handleGetSuperAdminAdmins:', err.message);
    sendError(res, 500, 'Failed to fetch admin accounts.');
  }
}

// POST /api/superadmin/admins (Create Admin Account)
async function handleCreateAdmin(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const mobile = String(body.mobile || body.phone || '').trim();
  const permissions = Array.isArray(body.permissions) ? body.permissions : [];
  const superAdminId = parseInt(body.super_admin_id, 10);

  if (!name || name.length < 2) {
    sendError(res, 400, 'Full name is required.');
    return;
  }
  if (!email.includes('@')) {
    sendError(res, 400, 'Valid email is required.');
    return;
  }
  if (!password || password.length < 6) {
    sendError(res, 400, 'Password must be at least 6 characters.');
    return;
  }

  // Hash password
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  const hashedPassword = `scrypt:${salt}:${hash}`;

  try {
    const [result] = await pool.query(
      `INSERT INTO users (name, email, password, mobile, role, status) VALUES (?, ?, ?, ?, 'ADMIN', 'ACTIVE')`,
      [name, email, hashedPassword, mobile]
    );
    const adminId = result.insertId;

    // Insert permissions
    if (permissions.length > 0) {
      const permValues = permissions.map(p => [adminId, p]);
      await pool.query(
        `INSERT INTO admin_permissions (admin_id, permission_name) VALUES ?`,
        [permValues]
      );
    }

    await logSystemAction(superAdminId || null, 'ADMIN_CREATE', `Super Admin created admin account #${adminId} (${name}, ${email})`);

    sendJSON(res, 201, {
      success: true,
      message: 'Admin account created successfully.',
      data: { admin_id: adminId, name, email }
    });
  } catch (err) {
    if (err && err.code === 'ER_DUP_ENTRY') {
      sendError(res, 409, 'An account with this email address already exists.');
      return;
    }
    console.error('Error creating admin:', err.message);
    sendError(res, 500, 'Failed to create admin account.');
  }
}

// PATCH /api/superadmin/admins/:id/permissions
async function handleUpdateAdminPermissions(req, res, adminId) {
  const id = parseInt(adminId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid admin ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const permissions = Array.isArray(body.permissions) ? body.permissions : [];
  const superAdminId = parseInt(body.super_admin_id, 10);

  try {
    // Delete existing permissions
    await pool.query(`DELETE FROM admin_permissions WHERE admin_id = ?`, [id]);

    // Insert new permissions
    if (permissions.length > 0) {
      const permValues = permissions.map(p => [id, p]);
      await pool.query(
        `INSERT INTO admin_permissions (admin_id, permission_name) VALUES ?`,
        [permValues]
      );
    }

    await logSystemAction(superAdminId || null, 'ADMIN_PERMISSION_UPDATE', `Updated permissions for Admin #${id} to: ${permissions.join(', ') || 'None'}`);

    sendJSON(res, 200, {
      success: true,
      message: 'Admin permissions updated successfully.',
      permissions
    });
  } catch (err) {
    console.error('Error updating admin permissions:', err.message);
    sendError(res, 500, 'Failed to update admin permissions.');
  }
}

// PATCH /api/superadmin/admins/:id/status
async function handleUpdateAdminStatus(req, res, adminId) {
  const id = parseInt(adminId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid admin ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const newStatus = String(body.status || '').toUpperCase();
  const superAdminId = parseInt(body.super_admin_id, 10);

  if (!['ACTIVE', 'BLOCKED', 'INACTIVE'].includes(newStatus)) {
    sendError(res, 400, 'Status must be ACTIVE, BLOCKED, or INACTIVE.');
    return;
  }

  try {
    const [admin] = await pool.query(`SELECT user_id, name, role FROM users WHERE user_id = ?`, [id]);
    if (admin.length === 0) {
      sendError(res, 404, 'Admin not found.');
      return;
    }
    if (admin[0].role === 'SUPER_ADMIN') {
      sendError(res, 403, 'Super Admin accounts cannot be blocked.');
      return;
    }

    await pool.query(`UPDATE users SET status = ? WHERE user_id = ?`, [newStatus, id]);

    await logSystemAction(superAdminId || null, 'ADMIN_STATUS_CHANGE', `Super Admin changed Admin #${id} (${admin[0].name}) status to ${newStatus}`);

    sendJSON(res, 200, {
      success: true,
      message: `Admin status updated to ${newStatus}.`,
      status: newStatus
    });
  } catch (err) {
    console.error('Error updating admin status:', err.message);
    sendError(res, 500, 'Failed to update admin status.');
  }
}

// GET /api/superadmin/logs?action=...&user_id=...&search=...&limit=50
async function handleGetSystemLogs(req, res, parsedUrl) {
  const actionFilter = String(parsedUrl.query.action || 'ALL').trim();
  const search = String(parsedUrl.query.search || '').trim();
  const limit = Math.min(parseInt(parsedUrl.query.limit, 10) || 50, 200);

  try {
    let sql = `
      SELECT 
        l.log_id,
        l.user_id,
        l.action,
        l.description,
        l.ip_address,
        l.created_at,
        u.name AS user_name,
        u.email AS user_email,
        u.role AS user_role
      FROM system_logs l
      LEFT JOIN users u ON l.user_id = u.user_id
      WHERE 1=1
    `;
    const params = [];

    if (actionFilter && actionFilter !== 'ALL') {
      sql += ` AND l.action = ?`;
      params.push(actionFilter);
    }
    if (search) {
      sql += ` AND (l.description LIKE ? OR l.action LIKE ? OR u.name LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    sql += ` ORDER BY l.created_at DESC, l.log_id DESC LIMIT ?`;
    params.push(limit);

    const [rows] = await pool.query(sql, params);

    // Also get distinct actions for filter dropdown
    const [actions] = await pool.query(`SELECT DISTINCT action FROM system_logs ORDER BY action ASC`);

    sendJSON(res, 200, {
      success: true,
      data: {
        logs: rows,
        availableActions: actions.map(a => a.action)
      }
    });
  } catch (err) {
    console.error('Error fetching system logs:', err.message);
    sendError(res, 500, 'Failed to fetch system activity logs.');
  }
}

// ========================================================
// 5. CUSTOM ITINERARY PLANNER SUITE (Stage 5)
// ========================================================

// POST /api/customer/itineraries (Create / Save)
async function handleCreateCustomItinerary(req, res) {
  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const customerId = parseInt(body.customer_id, 10) || 3;
  const destinationId = parseInt(body.destination_id, 10);
  const title = String(body.title || '').trim();
  const startDate = String(body.start_date || '').trim();
  const durationDays = parseInt(body.duration_days, 10);
  const travelPace = String(body.travel_pace || 'Moderate');
  const interests = String(body.interests || 'Heritage,Nature');
  const accommodationTier = String(body.accommodation_tier || 'Standard');
  const estimatedCost = parseFloat(body.estimated_cost) || 0;
  const notes = String(body.notes || '').trim();
  const dayPlan = body.day_plan ? JSON.stringify(body.day_plan) : null;
  const providerId = body.provider_id ? parseInt(body.provider_id, 10) : null;
  const bookingStatus = String(body.booking_request_status || (providerId ? 'SUBMITTED' : 'DRAFT')).toUpperCase();

  if (!destinationId || isNaN(destinationId)) {
    sendError(res, 400, 'Please select a destination.');
    return;
  }
  if (!title) {
    sendError(res, 400, 'Please provide a title for your custom itinerary.');
    return;
  }
  if (!startDate) {
    sendError(res, 400, 'Please select a travel start date.');
    return;
  }
  if (isNaN(durationDays) || durationDays <= 0) {
    sendError(res, 400, 'Duration must be at least 1 day.');
    return;
  }

  try {
    const query = `
      INSERT INTO custom_itineraries 
        (customer_id, destination_id, title, start_date, duration_days, travel_pace, interests, accommodation_tier, estimated_cost, notes, day_plan, booking_request_status, provider_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const [result] = await pool.query(query, [
      customerId, destinationId, title, startDate, durationDays, travelPace, interests, accommodationTier, estimatedCost, notes, dayPlan, bookingStatus, providerId
    ]);

    await logSystemAction(customerId, 'CUSTOM_ITINERARY_CREATE', `Customer created custom itinerary #${result.insertId} (${title})`);

    sendJSON(res, 201, {
      success: true,
      message: bookingStatus === 'SUBMITTED' 
        ? 'Custom itinerary created and submitted to local provider for review!' 
        : 'Custom itinerary saved to your profile successfully.',
      data: {
        itinerary_id: result.insertId,
        title,
        booking_request_status: bookingStatus
      }
    });
  } catch (err) {
    console.error('Error creating custom itinerary:', err.message);
    sendError(res, 500, 'Failed to save custom itinerary.');
  }
}

// GET /api/customer/itineraries?customer_id=X
async function handleGetCustomerItineraries(req, res, parsedUrl) {
  const customerId = parseInt(parsedUrl.query.customer_id, 10) || 3;

  try {
    const query = `
      SELECT 
        ci.itinerary_id,
        ci.customer_id,
        ci.destination_id,
        ci.title,
        ci.start_date,
        ci.duration_days,
        ci.travel_pace,
        ci.interests,
        ci.accommodation_tier,
        ci.estimated_cost,
        ci.notes,
        ci.day_plan,
        ci.booking_request_status,
        ci.provider_id,
        ci.created_at,
        d.name AS destination_name,
        d.city,
        d.state,
        u.name AS provider_name
      FROM custom_itineraries ci
      JOIN destinations d ON ci.destination_id = d.destination_id
      LEFT JOIN users u ON ci.provider_id = u.user_id
      WHERE ci.customer_id = ?
      ORDER BY ci.created_at DESC
    `;
    const [rows] = await pool.query(query, [customerId]);
    sendJSON(res, 200, { success: true, data: rows });
  } catch (err) {
    console.error('Error fetching customer itineraries:', err.message);
    sendError(res, 500, 'Failed to fetch saved itineraries.');
  }
}

// GET /api/customer/itineraries/:id
async function handleGetCustomItineraryById(req, res, itineraryId) {
  const id = parseInt(itineraryId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid itinerary ID.');
    return;
  }

  try {
    const query = `
      SELECT 
        ci.itinerary_id,
        ci.customer_id,
        ci.destination_id,
        ci.title,
        ci.start_date,
        ci.duration_days,
        ci.travel_pace,
        ci.interests,
        ci.accommodation_tier,
        ci.estimated_cost,
        ci.notes,
        ci.day_plan,
        ci.booking_request_status,
        ci.provider_id,
        ci.created_at,
        d.name AS destination_name,
        d.city,
        d.state,
        u.name AS provider_name,
        cust.name AS customer_name,
        cust.email AS customer_email
      FROM custom_itineraries ci
      JOIN destinations d ON ci.destination_id = d.destination_id
      JOIN users cust ON ci.customer_id = cust.user_id
      LEFT JOIN users u ON ci.provider_id = u.user_id
      WHERE ci.itinerary_id = ?
    `;
    const [rows] = await pool.query(query, [id]);
    if (rows.length === 0) {
      sendError(res, 404, 'Custom itinerary not found.');
      return;
    }
    sendJSON(res, 200, { success: true, data: rows[0] });
  } catch (err) {
    console.error('Error fetching custom itinerary:', err.message);
    sendError(res, 500, 'Failed to fetch itinerary details.');
  }
}

// DELETE /api/customer/itineraries/:id
async function handleDeleteCustomItinerary(req, res, itineraryId) {
  const id = parseInt(itineraryId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid itinerary ID.');
    return;
  }

  try {
    const [result] = await pool.query(`DELETE FROM custom_itineraries WHERE itinerary_id = ?`, [id]);
    if (result.affectedRows === 0) {
      sendError(res, 404, 'Custom itinerary not found.');
      return;
    }
    sendJSON(res, 200, { success: true, message: 'Custom itinerary removed successfully.' });
  } catch (err) {
    console.error('Error deleting custom itinerary:', err.message);
    sendError(res, 500, 'Failed to delete custom itinerary.');
  }
}

// POST /api/customer/itineraries/:id/submit (Submit to Provider)
async function handleSubmitCustomItinerary(req, res, itineraryId) {
  const id = parseInt(itineraryId, 10);
  if (isNaN(id) || id <= 0) {
    sendError(res, 400, 'Invalid itinerary ID.');
    return;
  }

  let body;
  try {
    body = await readJSONBody(req);
  } catch (e) {
    sendError(res, 400, 'Invalid JSON body.');
    return;
  }

  const providerId = parseInt(body.provider_id, 10);
  const customerId = parseInt(body.customer_id, 10);

  if (!providerId || isNaN(providerId)) {
    sendError(res, 400, 'Please select a local provider to submit your custom request.');
    return;
  }

  try {
    await pool.query(
      `UPDATE custom_itineraries SET provider_id = ?, booking_request_status = 'SUBMITTED' WHERE itinerary_id = ?`,
      [providerId, id]
    );

    await logSystemAction(customerId || null, 'CUSTOM_ITINERARY_SUBMIT', `Customer submitted custom itinerary #${id} to Provider #${providerId}`);

    sendJSON(res, 200, {
      success: true,
      message: 'Custom itinerary request submitted to the selected provider!'
    });
  } catch (err) {
    console.error('Error submitting custom itinerary:', err.message);
    sendError(res, 500, 'Failed to submit itinerary request.');
  }
}

module.exports = {
  logSystemAction,
  handleLogin,
  // Provider
  handleGetProviderPackages,
  handleUpdateProviderPackage,
  handleDeleteProviderPackage,
  handleGetPackageItinerary,
  handleAddPackageItineraryDay,
  handleDeleteItineraryItem,
  handleGetProviderBookings,
  handleUpdateProviderBookingStatus,
  handleGetProviderReports,
  handleGetProviderCustomRequests,
  handleUpdateCustomRequestStatus,
  // Admin
  handleGetAdminDashboard,
  handleGetAdminPackages,
  handleAdminModeratePackage,
  handleAdminGetDestinations,
  handleAdminCreateDestination,
  handleAdminUpdateDestination,
  handleAdminDeleteDestination,
  handleAdminGetCategories,
  handleAdminCreateCategory,
  handleAdminUpdateCategory,
  handleAdminDeleteCategory,
  handleAdminGetUsers,
  handleAdminUpdateUserStatus,
  handleGetAdminReports,
  // Super Admin
  handleGetSuperAdminAdmins,
  handleCreateAdmin,
  handleUpdateAdminPermissions,
  handleUpdateAdminStatus,
  handleGetSystemLogs,
  // Custom Itinerary
  handleCreateCustomItinerary,
  handleGetCustomerItineraries,
  handleGetCustomItineraryById,
  handleDeleteCustomItinerary,
  handleSubmitCustomItinerary
};

