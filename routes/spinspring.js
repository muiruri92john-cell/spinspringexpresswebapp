// routes/spinspring.js
const express = require('express');
const router = express.Router();
const crypto = require('crypto');

// Auth Middleware
function isAuth(req, res, next) {
  if (req.session.spinUser) return next();
  req.flash('error_msg', 'Please login first');
  res.redirect('/login');
}

function isOwner(req, res, next) {
  if (req.session.spinUser && req.session.spinUser.role === 'owner') return next();
  req.flash('error_msg', 'Owner access required');
  res.redirect('/login');
}

function isAttendant(req, res, next) {
  if (req.session.spinUser && (req.session.spinUser.role === 'attendant' || req.session.spinUser.role === 'owner')) return next();
  req.flash('error_msg', 'Attendant access required');
  res.redirect('/attendant-login');
}

function isCustomer(req, res, next) {
  if (req.session.spinUser && req.session.spinUser.role === 'customer') return next();
  req.flash('error_msg', 'Customer access required');
  res.redirect('/customer-login');
}

// ============ LANDING PAGE ============
router.get('/', (req, res) => {
  res.render('spinspring/landing', {
    title: 'SpinSpring - Smart Laundry Automation',
    user: req.session.spinUser || null
  });
});

// ============ OWNER LOGIN ============
router.get('/login', (req, res) => {
  if (req.session.spinUser) return res.redirect('/owner-dashboard');
  res.render('spinspring/login', {
    title: 'Login - SpinSpring',
    error: null
  });
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    const [users] = await req.db.query('SELECT * FROM ss_users WHERE email = ? AND is_active = 1', [email]);

    if (users.length === 0) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/login');
    }

    const match = await bcrypt.compare(password, users[0].password);
    if (!match) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/login');
    }

    req.session.spinUser = {
      id: users[0].id,
      email: users[0].email,
      name: users[0].full_name,
      business: users[0].business_name,
      role: users[0].role || 'owner'
    };

    if (users[0].role === 'owner') res.redirect('/owner-dashboard');
    else if (users[0].role === 'attendant') res.redirect('/attendant-dashboard');
    else res.redirect('/customer-dashboard');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error_msg', 'Login failed');
    res.redirect('/login');
  }
});

// ============ REGISTER ============
router.get('/register', (req, res) => {
  res.render('spinspring/register', {
    title: 'Register - SpinSpring',
    error: null
  });
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, password2, full_name, business_name, phone } = req.body;
    const bcrypt = require('bcryptjs');

    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/register');
    }

    const [existing] = await req.db.query('SELECT id FROM ss_users WHERE email = ?', [email]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Email already registered');
      return res.redirect('/register');
    }

    const hash = await bcrypt.hash(password, 10);
    await req.db.query(
      "INSERT INTO ss_users (email, password, full_name, business_name, phone, role) VALUES (?, ?, ?, ?, ?, 'owner')",
      [email, hash, full_name, business_name, phone]
    );

    req.flash('success_msg', 'Account created! Login now.');
    res.redirect('/login');
  } catch (err) {
    console.error('Register error:', err);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/register');
  }
});

// ============ ROLE-SPECIFIC LOGINS ============
router.get('/owner-login', (req, res) => {
  res.render('spinspring/login', {
    title: 'Owner Login - SpinSpring',
    error: null,
    role: 'owner'
  });
});

router.get('/attendant-login', (req, res) => {
  res.render('spinspring/attendant-login', {
    title: 'Attendant Login - SpinSpring',
    error: null
  });
});

router.post('/attendant-login', async (req, res) => {
  try {
    const { email, pin_code } = req.body;
    const [attendants] = await req.db.query(
      'SELECT * FROM ss_attendants WHERE email = ? AND pin_code = ? AND is_active = 1',
      [email, pin_code]
    );

    if (attendants.length === 0) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/attendant-login');
    }

    req.session.spinUser = {
      id: attendants[0].id,
      email: attendants[0].email,
      name: attendants[0].full_name,
      role: 'attendant',
      ownerId: attendants[0].owner_id
    };

    res.redirect('/attendant-dashboard');
  } catch (err) {
    req.flash('error_msg', 'Login failed');
    res.redirect('/attendant-login');
  }
});

router.get('/customer-login', (req, res) => {
  res.render('spinspring/customer-login', {
    title: 'Customer Login - SpinSpring',
    error: null
  });
});

router.post('/customer-login', async (req, res) => {
  try {
    const { customer_id } = req.body;
    const [customers] = await req.db.query(
      'SELECT * FROM ss_customers WHERE customer_unique_id = ? AND is_active = 1',
      [customer_id]
    );

    if (customers.length === 0) {
      req.flash('error_msg', 'Invalid customer ID');
      return res.redirect('/customer-login');
    }

    req.session.spinUser = {
      id: customers[0].id,
      name: customers[0].full_name,
      customerId: customers[0].customer_unique_id,
      role: 'customer',
      ownerId: customers[0].owner_id
    };

    res.redirect('/customer-dashboard');
  } catch (err) {
    req.flash('error_msg', 'Login failed');
    res.redirect('/customer-login');
  }
});

// ============ OWNER DASHBOARD ============
router.get('/owner-dashboard', isOwner, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [devices] = await req.db.query('SELECT * FROM ss_devices WHERE owner_id = ?', [userId]);
    const [attendants] = await req.db.query('SELECT * FROM ss_attendants WHERE owner_id = ?', [userId]);
    const [customers] = await req.db.query('SELECT * FROM ss_customers WHERE owner_id = ?', [userId]);
    const [stats] = await req.db.query(
      'SELECT SUM(today_revenue) as today_rev, SUM(total_revenue) as total_rev, SUM(today_cycles) as today_cyc, SUM(cycles_completed) as total_cyc FROM ss_devices WHERE owner_id = ?',
      [userId]
    );

    res.render('spinspring/owner-dashboard', {
      title: 'Owner Dashboard - SpinSpring',
      user: req.session.spinUser,
      devices, attendants, customers,
      stats: stats[0] || {}
    });
  } catch (err) {
    console.error('Owner dashboard error:', err);
    res.render('spinspring/owner-dashboard', {
      title: 'Owner Dashboard',
      user: req.session.spinUser,
      devices: [], attendants: [], customers: [],
      stats: {}
    });
  }
});

// ============ ATTENDANT DASHBOARD ============
router.get('/attendant-dashboard', isAttendant, async (req, res) => {
  try {
    const ownerId = req.session.spinUser.ownerId || req.session.spinUser.id;
    const [devices] = await req.db.query('SELECT * FROM ss_devices WHERE owner_id = ?', [ownerId]);
    const [customers] = await req.db.query('SELECT * FROM ss_customers WHERE owner_id = ? AND is_active = 1', [ownerId]);
    const [activeOrders] = await req.db.query(
      "SELECT * FROM ss_orders WHERE user_id = ? AND order_status IN ('queued', 'in_progress') ORDER BY created_at DESC",
      [ownerId]
    );

    res.render('spinspring/attendant-dashboard', {
      title: 'Attendant Dashboard - SpinSpring',
      user: req.session.spinUser,
      devices, customers, activeOrders
    });
  } catch (err) {
    res.render('spinspring/attendant-dashboard', {
      title: 'Attendant Dashboard',
      user: req.session.spinUser,
      devices: [], customers: [], activeOrders: []
    });
  }
});

// Attendant: Create Order
router.post('/attendant/orders', isAttendant, async (req, res) => {
  try {
    const { device_id, customer_id, service_type, cycle_type, price } = req.body;
    const orderNumber = 'SS-' + Date.now().toString(36).toUpperCase();
    await req.db.query(
      "INSERT INTO ss_orders (order_number, device_id, user_id, customer_name, service_type, cycle_type, price, payment_status, order_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'queued')",
      [orderNumber, device_id, req.session.spinUser.ownerId || req.session.spinUser.id, customer_id, service_type, cycle_type, price]
    );
    req.flash('success_msg', 'Order created: ' + orderNumber);
    res.redirect('/attendant-dashboard');
  } catch (err) {
    req.flash('error_msg', 'Failed to create order');
    res.redirect('/attendant-dashboard');
  }
});

// ============ CUSTOMER DASHBOARD ============
router.get('/customer-dashboard', isCustomer, async (req, res) => {
  try {
    const customerId = req.session.spinUser.customerId;
    const [customerData] = await req.db.query('SELECT * FROM ss_customers WHERE customer_unique_id = ?', [customerId]);
    const [orders] = await req.db.query('SELECT * FROM ss_orders WHERE customer_name = ? ORDER BY created_at DESC LIMIT 20', [customerId]);
    const [activeOrders] = await req.db.query(
      "SELECT * FROM ss_orders WHERE customer_name = ? AND order_status IN ('queued', 'in_progress')",
      [customerId]
    );

    res.render('spinspring/customer-dashboard', {
      title: 'Customer Dashboard - SpinSpring',
      user: req.session.spinUser,
      customer: customerData[0] || {},
      orders, activeOrders
    });
  } catch (err) {
    res.render('spinspring/customer-dashboard', {
      title: 'Customer Dashboard',
      user: req.session.spinUser,
      customer: {}, orders: [], activeOrders: []
    });
  }
});

// ============ DEVICE MANAGEMENT ============
router.get('/register-device', isOwner, (req, res) => {
  res.render('spinspring/register-device', {
    title: 'Register Device - SpinSpring',
    error: null
  });
});

router.post('/register-device', isOwner, async (req, res) => {
  try {
    const { device_name, device_type, location, price_per_cycle } = req.body;
    const deviceId = 'SPIN-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const apiKey = 'SS-' + crypto.randomBytes(16).toString('hex');

    await req.db.query(
      "INSERT INTO ss_devices (device_id, device_name, device_type, api_key, owner_id, location_area, price_per_cycle, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'offline')",
      [deviceId, device_name, device_type, apiKey, req.session.spinUser.id, location, price_per_cycle || 300]
    );

    req.session.newSpinDevice = { device_id: deviceId, device_name, api_key };
    req.flash('success_msg', 'Machine registered!');
    res.redirect('/device-credentials');
  } catch (err) {
    req.flash('error_msg', 'Registration failed');
    res.redirect('/register-device');
  }
});

router.get('/device-credentials', isOwner, (req, res) => {
  const device = req.session.newSpinDevice;
  if (!device) return res.redirect('/owner-dashboard');
  delete req.session.newSpinDevice;
  res.render('spinspring/device-credentials', {
    title: 'Device Credentials - SpinSpring',
    device
  });
});

router.get('/device-detail/:id', isAuth, async (req, res) => {
  try {
    const deviceId = req.params.id;
    const [devices] = await req.db.query('SELECT * FROM ss_devices WHERE device_id = ?', [deviceId]);
    const [orders] = await req.db.query('SELECT * FROM ss_orders WHERE device_id = ? ORDER BY created_at DESC LIMIT 20', [deviceId]);

    res.render('spinspring/device-detail', {
      title: 'Device Detail - SpinSpring',
      device: devices[0] || { device_id: deviceId, device_name: 'Unknown', status: 'offline' },
      orders: orders || []
    });
  } catch (err) {
    res.redirect('/owner-dashboard');
  }
});

// ============ SETTINGS ============
router.get('/settings', isAuth, (req, res) => {
  res.render('spinspring/settings', {
    title: 'Settings - SpinSpring',
    user: req.session.spinUser || { name: 'User' }
  });
});

// ============ LOGOUT ============
router.get('/logout', (req, res) => {
  delete req.session.spinUser;
  res.redirect('/');
});

// ============ API ROUTES ============
router.get('/api/machines', async (req, res) => {
  try {
    const [machines] = await req.db.query('SELECT * FROM ss_devices');
    res.json({ success: true, machines });
  } catch (err) {
    res.json({ success: false, machines: [] });
  }
});

router.get('/api/stats', async (req, res) => {
  try {
    const [stats] = await req.db.query(
      'SELECT COUNT(*) as machines, SUM(cycles_completed) as cycles FROM ss_devices'
    );
    res.json({ success: true, stats: stats[0] });
  } catch (err) {
    res.json({ success: false, stats: {} });
  }
});

// Device Sync API
router.post('/api/sync', async (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'];
    const apiKey = req.headers['x-api-key'];
    if (!deviceId || !apiKey) return res.status(401).json({ error: 'Missing credentials' });

    const [devices] = await req.db.query('SELECT * FROM ss_devices WHERE device_id = ? AND api_key = ?', [deviceId, apiKey]);
    if (devices.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const data = req.body;
    await req.db.query(
      `UPDATE ss_devices SET status = ?, current_cycle = ?, cycle_progress = ?, water_temp = ?, water_level = ?, door_locked = ?, cycles_completed = ?, today_revenue = ?, total_revenue = ?, today_cycles = ?, last_sync = NOW() WHERE device_id = ?`,
      [
        data.status || 'idle', data.current_cycle || null, data.cycle_progress || 0,
        data.water_temp || 0, data.water_level || 0, data.door_locked ? 1 : 0,
        data.cycles_completed || 0, data.today_revenue || 0, data.total_revenue || 0,
        data.today_cycles || 0, deviceId
      ]
    );

    const [commands] = await req.db.query("SELECT * FROM ss_commands WHERE device_id = ? AND status = 'pending' LIMIT 5", [deviceId]);
    if (commands.length > 0) {
      const ids = commands.map(c => c.id);
      await req.db.query("UPDATE ss_commands SET status = 'sent' WHERE id IN (?)", [ids]);
    }

    res.json({
      status: 'success',
      commands: commands.map(c => ({ type: c.command_type, value: c.command_value })),
      current_price: devices[0].price_per_cycle
    });
  } catch (err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

// Time API
router.get('/api/time', (req, res) => {
  const now = new Date();
  res.json({
    timestamp: now.toISOString(),
    time: now.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour12: false }),
    date: now.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })
  });
});

// Create Attendant
router.post('/owner/attendants', isOwner, async (req, res) => {
  try {
    const { full_name, email, phone, pin_code } = req.body;
    const [existing] = await req.db.query('SELECT id FROM ss_attendants WHERE email = ? AND owner_id = ?', [email, req.session.spinUser.id]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Attendant email already exists');
      return res.redirect('/owner-dashboard');
    }
    await req.db.query('INSERT INTO ss_attendants (owner_id, full_name, email, phone, pin_code) VALUES (?, ?, ?, ?, ?)',
      [req.session.spinUser.id, full_name, email, phone, pin_code]);
    req.flash('success_msg', 'Attendant created!');
    res.redirect('/owner-dashboard');
  } catch (err) {
    req.flash('error_msg', 'Failed to create attendant');
    res.redirect('/owner-dashboard');
  }
});

// Create Customer
router.post('/owner/customers', isOwner, async (req, res) => {
  try {
    const { full_name, phone, email } = req.body;
    const customerId = 'CUST-' + Date.now().toString(36).toUpperCase().slice(-4) + '-' + Math.random().toString(36).toUpperCase().slice(-4);
    await req.db.query('INSERT INTO ss_customers (owner_id, customer_unique_id, full_name, phone, email) VALUES (?, ?, ?, ?, ?)',
      [req.session.spinUser.id, customerId, full_name, phone, email || null]);
    req.flash('success_msg', 'Customer created! ID: ' + customerId);
    res.redirect('/owner-dashboard');
  } catch (err) {
    req.flash('error_msg', 'Failed to create customer');
    res.redirect('/owner-dashboard');
  }
});

module.exports = router;