/**
 * Comprehensive Backend and Static Serving Test Suite for Member 3
 */
require('dotenv').config();
const http = require('http');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const BASE = `http://localhost:${PORT}`;

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const req = http.request({
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, text: data, headers: res.headers });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  console.log('=======================================================');
  console.log('   Starting Full End-to-End Member 3 Test Suite       ');
  console.log('=======================================================');
  let passed = 0;
  let total = 0;

  function assert(name, condition, extra = '') {
    total++;
    if (condition) {
      passed++;
      console.log(`✅ PASS: ${name}`);
    } else {
      console.error(`❌ FAIL: ${name} ${extra}`);
    }
  }

  try {
    // --------------------------------------------------------
    // STAGE 1: Static Files Serving Verification
    // --------------------------------------------------------
    console.log('\n--- Checking Static HTML & JS Assets Delivery ---');
    const staticEndpoints = [
      '/login.html',
      '/provider/dashboard.html',
      '/js/provider-dashboard.js',
      '/admin/dashboard.html',
      '/admin/admin.js',
      '/superadmin/dashboard.html',
      '/superadmin/superadmin.js',
      '/customer/itinerary-planner.html',
      '/js/itinerary-planner.js',
      '/customer/my-bookings.html',
      '/customer/booking.html',
      '/packages.html',
      '/destinations.html',
      '/index.html'
    ];

    for (const ep of staticEndpoints) {
      const res = await request('GET', ep);
      assert(`Static File Served [${ep}]`, res.status === 200 && (res.text || res.body));
    }

    // --------------------------------------------------------
    // STAGE 2: Multi-Role Authentication & Audit Logging
    // --------------------------------------------------------
    console.log('\n--- Testing Authentication & Audit System Logs ---');
    const roles = [
      { email: 'admin@roamly.in', role: 'ADMIN' },
      { email: 'superadmin@roamly.in', role: 'SUPER_ADMIN' },
      { email: 'heritage@roamly.in', role: 'PROVIDER' },
      { email: 'aarav@customer.in', role: 'CUSTOMER' }
    ];

    for (const r of roles) {
      const login = await request('POST', '/api/auth/login', { email: r.email, password: 'demoPassword123' });
      assert(`Login for ${r.role} (${r.email})`, login.status === 200 && login.body.data.role === r.role);
    }

    const badLogin = await request('POST', '/api/auth/login', { email: 'nonexistent@user.com' });
    assert('Reject Unregistered User', badLogin.status === 401);

    // --------------------------------------------------------
    // STAGE 3: Provider Portal REST APIs
    // --------------------------------------------------------
    console.log('\n--- Testing Provider Portal APIs ---');
    const provPkgs = await request('GET', '/api/provider/packages?provider_id=1');
    assert('GET /api/provider/packages', provPkgs.status === 200 && Array.isArray(provPkgs.body.data));

    const updatePkg = await request('PUT', '/api/provider/packages/1', {
      provider_id: 1,
      title: 'Kerala Backwaters & Munnar Tea Estates (Updated)',
      destination_id: 1,
      category_id: 2,
      duration_days: 5,
      price: 25999.00,
      capacity: 16,
      image: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944',
      description: 'Updated luxury houseboat journey'
    });
    assert('PUT /api/provider/packages/1 (Edit Package)', updatePkg.status === 200 && updatePkg.body.success);

    const getItin = await request('GET', '/api/provider/packages/1/itinerary');
    assert('GET /api/provider/packages/1/itinerary', getItin.status === 200 && Array.isArray(getItin.body.data));

    const addItin = await request('POST', '/api/provider/packages/1/itinerary', {
      day_no: 7,
      title: 'Heritage Farewell Breakfast',
      description: 'Traditional morning breakfast and souvenir shopping.'
    });
    assert('POST /api/provider/packages/1/itinerary (Add Day)', addItin.status === 201 && addItin.body.success);

    const provBookings = await request('GET', '/api/provider/bookings?provider_id=1');
    assert('GET /api/provider/bookings', provBookings.status === 200 && Array.isArray(provBookings.body.data));

    if (provBookings.body.data && provBookings.body.data.length > 0) {
      const b = provBookings.body.data[0];
      const patchB = await request('PATCH', `/api/provider/bookings/${b.booking_id}/status`, {
        provider_id: 1,
        status: 'CONFIRMED'
      });
      assert('PATCH /api/provider/bookings/:id/status (Confirm)', patchB.status === 200 && patchB.body.status === 'CONFIRMED');
    }

    const provReports = await request('GET', '/api/provider/reports?provider_id=1');
    assert('GET /api/provider/reports', provReports.status === 200 && provReports.body.data.summary);

    const provCustReq = await request('GET', '/api/provider/custom-requests?provider_id=1');
    assert('GET /api/provider/custom-requests', provCustReq.status === 200 && Array.isArray(provCustReq.body.data));

    // --------------------------------------------------------
    // STAGE 4: Central Admin Portal APIs
    // --------------------------------------------------------
    console.log('\n--- Testing Central Admin Console APIs ---');
    const adminDash = await request('GET', '/api/admin/dashboard');
    assert('GET /api/admin/dashboard', adminDash.status === 200 && adminDash.body.data.packages);

    const adminPkgs = await request('GET', '/api/admin/packages');
    assert('GET /api/admin/packages', adminPkgs.status === 200 && Array.isArray(adminPkgs.body.data));

    const modPkg = await request('PATCH', '/api/admin/packages/1/status', {
      admin_id: 5,
      status: 'APPROVED',
      note: 'Verified quality assurance'
    });
    assert('PATCH /api/admin/packages/1/status (Approve)', modPkg.status === 200 && modPkg.body.status === 'APPROVED');

    const adminDests = await request('GET', '/api/admin/destinations');
    assert('GET /api/admin/destinations', adminDests.status === 200 && Array.isArray(adminDests.body.data));

    const createDest = await request('POST', '/api/admin/destinations', {
      admin_id: 5,
      name: 'Rishikesh Yoga & Rapids',
      city: 'Rishikesh',
      state: 'Uttarakhand',
      country: 'India',
      description: 'Capital of yoga, sacred Ganges meditation ghats, and river rafting.',
      status: 'ACTIVE'
    });
    assert('POST /api/admin/destinations (Create)', createDest.status === 201 && createDest.body.data.destination_id);

    const adminCats = await request('GET', '/api/admin/categories');
    assert('GET /api/admin/categories', adminCats.status === 200 && Array.isArray(adminCats.body.data));

    const adminUsers = await request('GET', '/api/admin/users');
    assert('GET /api/admin/users', adminUsers.status === 200 && Array.isArray(adminUsers.body.data));

    const patchUser = await request('PATCH', '/api/admin/users/8/status', {
      admin_id: 5,
      status: 'ACTIVE'
    });
    assert('PATCH /api/admin/users/:id/status (Approve Provider)', patchUser.status === 200 && patchUser.body.status === 'ACTIVE');

    const adminReports = await request('GET', '/api/admin/reports');
    assert('GET /api/admin/reports', adminReports.status === 200 && adminReports.body.data.summary);

    // --------------------------------------------------------
    // STAGE 5: Super Admin Portal & Audit Logs
    // --------------------------------------------------------
    console.log('\n--- Testing Super Admin Governance & Audit Logs ---');
    const superAdmins = await request('GET', '/api/superadmin/admins');
    assert('GET /api/superadmin/admins', superAdmins.status === 200 && Array.isArray(superAdmins.body.data));

    const updatePerms = await request('PATCH', '/api/superadmin/admins/5/permissions', {
      super_admin_id: 6,
      permissions: ['MODERATE_PACKAGES', 'MANAGE_DESTINATIONS', 'MANAGE_CATEGORIES', 'MANAGE_USERS', 'VIEW_REPORTS']
    });
    assert('PATCH /api/superadmin/admins/5/permissions', updatePerms.status === 200 && updatePerms.body.permissions.length === 5);

    const superLogs = await request('GET', '/api/superadmin/logs');
    assert('GET /api/superadmin/logs (Audit Trail)', superLogs.status === 200 && superLogs.body.data.logs.length > 0);

    // --------------------------------------------------------
    // STAGE 6: Customer Personalized Itinerary Planner
    // --------------------------------------------------------
    console.log('\n--- Testing Personalized Itinerary Planner ---');
    const createCustom = await request('POST', '/api/customer/itineraries', {
      customer_id: 3,
      destination_id: 1,
      title: 'Munnar & Alleppey Explorer Plan',
      start_date: '2026-12-25',
      duration_days: 3,
      travel_pace: 'Moderate',
      interests: 'Nature,Food',
      accommodation_tier: 'Standard',
      estimated_cost: 29500.00,
      notes: 'Need private car transfer with English speaking guide',
      day_plan: [
        { day: 1, morning: 'Arrive at Kochi, scenic drive to Munnar', afternoon: 'Tea museum & spice garden walk', evening: 'Sunset viewpoints' },
        { day: 2, morning: 'Eravikulam National park trek', afternoon: 'Cheeyappara waterfall photo stop', evening: 'Kathakali show' },
        { day: 3, morning: 'Alleppey houseboat boarding', afternoon: 'Canal cruise lunch', evening: 'Return to Kochi airport' }
      ]
    });
    assert('POST /api/customer/itineraries (Save Plan)', createCustom.status === 201 && createCustom.body.data.itinerary_id);

    const itinId = createCustom.body.data.itinerary_id;
    const getCustPlans = await request('GET', '/api/customer/itineraries?customer_id=3');
    assert('GET /api/customer/itineraries', getCustPlans.status === 200 && getCustPlans.body.data.length > 0);

    const submitPlan = await request('POST', `/api/customer/itineraries/${itinId}/submit`, {
      customer_id: 3,
      provider_id: 1
    });
    assert('POST /api/customer/itineraries/:id/submit (Submit to Operator)', submitPlan.status === 200 && submitPlan.body.success);

  } catch (err) {
    console.error('Test execution error:', err);
  }

  console.log(`\n=======================================================`);
  console.log(`FINAL TEST REPORT: ${passed} / ${total} tests passed.`);
  console.log(`=======================================================\n`);

  process.exit(passed === total ? 0 : 1);
}

require('./server');
setTimeout(runTests, 1200);
