const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();

const mysql = require('mysql2/promise');
const db = mysql.createPool({
  host: '127.0.0.1',
  user: 'buxbtreu_spinspringuser',
  password: 'spinspring@2026',
  database: 'buxbtreu_spinspringwebappdb',
  port: 3306
});

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({ secret: 'spinspring_secure', resave: false, saveUninitialized: false }));
app.use(flash());

app.use((req, res, next) => {
  req.db = db;
  res.locals.success_msg = req.flash('success_msg') || [];
  res.locals.error_msg = req.flash('error_msg') || [];
  res.locals.user = req.session.spinUser || null;
  next();
});

function isAuth(req, res, next) {
  if (req.session.spinUser) return next();
  req.flash('error_msg', 'Please login first');
  res.redirect('/login');
}

// ========== LANDING ==========
app.get('/', (req, res) => {
  res.render('spinspring/landing', { title: 'SpinSpring Express - Smart Laundry' });
});

// ========== OWNER ==========
app.get('/login', (req, res) => {
  if (req.session.spinUser) return res.redirect('/owner');
  res.render('spinspring/login', { title: 'Owner Login - SpinSpring' });
});

app.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    const [users] = await db.query('SELECT * FROM ss_users WHERE email = ? AND is_active = 1', [email]);
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
    if (users[0].role === 'owner') res.redirect('/owner');
    else if (users[0].role === 'attendant') res.redirect('/attendant');
    else res.redirect('/customer');
  } catch(err) {
    req.flash('error_msg', 'Login failed');
    res.redirect('/login');
  }
});

app.get('/owner', isAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [devices] = await db.query('SELECT * FROM ss_devices WHERE owner_id = ?', [userId]);
    const [attendants] = await db.query('SELECT * FROM ss_attendants WHERE owner_id = ?', [userId]);
    const [customers] = await db.query('SELECT * FROM ss_customers WHERE owner_id = ?', [userId]);
    const [stats] = await db.query('SELECT SUM(today_revenue) as today_rev, SUM(total_revenue) as total_rev FROM ss_devices WHERE owner_id = ?', [userId]);
    res.render('spinspring/owner-dashboard', {
      title: 'Owner Panel - SpinSpring',
      devices, attendants, customers, stats: stats[0],
      user: req.session.spinUser
    });
  } catch(err) {
    res.render('spinspring/owner-dashboard', {
      title: 'Owner Panel', devices: [], attendants: [], customers: [], stats: {},
      user: req.session.spinUser
    });
  }
});

// Register Device
app.get('/register-device', isAuth, (req, res) => {
  res.render('spinspring/register-device', { title: 'Register Machine' });
});

app.post('/register-device', isAuth, async (req, res) => {
  try {
    const crypto = require('crypto');
    const { device_name, device_type, location, price_per_cycle } = req.body;
    const deviceId = 'SPIN-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const apiKey = 'SS-' + crypto.randomBytes(16).toString('hex');
    await db.query(
      "INSERT INTO ss_devices (device_id, device_name, device_type, api_key, owner_id, location_area, price_per_cycle, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'offline')",
      [deviceId, device_name, device_type, apiKey, req.session.spinUser.id, location, price_per_cycle || 300]
    );
    req.flash('success_msg', 'Machine registered!');
    res.redirect('/owner');
  } catch(err) {
    req.flash('error_msg', 'Registration failed');
    res.redirect('/register-device');
  }
});

// Create Attendant
app.post('/owner/attendants', isAuth, async (req, res) => {
  const { full_name, email, phone, pin_code } = req.body;
  await db.query('INSERT INTO ss_attendants (owner_id, full_name, email, phone, pin_code) VALUES (?, ?, ?, ?, ?)',
    [req.session.spinUser.id, full_name, email, phone, pin_code]);
  req.flash('success_msg', 'Attendant created!');
  res.redirect('/owner');
});

// Create Customer
app.post('/owner/customers', isAuth, async (req, res) => {
  const { full_name, phone, email } = req.body;
  const customerId = 'CUST-' + Date.now().toString(36).toUpperCase().slice(-4) + '-' + Math.random().toString(36).toUpperCase().slice(-4);
  await db.query('INSERT INTO ss_customers (owner_id, customer_unique_id, full_name, phone, email) VALUES (?, ?, ?, ?, ?)',
    [req.session.spinUser.id, customerId, full_name, phone, email || null]);
  req.flash('success_msg', 'Customer created! ID: ' + customerId);
  res.redirect('/owner');
});

// ========== ATTENDANT ==========
app.get('/attendant-login', (req, res) => {
  res.render('spinspring/attendant-login', { title: 'Attendant Login' });
});

app.post('/attendant-login', async (req, res) => {
  const { email, pin_code } = req.body;
  const [attendants] = await db.query('SELECT * FROM ss_attendants WHERE email = ? AND pin_code = ? AND is_active = 1', [email, pin_code]);
  if (attendants.length === 0) {
    req.flash('error_msg', 'Invalid credentials');
    return res.redirect('/attendant-login');
  }
  req.session.spinUser = {
    id: attendants[0].id,
    name: attendants[0].full_name,
    role: 'attendant',
    ownerId: attendants[0].owner_id
  };
  res.redirect('/attendant');
});

app.get('/attendant', isAuth, async (req, res) => {
  const ownerId = req.session.spinUser.ownerId || req.session.spinUser.id;
  const [devices] = await db.query('SELECT * FROM ss_devices WHERE owner_id = ?', [ownerId]);
  const [customers] = await db.query('SELECT * FROM ss_customers WHERE owner_id = ? AND is_active = 1', [ownerId]);
  res.render('spinspring/attendant-dashboard', {
    title: 'Attendant Panel',
    devices, customers, activeOrders: [],
    user: req.session.spinUser
  });
});

// Create Order
app.post('/attendant/orders', isAuth, async (req, res) => {
  const { device_id, customer_id, service_type, cycle_type, price } = req.body;
  const orderNumber = 'SS-' + Date.now().toString(36).toUpperCase();
  await db.query(
    "INSERT INTO ss_orders (order_number, device_id, user_id, customer_name, service_type, cycle_type, price, payment_status, order_status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', 'queued')",
    [orderNumber, device_id, req.session.spinUser.ownerId || req.session.spinUser.id, customer_id, service_type, cycle_type, price]
  );
  req.flash('success_msg', 'Order created!');
  res.redirect('/attendant');
});

// ========== CUSTOMER ==========
app.get('/customer-login', (req, res) => {
  res.render('spinspring/customer-login', { title: 'Customer Login' });
});

app.post('/customer-login', async (req, res) => {
  const { customer_id } = req.body;
  const [customers] = await db.query('SELECT * FROM ss_customers WHERE customer_unique_id = ? AND is_active = 1', [customer_id]);
  if (customers.length === 0) {
    req.flash('error_msg', 'Invalid customer ID');
    return res.redirect('/customer-login');
  }
  req.session.spinUser = {
    id: customers[0].id,
    name: customers[0].full_name,
    customerId: customers[0].customer_unique_id,
    role: 'customer'
  };
  res.redirect('/customer');
});

app.get('/customer', isAuth, async (req, res) => {
  const customerId = req.session.spinUser.customerId;
  const [customerData] = await db.query('SELECT * FROM ss_customers WHERE customer_unique_id = ?', [customerId]);
  const [orders] = await db.query('SELECT * FROM ss_orders WHERE customer_name = ? ORDER BY created_at DESC LIMIT 20', [customerId]);
  res.render('spinspring/customer-dashboard', {
    title: 'My Account',
    customer: customerData[0] || {},
    orders, activeOrders: [],
    user: req.session.spinUser
  });
});

// ========== LOGOUT ==========
app.get('/logout', (req, res) => {
  delete req.session.spinUser;
  res.redirect('/');
});

// ========== API: SYNC ==========
app.post('/api/sync', async (req, res) => {
  const deviceId = req.headers['x-device-id'];
  const apiKey = req.headers['x-api-key'];
  if (!deviceId || !apiKey) return res.status(401).json({ error: 'Missing credentials' });
  const [devices] = await db.query('SELECT * FROM ss_devices WHERE device_id = ? AND api_key = ?', [deviceId, apiKey]);
  if (devices.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
  const data = req.body;
  await db.query(
    `UPDATE ss_devices SET status = ?, current_cycle = ?, cycle_progress = ?, cycles_completed = ?, today_revenue = ?, total_revenue = ?, last_sync = NOW() WHERE device_id = ?`,
    [data.status || 'idle', data.current_cycle || null, data.cycle_progress || 0, data.cycles_completed || 0, data.today_revenue || 0, data.total_revenue || 0, deviceId]
  );
  const [commands] = await db.query("SELECT * FROM ss_commands WHERE device_id = ? AND status = 'pending' LIMIT 5", [deviceId]);
  if (commands.length > 0) {
    const ids = commands.map(c => c.id);
    await db.query("UPDATE ss_commands SET status = 'sent' WHERE id IN (?)", [ids]);
  }
  res.json({ status: 'success', commands: commands.map(c => ({ type: c.command_type, value: c.command_value })) });
});

// ========== 404 ==========
app.use((req, res) => {
  res.status(404).send('<h1>404 - Not Found</h1><a href="/">Home</a>');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log('SpinSpring Express running on port ' + PORT));