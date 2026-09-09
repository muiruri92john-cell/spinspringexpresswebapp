require('dotenv').config();
const express = require('express');
const session = require('express-session');
const flash = require('connect-flash');
const path = require('path');
const app = express();
const crypto = require('crypto');

// Database connection
const mysql = require('mysql2/promise');
const db = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  user: process.env.DB_USER || 'yxmvmjxp_ardthonuser',
  password: process.env.DB_PASSWORD || 'Ardthonuser254',
  database: process.env.DB_NAME || 'yxmvmjxp_ardthonsolutions',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

db.getConnection()
  .then(conn => { console.log('MySQL Connected'); conn.release(); })
  .catch(err => console.error('MySQL Error:', err.message));

// ============================================
// EMAIL CONFIGURATION
// ============================================
const nodemailer = require('nodemailer');

const emailTransporter = nodemailer.createTransport({
  host: 'localhost',
  port: 25,
  secure: false,
  tls: { rejectUnauthorized: false }
});

async function sendEmail(to, subject, html) {
  try {
    const info = await emailTransporter.sendMail({
      from: '"CuePay Alerts" <cuepayalerts@ardthonsolutions.com>',
      to: to,
      subject: subject,
      text: subject + ' - View your CuePay dashboard for details.',
      html: html
    });
    console.log('Email sent:', info.messageId);
    return true;
  } catch(err) {
    console.error('Email error:', err.message);
    return false;
  }
}

function isBusinessHours() {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  if (day === 0) return hour >= 10 && hour < 20;
  else if (day === 6) return hour >= 8 && hour < 22;
  else return hour >= 8 && hour < 22;
}

// ============================================
// VIEW ENGINE & MIDDLEWARE
// ============================================
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(session({
  secret: process.env.SESSION_SECRET || 'fallback_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 86400000, httpOnly: true }
}));
app.use(flash());

app.use((req, res, next) => {
  req.db = db;
  next();
});

app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.success_msg = req.flash('success_msg') || [];
  res.locals.error_msg = req.flash('error_msg') || [];
  res.locals.cartCount = req.session.cart ? req.session.cart.length : 0;
  res.locals.currentUrl = req.originalUrl;
  res.locals.appName = 'Ardthon Solutions';
  res.locals.year = new Date().getFullYear();
  next();
});

// ============================================
// SPINSPRING EJS RENDERING ROUTES
// ============================================

app.get('/spinspring', (req, res) => {
    res.render('spinspring/landing', { title: 'SpinSpring - Smart Laundry Automation', user: null });
});

app.get('/spinspring/login', (req, res) => {
    res.render('spinspring/login', { title: 'Login - SpinSpring', error: null });
});

app.get('/spinspring/register', (req, res) => {
    res.render('spinspring/register', { title: 'Register - SpinSpring', error: null });
});

app.get('/spinspring/owner-login', (req, res) => {
    res.render('spinspring/attendant-login', { title: 'Owner Login - SpinSpring', error: null });
});

app.get('/spinspring/attendant-login', (req, res) => {
    res.render('spinspring/attendant-login', { title: 'Attendant Login - SpinSpring', error: null });
});

app.get('/spinspring/customer-login', (req, res) => {
    res.render('spinspring/customer-login', { title: 'Customer Login - SpinSpring', error: null });
});

app.get('/spinspring/owner-dashboard', (req, res) => {
    res.render('spinspring/owner-dashboard', { title: 'Owner Dashboard - SpinSpring', user: { name: 'Owner', role: 'owner' } });
});

app.get('/spinspring/attendant-dashboard', (req, res) => {
    res.render('spinspring/attendant-dashboard', { title: 'Attendant Dashboard - SpinSpring', user: { name: 'Attendant', role: 'attendant' } });
});

app.get('/spinspring/customer-dashboard', (req, res) => {
    res.render('spinspring/customer-dashboard', { title: 'Customer Dashboard - SpinSpring', user: { name: 'Customer', role: 'customer' } });
});

app.get('/spinspring/register-device', (req, res) => {
    res.render('spinspring/register-device', { title: 'Register Device - SpinSpring', error: null });
});

app.get('/spinspring/device-detail/:id', (req, res) => {
    const deviceId = req.params.id;
    res.render('spinspring/device-detail', { title: 'Device Detail - SpinSpring', device: { id: deviceId, name: `Machine ${deviceId}`, status: 'Active' } });
});

app.get('/spinspring/settings', (req, res) => {
    res.render('spinspring/settings', { title: 'Settings - SpinSpring', user: { name: 'User' } });
});

app.get('/api/spinspring/machines', (req, res) => {
    res.json({ success: true, machines: [
        { id: 1, name: 'Machine 1', status: 'active', location: 'Laundry A' },
        { id: 2, name: 'Machine 2', status: 'idle', location: 'Laundry B' },
        { id: 3, name: 'Machine 3', status: 'active', location: 'Laundry A' },
        { id: 4, name: 'Machine 4', status: 'maintenance', location: 'Laundry C' }
    ]});
});

app.get('/api/spinspring/stats', (req, res) => {
    res.json({ success: true, stats: { machines: 4, cycles: 156, businesses: 3, uptime: '99.8%' } });
});

app.post('/api/spinspring/register-device', (req, res) => {
    res.json({ success: true, message: 'Device registered successfully', device: req.body });
});

// ============================================
// SUBDOMAIN DETECTION
// ============================================

app.use((req, res, next) => {
    const host = req.get('host');
    if (host && host.includes('spinspring.ardthonsolutions.com')) {
        req.isSpinSpring = true;
    }
    next();
});

app.get('/', (req, res, next) => {
    if (req.isSpinSpring) {
        res.render('spinspring/landing', { title: 'SpinSpring - Smart Laundry Automation', user: null });
    } else {
        next();
    }
});

// ============================================
// ROUTES - HOMEPAGE
// ============================================

app.get('/', async (req, res) => {
  try {
    let featuredProducts = [];
    let latestProjects = [];
    let latestBlogs = [];

    try {
      const [products] = await db.query('SELECT * FROM products WHERE featured = 1 LIMIT 8');
      featuredProducts = products.map(p => ({
        ...p,
        images: JSON.parse(p.images || '[]'),
        specifications: JSON.parse(p.specifications || '[]')
      }));
    } catch(e) { console.error('Products query error:', e.message); }

    try {
      const [projects] = await db.query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC LIMIT 3');
      latestProjects = projects.map(p => ({
        ...p,
        images: JSON.parse(p.images || '[]'),
        technologies: JSON.parse(p.technologies || '[]'),
        features: JSON.parse(p.features || '[]')
      }));
    } catch(e) { console.error('Projects query error:', e.message); }

    try {
      const [blogs] = await db.query("SELECT * FROM blogs WHERE status = 'published' ORDER BY createdAt DESC LIMIT 3");
      latestBlogs = blogs;
    } catch(e) { console.error('Blogs query error:', e.message); }

    res.render('index', {
      title: 'Ardthon Solutions - Connect With Ease',
      featuredProducts,
      latestProjects,
      latestBlogs
    });
  } catch(err) {
    console.error('Home error:', err.message);
    res.render('index', {
      title: 'Ardthon Solutions',
      featuredProducts: [],
      latestProjects: [],
      latestBlogs: []
    });
  }
});

// ============================================
// ATTENDX - SCHOOL GATE ATTENDANCE SYSTEM
// ============================================

function generateAttendXApiKey() {
  return 'AX-' + crypto.randomBytes(16).toString('hex');
}

function isAttendXAuth(req, res, next) {
  if (req.session.attendxUser) return next();
  req.flash('error_msg', 'Please login to AttendX first');
  res.redirect('/attendx/login');
}

app.get('/attendx/login', (req, res) => {
  if (req.session.attendxUser) return res.redirect('/attendx/dashboard');
  res.render('attendx/login', { title: 'AttendX Login - Ardthon Solutions' });
});

app.post('/attendx/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');

    const [users] = await db.query('SELECT * FROM attendx_users WHERE email = ? AND is_active = 1', [email]);

    if (users.length === 0) {
      req.flash('error_msg', 'Invalid AttendX credentials');
      return res.redirect('/attendx/login');
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      req.flash('error_msg', 'Invalid AttendX credentials');
      return res.redirect('/attendx/login');
    }

    req.session.attendxUser = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      institution: user.institution_name
    };

    req.flash('success_msg', 'Welcome to AttendX!');
    res.redirect('/attendx/dashboard');
  } catch(err) {
    console.error('AttendX login error:', err);
    req.flash('error_msg', 'Login failed');
    res.redirect('/attendx/login');
  }
});

app.get('/attendx/register', (req, res) => {
  res.render('attendx/register', { title: 'Register AttendX - Ardthon Solutions' });
});

app.post('/attendx/register', async (req, res) => {
  try {
    const { email, password, password2, full_name, institution_name, institution_type, phone } = req.body;
    const bcrypt = require('bcryptjs');

    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/attendx/register');
    }

    const [existing] = await db.query('SELECT id FROM attendx_users WHERE email = ?', [email]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Email already registered');
      return res.redirect('/attendx/register');
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO attendx_users (email, password, full_name, institution_name, institution_type, phone) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hash, full_name, institution_name, institution_type || 'School', phone]
    );

    req.flash('success_msg', 'AttendX account created! Please login.');
    res.redirect('/attendx/login');
  } catch(err) {
    console.error('AttendX register error:', err);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/attendx/register');
  }
});

app.get('/attendx/logout', (req, res) => {
  delete req.session.attendxUser;
  res.redirect('/attendx/login');
});

app.get('/attendx/dashboard', isAttendXAuth, async (req, res) => {
  try {
    const userId = req.session.attendxUser.id;

    const [devices] = await db.query(
      'SELECT * FROM attendx_devices WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );

    for (let device of devices) {
      const [todayEntries] = await db.query(
        "SELECT COUNT(*) as count FROM attendx_records WHERE device_id = ? AND event_type = 'entry' AND DATE(recorded_at) = CURDATE()",
        [device.device_id]
      );
      const [todayExits] = await db.query(
        "SELECT COUNT(*) as count FROM attendx_records WHERE device_id = ? AND event_type = 'exit' AND DATE(recorded_at) = CURDATE()",
        [device.device_id]
      );
      const [studentCount] = await db.query(
        'SELECT COUNT(*) as count FROM attendx_students WHERE device_id = ?',
        [device.device_id]
      );

      device.today_entries = todayEntries[0].count;
      device.today_exits = todayExits[0].count;
      device.student_count = studentCount[0].count;
      device.is_online = device.status === 'online';
    }

    res.render('attendx/dashboard', {
      title: 'AttendX Dashboard - Ardthon Solutions',
      devices,
      user: req.session.attendxUser
    });
  } catch(err) {
    console.error('AttendX dashboard error:', err);
    res.render('attendx/dashboard', {
      title: 'AttendX Dashboard',
      devices: [],
      user: req.session.attendxUser
    });
  }
});

app.get('/attendx/register-device', isAttendXAuth, (req, res) => {
  res.render('attendx/register-device', { title: 'Register AttendX Device' });
});

app.post('/attendx/register-device', isAttendXAuth, async (req, res) => {
  try {
    const { device_name, location, mode } = req.body;
    const ownerId = req.session.attendxUser.id;

    const deviceId = 'ATTENDX-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const apiKey = generateAttendXApiKey();

    await db.query(
      `INSERT INTO attendx_devices (device_id, device_name, api_key, owner_id, location_area, mode, status)
       VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
      [deviceId, device_name, apiKey, ownerId, location, mode || 'both']
    );

    req.session.newAttendXDevice = { device_id: deviceId, device_name, api_key: apiKey };
    req.flash('success_msg', 'Device registered successfully!');
    res.redirect('/attendx/device-credentials');
  } catch(err) {
    console.error('Device registration error:', err);
    req.flash('error_msg', 'Failed to register device');
    res.redirect('/attendx/register-device');
  }
});

app.get('/attendx/device-credentials', isAttendXAuth, (req, res) => {
  const device = req.session.newAttendXDevice;
  if (!device) return res.redirect('/attendx/dashboard');
  delete req.session.newAttendXDevice;
  res.render('attendx/device-credentials', { title: 'Device Credentials - AttendX', device });
});

app.get('/attendx/device/:deviceId', isAttendXAuth, async (req, res) => {
  try {
    const userId = req.session.attendxUser.id;
    const { deviceId } = req.params;

    const [devices] = await db.query(
      'SELECT * FROM attendx_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );

    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found');
      return res.redirect('/attendx/dashboard');
    }

    const device = devices[0];

    const [records] = await db.query(
      'SELECT * FROM attendx_records WHERE device_id = ? ORDER BY recorded_at DESC LIMIT 50',
      [deviceId]
    );

    const [students] = await db.query(
      'SELECT * FROM attendx_students WHERE device_id = ? ORDER BY full_name',
      [deviceId]
    );

    const [todayStats] = await db.query(
      `SELECT
        SUM(CASE WHEN event_type = 'entry' THEN 1 ELSE 0 END) as entries,
        SUM(CASE WHEN event_type = 'exit' THEN 1 ELSE 0 END) as exits
       FROM attendx_records
       WHERE device_id = ? AND DATE(recorded_at) = CURDATE()`,
      [deviceId]
    );

    res.render('attendx/device-detail', {
      title: `${device.device_name} - AttendX`,
      device,
      records,
      students,
      todayStats: todayStats[0]
    });
  } catch(err) {
    console.error('Device detail error:', err);
    res.redirect('/attendx/dashboard');
  }
});

app.post('/attendx/device/:deviceId/student', isAttendXAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { student_id, full_name, class_grade, parent_name, parent_phone, fingerprint_id } = req.body;

    await db.query(
      `INSERT INTO attendx_students (device_id, student_id, full_name, class_grade, parent_name, parent_phone, fingerprint_id)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE full_name=VALUES(full_name), class_grade=VALUES(class_grade), parent_name=VALUES(parent_name), parent_phone=VALUES(parent_phone)`,
      [deviceId, student_id, full_name, class_grade, parent_name, parent_phone, fingerprint_id || null]
    );

    req.flash('success_msg', 'Student registered!');
    res.redirect(`/attendx/device/${deviceId}`);
  } catch(err) {
    console.error('Add student error:', err);
    req.flash('error_msg', 'Failed to add student');
    res.redirect(`/attendx/device/${req.params.deviceId}`);
  }
});

// AttendX API
app.post('/attendx/api/sync', async (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'];
    const apiKey = req.headers['x-api-key'];

    if (!deviceId || !apiKey) {
      return res.status(401).json({ error: 'Missing credentials' });
    }

    const [devices] = await db.query(
      'SELECT * FROM attendx_devices WHERE device_id = ? AND api_key = ?',
      [deviceId, apiKey]
    );

    if (devices.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const data = req.body;

    await db.query(
      "UPDATE attendx_devices SET status = 'online', last_sync = NOW() WHERE device_id = ?",
      [deviceId]
    );

    if (data.events && Array.isArray(data.events)) {
      for (const event of data.events) {
        const [students] = await db.query(
          'SELECT * FROM attendx_students WHERE device_id = ? AND (student_id = ? OR fingerprint_id = ?)',
          [deviceId, event.student_id, event.fingerprint_id]
        );

        const student = students.length > 0 ? students[0] : null;

        await db.query(
          'INSERT INTO attendx_records (device_id, student_id, student_name, event_type, parent_phone, sms_sent) VALUES (?, ?, ?, ?, ?, ?)',
          [deviceId, event.student_id, student ? student.full_name : 'Unknown', event.event_type, student ? student.parent_phone : null, 0]
        );

        if (student && student.parent_phone) {
          const time = new Date().toLocaleTimeString('en-KE', { hour12: true });
          const action = event.event_type === 'entry' ? 'ARRIVED at' : 'DEPARTED from';
          const message = `${student.full_name} has ${action} school at ${time}. - ${devices[0].device_name}`;

          await db.query(
            "INSERT INTO attendx_sms_log (device_id, student_id, parent_phone, message, status) VALUES (?, ?, ?, ?, 'pending')",
            [deviceId, event.student_id, student.parent_phone, message]
          );
        }
      }
    }

    res.json({ status: 'success', message: 'Sync complete', timestamp: new Date().toISOString() });
  } catch(err) {
    console.error('AttendX sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

app.get('/attendx/api/dashboard-data', isAttendXAuth, async (req, res) => {
  try {
    const userId = req.session.attendxUser.id;
    const [devices] = await db.query(
      'SELECT device_id, device_name, status, last_sync FROM attendx_devices WHERE owner_id = ?',
      [userId]
    );

    for (let device of devices) {
      const [entries] = await db.query(
        "SELECT COUNT(*) as count FROM attendx_records WHERE device_id = ? AND event_type = 'entry' AND DATE(recorded_at) = CURDATE()",
        [device.device_id]
      );
      const [exits] = await db.query(
        "SELECT COUNT(*) as count FROM attendx_records WHERE device_id = ? AND event_type = 'exit' AND DATE(recorded_at) = CURDATE()",
        [device.device_id]
      );
      device.today_entries = entries[0].count;
      device.today_exits = exits[0].count;
    }

    res.json({ success: true, devices });
  } catch(err) {
    res.status(500).json({ success: false, error: 'Failed to load data' });
  }
});

// ============================================
// ALLERSAFE, ATTENDX, HEALTH ROUTES
// ============================================
const allersafeRoutes = require('./routes/allersafe');
const attendxRoutes = require('./routes/attendx');
const healthRoutes = require('./routes/health');
app.use('/allersafe', allersafeRoutes);
app.use('/attendx', attendxRoutes);
app.use('/health', healthRoutes);

// ============================================
// PRODUCTS
// ============================================
app.get('/products', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products ORDER BY createdAt DESC');
    const [cats] = await db.query('SELECT DISTINCT category FROM products');

    const formattedProducts = products.map(p => ({
      ...p,
      images: JSON.parse(p.images || '[]'),
      specifications: JSON.parse(p.specifications || '[]')
    }));

    res.render('products', {
      title: 'Products - Ardthon Solutions',
      products: formattedProducts,
      categories: cats.map(c => c.category),
      currentCategory: req.query.category || '',
      searchQuery: req.query.search || ''
    });
  } catch(err) {
    console.error('Products error:', err.message);
    res.render('products', {
      title: 'Products',
      products: [],
      categories: [],
      currentCategory: '',
      searchQuery: ''
    });
  }
});

app.get('/products/:slug', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products WHERE slug = ?', [req.params.slug]);

    if (products.length === 0) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/products');
    }

    const product = {
      ...products[0],
      images: JSON.parse(products[0].images || '[]'),
      specifications: JSON.parse(products[0].specifications || '[]')
    };

    const [related] = await db.query(
      'SELECT * FROM products WHERE category = ? AND id != ? LIMIT 4',
      [product.category, product.id]
    );

    res.render('product-detail', {
      title: `${product.name} - Ardthon Solutions`,
      product,
      relatedProducts: related.map(p => ({
        ...p,
        images: JSON.parse(p.images || '[]')
      }))
    });
  } catch(err) {
    console.error('Product detail error:', err.message);
    res.redirect('/products');
  }
});

// ============================================
// PROJECTS
// ============================================
app.get('/projects', async (req, res) => {
  try {
    const [projects] = await db.query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC');
    const [fields] = await db.query('SELECT DISTINCT field FROM projects WHERE isPublished = 1');

    const formattedProjects = projects.map(p => ({
      ...p,
      images: JSON.parse(p.images || '[]'),
      technologies: JSON.parse(p.technologies || '[]'),
      features: JSON.parse(p.features || '[]')
    }));

    res.render('projects', {
      title: 'Projects - Ardthon Solutions',
      projects: formattedProjects,
      fields: fields.map(f => f.field),
      currentField: req.query.field || ''
    });
  } catch(err) {
    console.error('Projects error:', err.message);
    res.render('projects', {
      title: 'Projects',
      projects: [],
      fields: [],
      currentField: ''
    });
  }
});

app.get('/projects/:slug', async (req, res) => {
  try {
    const [projects] = await db.query(
      'SELECT * FROM projects WHERE slug = ? AND isPublished = 1',
      [req.params.slug]
    );

    if (projects.length === 0) {
      req.flash('error_msg', 'Project not found');
      return res.redirect('/projects');
    }

    const project = {
      ...projects[0],
      images: JSON.parse(projects[0].images || '[]'),
      technologies: JSON.parse(projects[0].technologies || '[]'),
      features: JSON.parse(projects[0].features || '[]')
    };

    if (project.slug === 'cuepay-pool-automation') {
      return res.render('projects-cuepay', {
        title: 'CuePay - Pool Automation - Ardthon Solutions',
        project
      });
    }

    res.render('project-detail', {
      title: `${project.title} - Ardthon Solutions`,
      project
    });
  } catch(err) {
    console.error('Project detail error:', err.message);
    res.redirect('/projects');
  }
});

// ============================================
// BLOG
// ============================================
app.get('/blog', async (req, res) => {
  try {
    const [blogs] = await db.query(
      "SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.status = 'published' ORDER BY b.createdAt DESC"
    );

    res.render('blog', {
      title: 'Blog - Ardthon Solutions',
      blogs: blogs.map(b => ({ ...b, tags: JSON.parse(b.tags || '[]') }))
    });
  } catch(err) {
    console.error('Blog error:', err.message);
    res.render('blog', { title: 'Blog', blogs: [] });
  }
});

app.get('/blog/:slug', async (req, res) => {
  try {
    const [blogs] = await db.query(
      "SELECT b.*, u.username FROM blogs b LEFT JOIN users u ON b.authorId = u.id WHERE b.slug = ? AND b.status = 'published'",
      [req.params.slug]
    );

    if (blogs.length === 0) {
      req.flash('error_msg', 'Blog post not found');
      return res.redirect('/blog');
    }

    await db.query('UPDATE blogs SET views = views + 1 WHERE id = ?', [blogs[0].id]);

    res.render('blog-detail', {
      title: `${blogs[0].title} - Ardthon Solutions`,
      blog: { ...blogs[0], tags: JSON.parse(blogs[0].tags || '[]') }
    });
  } catch(err) {
    console.error('Blog detail error:', err.message);
    res.redirect('/blog');
  }
});

// ============================================
// AUTH
// ============================================
app.get('/auth/login', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/login', { title: 'Login - Ardthon Solutions' });
});

app.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    const [users] = await db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    const match = await bcrypt.compare(password, users[0].password);
    if (!match) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    req.session.user = {
      id: users[0].id,
      username: users[0].username,
      email: users[0].email,
      role: users[0].role,
      fullName: users[0].fullName
    };

    req.flash('success_msg', 'Welcome back!');
    res.redirect('/dashboard');
  } catch(err) {
    console.error('Login error:', err.message);
    req.flash('error_msg', 'Login failed');
    res.redirect('/auth/login');
  }
});

app.get('/auth/register', (req, res) => {
  if (req.session.user) return res.redirect('/dashboard');
  res.render('auth/register', { title: 'Create Account - Ardthon Solutions' });
});

app.post('/auth/register', async (req, res) => {
  try {
    const { username, email, password, password2, fullName } = req.body;
    const bcrypt = require('bcryptjs');

    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }

    const [existing] = await db.query('SELECT id FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Email or username already exists');
      return res.redirect('/auth/register');
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      "INSERT INTO users (username, email, password, fullName, role) VALUES (?, ?, ?, ?, 'customer')",
      [username, email, hash, fullName || '']
    );

    req.flash('success_msg', 'Registration successful! Please login.');
    res.redirect('/auth/login');
  } catch(err) {
    console.error('Register error:', err.message);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/auth/register');
  }
});

app.get('/auth/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/'));
});

// ============================================
// DASHBOARD
// ============================================
app.get('/dashboard', async (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');

  try {
    const [orders] = await db.query(
      'SELECT * FROM orders WHERE userId = ? ORDER BY createdAt DESC LIMIT 10',
      [req.session.user.id]
    );

    const [cuepayDevices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE owner_id = ?',
      [req.session.user.id]
    );

    res.render('dashboard', {
      title: 'Dashboard - Ardthon Solutions',
      orders,
      cuepayDevices,
      userData: req.session.user
    });
  } catch(err) {
    res.render('dashboard', {
      title: 'Dashboard',
      orders: [],
      cuepayDevices: [],
      userData: req.session.user
    });
  }
});

// ============================================
// CART & CHECKOUT
// ============================================
app.get('/orders/cart', (req, res) => {
  const cart = req.session.cart || [];
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('cart', { title: 'Shopping Cart - Ardthon Solutions', cart, total });
});

app.post('/products/add-to-cart/:id', async (req, res) => {
  try {
    const [products] = await db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) return res.status(404).json({ error: 'Not found' });

    const product = products[0];
    if (!req.session.cart) req.session.cart = [];

    const existing = req.session.cart.find(item => item.product == req.params.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      req.session.cart.push({
        product: product.id,
        name: product.name,
        price: product.price,
        image: JSON.parse(product.images || '[]')[0]?.url || '/images/placeholder.jpg',
        quantity: 1
      });
    }

    res.json({ success: true, cartCount: req.session.cart.length });
  } catch(err) {
    res.status(500).json({ error: 'Error adding to cart' });
  }
});

app.get('/orders/checkout', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  const cart = req.session.cart || [];
  if (cart.length === 0) return res.redirect('/products');
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('checkout', { title: 'Checkout - Ardthon Solutions', cart, total });
});

// ============================================
// CUEPAY COMPLETE SYSTEM
// ============================================

function generateApiKey() {
  return 'CP-' + crypto.randomBytes(16).toString('hex');
}

function isCuePayAuth(req, res, next) {
  if (req.session.cuepayUser) return next();
  req.flash('error_msg', 'Please login to CuePay first');
  res.redirect('/cuepay/login');
}

async function validateDeviceApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const deviceId = req.headers['x-device-id'];

  if (!apiKey || !deviceId) {
    return res.status(401).json({ error: 'Missing credentials. Send x-api-key and x-device-id headers' });
  }

  try {
    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE device_id = ? AND api_key = ?',
      [deviceId, apiKey]
    );

    if (devices.length === 0) {
      return res.status(401).json({ error: 'Invalid device credentials' });
    }

    req.cuepayDevice = devices[0];
    next();
  } catch(err) {
    res.status(500).json({ error: 'Authentication error' });
  }
}

// CuePay Pages
app.get('/cuepay', (req, res) => {
  res.render('cuepay/login', { title: 'CuePay - Pool Automation System' });
});

app.get('/cuepay/login', (req, res) => {
  if (req.session.cuepayUser) return res.redirect('/cuepay/dashboard');
  res.render('cuepay/login', { title: 'CuePay Login - Ardthon Solutions' });
});

app.post('/cuepay/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');

    const [users] = await db.query('SELECT * FROM cuepay_users WHERE email = ? AND is_active = 1', [email]);

    if (users.length === 0) {
      req.flash('error_msg', 'Invalid CuePay credentials');
      return res.redirect('/cuepay/login');
    }

    const user = users[0];
    const match = await bcrypt.compare(password, user.password);

    if (!match) {
      req.flash('error_msg', 'Invalid CuePay credentials');
      return res.redirect('/cuepay/login');
    }

    req.session.cuepayUser = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      business: user.business_name
    };

    req.flash('success_msg', 'Welcome to CuePay!');
    res.redirect('/cuepay/dashboard');
  } catch(err) {
    console.error('CuePay login error:', err);
    req.flash('error_msg', 'Login failed');
    res.redirect('/cuepay/login');
  }
});

app.get('/cuepay/register', (req, res) => {
  if (req.session.cuepayUser) return res.redirect('/cuepay/dashboard');
  res.render('cuepay/register', { title: 'Create CuePay Account' });
});

app.post('/cuepay/register', async (req, res) => {
  try {
    const { email, password, password2, full_name, business_name, phone } = req.body;
    const bcrypt = require('bcryptjs');

    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/cuepay/register');
    }

    if (password.length < 6) {
      req.flash('error_msg', 'Password must be at least 6 characters');
      return res.redirect('/cuepay/register');
    }

    const [existing] = await db.query('SELECT id FROM cuepay_users WHERE email = ?', [email]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Email already registered');
      return res.redirect('/cuepay/register');
    }

    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO cuepay_users (email, password, full_name, business_name, phone) VALUES (?, ?, ?, ?, ?)',
      [email, hash, full_name || '', business_name || '', phone || '']
    );

    req.flash('success_msg', 'CuePay account created! Please login.');
    res.redirect('/cuepay/login');
  } catch(err) {
    console.error('CuePay register error:', err);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/cuepay/register');
  }
});

app.get('/cuepay/logout', (req, res) => {
  delete req.session.cuepayUser;
  res.redirect('/cuepay/login');
});

app.get('/cuepay/dashboard', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;

    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );

    devices.forEach(device => {
      device.battery_percent = device.battery_voltage ?
        Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
      device.battery_percent = Math.max(0, Math.min(100, device.battery_percent));
      device.is_online = device.status === 'online';
    });

    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard - Ardthon Solutions',
      devices,
      user: req.session.cuepayUser
    });
  } catch(err) {
    console.error('CuePay dashboard error:', err);
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices: [],
      user: req.session.cuepayUser
    });
  }
});

app.get('/cuepay/register-device', isCuePayAuth, (req, res) => {
  res.render('cuepay/register-device', { title: 'Register New CuePay Device' });
});

app.post('/cuepay/register-device', isCuePayAuth, async (req, res) => {
  try {
    const { device_name, location, game_price } = req.body;
    const ownerId = req.session.cuepayUser.id;

    const deviceId = 'CUEPAY-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    const apiKey = generateApiKey();

    await db.query(
      `INSERT INTO cuepay_devices (device_id, device_name, api_key, owner_id, location_area, game_price, status)
       VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
      [deviceId, device_name, apiKey, ownerId, location, game_price || 10]
    );

    req.session.newDevice = {
      device_id: deviceId,
      device_name: device_name,
      api_key: apiKey
    };

    req.flash('success_msg', 'Device registered successfully!');
    res.redirect('/cuepay/device-credentials');
  } catch(err) {
    console.error('Device registration error:', err);
    req.flash('error_msg', 'Failed to register device');
    res.redirect('/cuepay/register-device');
  }
});

app.get('/cuepay/device-credentials', isCuePayAuth, (req, res) => {
  const device = req.session.newDevice;
  if (!device) return res.redirect('/cuepay/dashboard');
  delete req.session.newDevice;

  res.render('cuepay/device-credentials', {
    title: 'Device Credentials - CuePay',
    device
  });
});

app.get('/cuepay/device/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const { deviceId } = req.params;

    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );

    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found');
      return res.redirect('/cuepay/dashboard');
    }

    const device = devices[0];
    device.battery_percent = device.battery_voltage ?
      Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
    device.battery_percent = Math.max(0, Math.min(100, device.battery_percent));

    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = today.substring(0, 7) + '-01';

    const [todayStats] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(games_earned), 0) as games, COUNT(*) as payments
       FROM cuepay_payments WHERE device_id = ? AND DATE(payment_time) = ?`,
      [deviceId, today]
    );

    const [yesterdayStats] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(games_earned), 0) as games
       FROM cuepay_payments WHERE device_id = ? AND DATE(payment_time) = ?`,
      [deviceId, yesterday]
    );

    const [weekStats] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(games_earned), 0) as games
       FROM cuepay_payments WHERE device_id = ? AND DATE(payment_time) >= ?`,
      [deviceId, weekAgo]
    );

    const [monthStats] = await db.query(
      `SELECT COALESCE(SUM(amount), 0) as revenue, COALESCE(SUM(games_earned), 0) as games
       FROM cuepay_payments WHERE device_id = ? AND DATE(payment_time) >= ?`,
      [deviceId, monthStart]
    );

    const [payments] = await db.query(
      'SELECT * FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 50',
      [deviceId]
    );

    const [commands] = await db.query(
      "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 10",
      [deviceId]
    );

    res.render('cuepay/device-detail', {
      title: `${device.device_name} - CuePay`,
      device,
      todayStats: todayStats[0],
      yesterdayStats: yesterdayStats[0],
      weekStats: weekStats[0],
      monthStats: monthStats[0],
      payments,
      commands
    });
  } catch(err) {
    console.error('Device detail error:', err);
    res.redirect('/cuepay/dashboard');
  }
});

app.post('/cuepay/device/:deviceId/command', isCuePayAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command_type, command_value } = req.body;
    const userId = req.session.cuepayUser.id;

    const [devices] = await db.query(
      'SELECT id FROM cuepay_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );

    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found or access denied');
      return res.redirect('/cuepay/dashboard');
    }

    await db.query(
      "INSERT INTO cuepay_commands (device_id, command_type, command_value, status) VALUES (?, ?, ?, 'pending')",
      [deviceId, command_type, command_value]
    );

    if (command_type === 'change_price') {
      await db.query(
        'UPDATE cuepay_devices SET game_price = ? WHERE device_id = ? AND owner_id = ?',
        [parseFloat(command_value), deviceId, userId]
      );
    } else if (command_type === 'add_games') {
      await db.query(
        'UPDATE cuepay_devices SET games_available = games_available + ? WHERE device_id = ? AND owner_id = ?',
        [parseInt(command_value), deviceId, userId]
      );
    } else if (command_type === 'remove_games') {
      await db.query(
        'UPDATE cuepay_devices SET games_available = GREATEST(games_available - ?, 0) WHERE device_id = ? AND owner_id = ?',
        [parseInt(command_value), deviceId, userId]
      );
    }

    req.flash('success_msg', `Command sent! Device will update on next sync.`);
    res.redirect(`/cuepay/device/${deviceId}`);
  } catch(err) {
    console.error('Command error:', err);
    req.flash('error_msg', 'Failed to send command');
    res.redirect(`/cuepay/device/${req.params.deviceId}`);
  }
});

// CuePay API Endpoints
app.post('/cuepay/api/sync', validateDeviceApiKey, async (req, res) => {
  try {
    const device = req.cuepayDevice;
    const data = req.body;

    await db.query(
      `UPDATE cuepay_devices SET
        status = 'online',
        battery_voltage = ?,
        gsm_connected = ?,
        games_available = ?,
        total_revenue = ?,
        today_revenue = ?,
        today_games = ?,
        last_sync = NOW()
       WHERE device_id = ?`,
      [
        data.battery_voltage || 0,
        data.gsm_connected ? 1 : 0,
        data.games_available || 0,
        data.total_revenue || 0,
        data.today_revenue || 0,
        data.today_games || 0,
        device.device_id
      ]
    );

    if (data.recent_payments && Array.isArray(data.recent_payments)) {
      for (const payment of data.recent_payments) {
        if (payment.transaction_id) {
          await db.query(
            `INSERT IGNORE INTO cuepay_payments (device_id, transaction_id, amount, customer_number, games_earned)
             VALUES (?, ?, ?, ?, ?)`,
            [device.device_id, payment.transaction_id, payment.amount, payment.customer, payment.games]
          );
        }
      }
    }

    const [commands] = await db.query(
      "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 5",
      [device.device_id]
    );

    if (commands.length > 0) {
      const commandIds = commands.map(c => c.id);
      await db.query(
        "UPDATE cuepay_commands SET status = 'sent' WHERE id IN (?)",
        [commandIds]
      );
    }

    const [currentDevice] = await db.query(
      'SELECT game_price FROM cuepay_devices WHERE device_id = ?',
      [device.device_id]
    );

    res.json({
      status: 'success',
      message: 'Sync complete',
      timestamp: new Date().toISOString(),
      commands: commands.map(c => ({
        type: c.command_type,
        value: c.command_value
      })),
      current_price: currentDevice[0]?.game_price || 10
    });
  } catch(err) {
    console.error('CuePay sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

app.get('/cuepay/api/device-status', validateDeviceApiKey, async (req, res) => {
  const [commands] = await db.query(
    "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 5",
    [req.cuepayDevice.device_id]
  );

  const [device] = await db.query(
    'SELECT game_price FROM cuepay_devices WHERE device_id = ?',
    [req.cuepayDevice.device_id]
  );

  res.json({
    status: 'ok',
    game_price: device[0]?.game_price || 10,
    pending_commands: commands
  });
});

app.get('/cuepay/api/time', async (req, res) => {
  const now = new Date();
  const timezone = req.query.tz || 'Africa/Nairobi';
  res.json({
    timestamp: now.toISOString(),
    unix: Math.floor(now.getTime() / 1000),
    time: now.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour12: false }),
    date: now.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' }),
    timezone: timezone
  });
});

// Offline detection
setInterval(async () => {
  try {
    await db.query(
      "UPDATE cuepay_devices SET status = 'offline' WHERE status = 'online' AND last_sync < DATE_SUB(NOW(), INTERVAL 60 SECOND)"
    );
  } catch(e) {}
}, 30000);

app.post('/cuepay/api/heartbeat', validateDeviceApiKey, async (req, res) => {
  try {
    const device = req.cuepayDevice;
    await db.query(
      "UPDATE cuepay_devices SET status = 'online', last_sync = NOW() WHERE device_id = ?",
      [device.device_id]
    );
    res.json({ status: 'ok', server_time: new Date().toISOString() });
  } catch(err) {
    res.status(500).json({ error: 'Heartbeat failed' });
  }
});

app.get('/cuepay/api/dashboard-data', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const [devices] = await db.query(
      'SELECT device_id, device_name, games_available, battery_voltage, status, last_sync, today_revenue, today_games, game_price FROM cuepay_devices WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );
    res.json({ success: true, devices, timestamp: new Date().toISOString() });
  } catch(err) {
    res.status(500).json({ success: false, error: 'Failed to load data' });
  }
});

// ============================================
// ADMIN DASHBOARD
// ============================================

function isAdmin(req, res, next) {
  if (req.session.user && req.session.user.role === 'admin') return next();
  req.flash('error_msg', 'Admin access required');
  res.redirect('/auth/login');
}

app.get('/admin', isAdmin, async (req, res) => {
  try {
    const [devices] = await db.query(`
      SELECT d.*, u.email, u.full_name as owner_name
      FROM cuepay_devices d
      LEFT JOIN cuepay_users u ON d.owner_id = u.id
      ORDER BY d.created_at DESC
    `);

    const [stats] = await db.query(`
      SELECT
        COUNT(*) as total_devices,
        SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online_devices,
        SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline_devices,
        COALESCE(SUM(today_revenue), 0) as total_today_revenue,
        COALESCE(SUM(total_revenue), 0) as total_all_revenue
      FROM cuepay_devices
    `);

    res.render('admin/dashboard', {
      title: 'Admin Dashboard - Ardthon Solutions',
      devices,
      stats: stats[0],
      user: req.session.user
    });
  } catch(err) {
    console.error('Admin dashboard error:', err);
    res.render('admin/dashboard', {
      title: 'Admin Dashboard',
      devices: [],
      stats: { total_devices: 0, online_devices: 0, offline_devices: 0, total_today_revenue: 0, total_all_revenue: 0 },
      user: req.session.user
    });
  }
});

app.get('/admin/device/:deviceId', isAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const [devices] = await db.query(`
      SELECT d.*, u.username, u.email, u.fullName as owner_name
      FROM cuepay_devices d
      LEFT JOIN cuepay_users u ON d.owner_id = u.id
      WHERE d.device_id = ?
    `, [deviceId]);

    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found');
      return res.redirect('/admin');
    }

    const device = devices[0];
    device.battery_percent = device.battery_voltage ?
      Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;

    const [payments] = await db.query(
      'SELECT * FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 100',
      [deviceId]
    );

    const [commands] = await db.query(
      'SELECT * FROM cuepay_commands WHERE device_id = ? ORDER BY created_at DESC LIMIT 50',
      [deviceId]
    );

    const [alerts] = await db.query(
      'SELECT * FROM cuepay_alert_history WHERE device_id = ? ORDER BY created_at DESC LIMIT 20',
      [deviceId]
    );

    res.render('admin/device-detail', {
      title: `${device.device_name} - Admin`,
      device,
      payments,
      commands,
      alerts,
      user: req.session.user
    });
  } catch(err) {
    console.error('Admin device detail error:', err);
    res.redirect('/admin');
  }
});

app.post('/admin/device/:deviceId/command', isAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { command_type, command_value } = req.body;

    await db.query(
      "INSERT INTO cuepay_commands (device_id, command_type, command_value, status) VALUES (?, ?, ?, 'pending')",
      [deviceId, command_type, command_value]
    );

    if (command_type === 'change_price') {
      await db.query('UPDATE cuepay_devices SET game_price = ? WHERE device_id = ?',
        [parseFloat(command_value), deviceId]);
    } else if (command_type === 'add_games') {
      await db.query(
        'UPDATE cuepay_devices SET games_available = games_available + ? WHERE device_id = ?',
        [parseInt(command_value), deviceId]
      );
    }

    req.flash('success_msg', `Command "${command_type}" sent to ${deviceId}`);
    res.redirect(`/admin/device/${deviceId}`);
  } catch(err) {
    console.error('Admin command error:', err);
    req.flash('error_msg', 'Failed to send command');
    res.redirect('/admin');
  }
});

app.post('/admin/device/:deviceId/delete', isAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;

    await db.query('DELETE FROM cuepay_payments WHERE device_id = ?', [deviceId]);
    await db.query('DELETE FROM cuepay_commands WHERE device_id = ?', [deviceId]);
    await db.query('DELETE FROM cuepay_alerts WHERE device_id = ?', [deviceId]);
    await db.query('DELETE FROM cuepay_alert_history WHERE device_id = ?', [deviceId]);
    await db.query('DELETE FROM cuepay_devices WHERE device_id = ?', [deviceId]);

    req.flash('success_msg', `Device ${deviceId} deleted successfully`);
    res.redirect('/admin');
  } catch(err) {
    console.error('Delete device error:', err);
    req.flash('error_msg', 'Failed to delete device');
    res.redirect('/admin');
  }
});

app.post('/admin/device/:deviceId/reset-revenue', isAdmin, async (req, res) => {
  try {
    const { deviceId } = req.params;
    await db.query(
      'UPDATE cuepay_devices SET today_revenue = 0, today_games = 0, total_revenue = 0 WHERE device_id = ?',
      [deviceId]
    );
    req.flash('success_msg', `Revenue reset for ${deviceId}`);
    res.redirect(`/admin/device/${deviceId}`);
  } catch(err) {
    req.flash('error_msg', 'Failed to reset revenue');
    res.redirect('/admin');
  }
});

app.get('/admin/users', isAdmin, async (req, res) => {
  try {
    const [users] = await db.query(`
      SELECT u.*,
        (SELECT COUNT(*) FROM cuepay_devices WHERE owner_id = u.id) as device_count,
        (SELECT SUM(total_revenue) FROM cuepay_devices WHERE owner_id = u.id) as total_revenue
      FROM cuepay_users u
      ORDER BY u.created_at DESC
    `);
    res.render('admin/users', {
      title: 'Users - Admin',
      users,
      user: req.session.user
    });
  } catch(err) {
    res.redirect('/admin');
  }
});

app.post('/admin/users/:userId/delete', isAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const [devices] = await db.query('SELECT device_id FROM cuepay_devices WHERE owner_id = ?', [userId]);
    for (const d of devices) {
      await db.query('DELETE FROM cuepay_payments WHERE device_id = ?', [d.device_id]);
      await db.query('DELETE FROM cuepay_commands WHERE device_id = ?', [d.device_id]);
    }
    await db.query('DELETE FROM cuepay_devices WHERE owner_id = ?', [userId]);
    await db.query('DELETE FROM cuepay_users WHERE id = ?', [userId]);
    req.flash('success_msg', 'User deleted');
    res.redirect('/admin/users');
  } catch(err) {
    req.flash('error_msg', 'Failed to delete user');
    res.redirect('/admin/users');
  }
});

app.get('/admin/payments', isAdmin, async (req, res) => {
  try {
    const [payments] = await db.query(`
      SELECT p.*, d.device_name, u.email as owner_email
      FROM cuepay_payments p
      LEFT JOIN cuepay_devices d ON p.device_id = d.device_id
      LEFT JOIN cuepay_users u ON d.owner_id = u.id
      ORDER BY p.payment_time DESC
      LIMIT 200
    `);

    const [totals] = await db.query(`
      SELECT SUM(amount) as total, COUNT(*) as count
      FROM cuepay_payments
    `);

    res.render('admin/payments', {
      title: 'All Payments - Admin',
      payments,
      totals: totals[0],
      user: req.session.user
    });
  } catch(err) {
    res.redirect('/admin');
  }
});

// ============================================
// ALERT NOTIFICATION SYSTEM
// ============================================
setInterval(async () => {
  try {
    const [offlineDevices] = await db.query(`
      SELECT d.*, u.email, u.full_name
      FROM cuepay_devices d
      LEFT JOIN cuepay_users u ON d.owner_id = u.id
      WHERE d.status = 'offline'
        AND d.last_sync IS NOT NULL
        AND d.last_sync < DATE_SUB(NOW(), INTERVAL 15 MINUTE)
        AND d.last_sync > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);

    for (const device of offlineDevices) {
      const [recentAlerts] = await db.query(
        `SELECT id FROM cuepay_alert_history
         WHERE device_id = ? AND alert_type = 'device_offline'
         AND created_at > DATE_SUB(NOW(), INTERVAL 2 HOUR)`,
        [device.device_id]
      );

      if (recentAlerts.length === 0) {
        if (isBusinessHours() && device.email) {
          const offlineMinutes = Math.round((Date.now() - new Date(device.last_sync).getTime()) / 60000);
          const emailText = 'Device ' + device.device_name + ' is Offline\n\nDevice: ' + device.device_name + ' (' + device.device_id + ')\nLocation: ' + (device.location_area || 'N/A') + '\nOffline for: ' + offlineMinutes + ' minutes\nLast Seen: ' + new Date(device.last_sync).toLocaleString() + '\nGames Available: ' + (device.games_available || 0) + '\n\nPlease check:\n- Power supply is connected\n- WiFi is working\n- GSM module is functioning\n\nView dashboard: https://ardthonsolutions.com/cuepay/dashboard';
          await sendEmail(device.email, 'Device ' + device.device_name + ' status update', emailText);
        }

        await db.query(
          `INSERT INTO cuepay_alert_history (owner_id, device_id, alert_type, message)
           VALUES (?, ?, 'device_offline', ?)`,
          [device.owner_id, device.device_id, 'Device offline for ' + Math.round((Date.now() - new Date(device.last_sync).getTime()) / 60000) + ' minutes']
        );
      }
    }

    const [lowGamesDevices] = await db.query(`
      SELECT d.*, u.email, u.full_name
      FROM cuepay_devices d
      LEFT JOIN cuepay_users u ON d.owner_id = u.id
      WHERE d.games_available <= 5 AND d.games_available > 0
        AND d.status = 'online'
    `);

    for (const device of lowGamesDevices) {
      const [recentAlerts] = await db.query(
        `SELECT id FROM cuepay_alert_history
         WHERE device_id = ? AND alert_type = 'low_games'
         AND created_at > DATE_SUB(NOW(), INTERVAL 4 HOUR)`,
        [device.device_id]
      );

      if (recentAlerts.length === 0 && isBusinessHours() && device.email) {
        const emailText = 'Device ' + device.device_name + ' Low Games Alert\n\nDevice: ' + device.device_name + ' (' + device.device_id + ')\nGames Remaining: ' + device.games_available + '\nRevenue Today: Ksh ' + (device.today_revenue || 0) + '\n\nAdd games from your dashboard to avoid running out!\n\nView dashboard: https://ardthonsolutions.com/cuepay/dashboard';
        await sendEmail(device.email, 'Device ' + device.device_name + ' low games alert', emailText);
      }
    }

    const [lowBatteryDevices] = await db.query(`
      SELECT d.*, u.email, u.full_name
      FROM cuepay_devices d
      LEFT JOIN cuepay_users u ON d.owner_id = u.id
      WHERE d.battery_voltage <= 10.5 AND d.battery_voltage > 0
        AND d.status = 'online'
    `);

    for (const device of lowBatteryDevices) {
      const [recentAlerts] = await db.query(
        `SELECT id FROM cuepay_alert_history
         WHERE device_id = ? AND alert_type = 'low_battery'
         AND created_at > DATE_SUB(NOW(), INTERVAL 6 HOUR)`,
        [device.device_id]
      );

      if (recentAlerts.length === 0 && isBusinessHours() && device.email) {
        const batteryText = 'Device ' + device.device_name + ' Low Battery Warning\n\nDevice: ' + device.device_name + ' (' + device.device_id + ')\nBattery Voltage: ' + device.battery_voltage + 'V\n\nPlease charge the device soon to avoid interruption.\n\nView dashboard: https://ardthonsolutions.com/cuepay/dashboard';
        await sendEmail(device.email, 'Device ' + device.device_name + ' battery warning', batteryText);
      }
    }

  } catch(err) {
    console.error('Alert system error:', err.message);
  }
}, 60000);

setInterval(async () => {
  const now = new Date();
  if (now.getHours() === 0 && now.getMinutes() <= 1) {
    try {
      await db.query(`
        UPDATE cuepay_devices
        SET today_revenue = 0, today_games = 0
        WHERE last_sync < DATE_SUB(NOW(), INTERVAL 1 HOUR)
      `);
      console.log('Midnight reset: cleared today stats');
    } catch(err) {
      console.error('Midnight reset error:', err.message);
    }
  }
}, 60000);

// ============================================
// PROJECT REVIEWS
// ============================================
db.query(`CREATE TABLE IF NOT EXISTS project_reviews (
  id int NOT NULL AUTO_INCREMENT,
  name varchar(100) NOT NULL,
  project varchar(100) NOT NULL,
  rating tinyint NOT NULL,
  comment text NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`).catch(() => {});

app.post('/projects/review', async (req, res) => {
  try {
    const { name, project, rating, comment } = req.body;
    await db.query(
      'INSERT INTO project_reviews (name, project, rating, comment) VALUES (?, ?, ?, ?)',
      [name, project, parseInt(rating), comment]
    );
    req.flash('success_msg', 'Review submitted! Thank you for your feedback.');
  } catch(err) {
    req.flash('error_msg', 'Failed to submit review');
  }
  res.redirect('/projects');
});

// ============================================
// HEALTH MONITORING SYSTEM
// ============================================
app.get('/health', async (req, res) => {
  try {
    const [readings] = await db.query(
      'SELECT * FROM health_readings ORDER BY recorded_at DESC LIMIT 50'
    );

    const [latest] = await db.query(
      'SELECT * FROM health_readings ORDER BY recorded_at DESC LIMIT 1'
    );

    const [stats] = await db.query(
      `SELECT
        AVG(spo2) as avg_spo2,
        AVG(temperature) as avg_temp,
        AVG(heart_rate) as avg_hr,
        MIN(heart_rate) as min_hr,
        MAX(heart_rate) as max_hr,
        COUNT(*) as total_readings
       FROM health_readings
       WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );

    res.render('health', {
      title: 'Health Monitoring - Ardthon Solutions',
      readings,
      latest: latest[0] || null,
      stats: stats[0] || {},
      user: req.session.user || null
    });
  } catch(err) {
    console.error('Health page error:', err);
    res.render('health', {
      title: 'Health Monitoring',
      readings: [],
      latest: null,
      stats: {},
      user: req.session.user || null
    });
  }
});

app.post('/health/api/submit', async (req, res) => {
  try {
    const { device_id, spo2, temperature, heart_rate } = req.body;

    if (!device_id) {
      return res.status(400).json({ error: 'device_id required' });
    }

    await db.query(
      'INSERT INTO health_readings (device_id, spo2, temperature, heart_rate) VALUES (?, ?, ?, ?)',
      [device_id, parseFloat(spo2) || 0, parseFloat(temperature) || 0, parseInt(heart_rate) || 0]
    );

    res.json({ status: 'success', message: 'Reading recorded' });
  } catch(err) {
    console.error('Health API error:', err);
    res.status(500).json({ error: 'Failed to save reading' });
  }
});

app.get('/health/api/latest', async (req, res) => {
  try {
    const [latest] = await db.query(
      'SELECT * FROM health_readings ORDER BY recorded_at DESC LIMIT 1'
    );

    const [recent] = await db.query(
      'SELECT * FROM health_readings ORDER BY recorded_at DESC LIMIT 20'
    );

    const [stats] = await db.query(
      `SELECT
        AVG(spo2) as avg_spo2,
        AVG(temperature) as avg_temp,
        AVG(heart_rate) as avg_hr,
        MIN(heart_rate) as min_hr,
        MAX(heart_rate) as max_hr
       FROM health_readings
       WHERE recorded_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)`
    );

    res.json({
      latest: latest[0] || null,
      recent: recent.reverse(),
      stats: stats[0] || {}
    });
  } catch(err) {
    res.status(500).json({ error: 'Failed to get data' });
  }
});

// ============================================
// PUSH NOTIFICATIONS
// ============================================
app.post('/api/push/subscribe', async (req, res) => {
  try {
    const subscription = req.body;
    const userId = req.session.cuepayUser ? req.session.cuepayUser.id : null;

    await db.query(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id int NOT NULL AUTO_INCREMENT,
      user_id int,
      subscription json NOT NULL,
      created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4`);

    await db.query('INSERT INTO push_subscriptions (user_id, subscription) VALUES (?, ?)',
      [userId, JSON.stringify(subscription)]);

    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: 'Failed to subscribe' });
  }
});

// ============================================
// SPINSPRING LAUNDRY AUTOMATION SYSTEM (Multi-Role)
// ============================================

const spinspgCrypto = require('crypto');

function generateSpinApiKey() {
  return 'SS-' + spinspgCrypto.randomBytes(16).toString('hex');
}

function isSpinAuth(req, res, next) {
  if (req.session.spinUser) return next();
  req.flash('error_msg', 'Please login to SpinSpring first');
  res.redirect('/spinspg/login');
}

async function validateSpinApiKey(req, res, next) {
  const apiKey = req.headers['x-api-key'];
  const deviceId = req.headers['x-device-id'];
  
  if (!apiKey || !deviceId) {
    return res.status(401).json({ error: 'Missing credentials' });
  }
  
  try {
    const [devices] = await db.query(
      'SELECT * FROM spinspg_devices WHERE device_id = ? AND api_key = ?',
      [deviceId, apiKey]
    );
    if (devices.length === 0) return res.status(401).json({ error: 'Invalid credentials' });
    req.spinDevice = devices[0];
    next();
  } catch(err) {
    res.status(500).json({ error: 'Auth error' });
  }
}

function generateCustomerId() {
  return 'CUST-' + Date.now().toString(36).toUpperCase().slice(-4) + '-' + Math.random().toString(36).toUpperCase().slice(-4);
}

function isSpinOwner(req, res, next) {
  if (req.session.spinUser && req.session.spinUser.role === 'owner') return next();
  req.flash('error_msg', 'Owner access required');
  res.redirect('/spinspg/dashboard');
}

function isSpinAttendant(req, res, next) {
  if (req.session.spinUser && (req.session.spinUser.role === 'attendant' || req.session.spinUser.role === 'owner')) return next();
  req.flash('error_msg', 'Access denied');
  res.redirect('/spinspg/login');
}

// SpinSpring Pages
app.get('/spinspg/login', (req, res) => {
  if (req.session.spinUser) return res.redirect('/spinspg/dashboard');
  res.render('spinspring/login', { title: 'SpinSpring Login' });
});

app.post('/spinspg/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const bcrypt = require('bcryptjs');
    const [users] = await db.query('SELECT * FROM spinspg_users WHERE email = ? AND is_active = 1', [email]);
    
    if (users.length === 0) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/spinspg/login');
    }
    
    const match = await bcrypt.compare(password, users[0].password);
    if (!match) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/spinspg/login');
    }
    
    req.session.spinUser = {
      id: users[0].id,
      email: users[0].email,
      name: users[0].full_name,
      business: users[0].business_name,
      role: users[0].role || 'owner'
    };
    
    if (users[0].role === 'owner') {
      res.redirect('/spinspg/owner');
    } else if (users[0].role === 'attendant') {
      res.redirect('/spinspg/attendant');
    } else {
      res.redirect('/spinspg/customer');
    }
  } catch(err) {
    console.error('SpinSpring login error:', err);
    req.flash('error_msg', 'Login failed');
    res.redirect('/spinspg/login');
  }
});

app.get('/spinspg/register', (req, res) => {
  res.render('spinspring/register', { title: 'SpinSpring Register' });
});

app.post('/spinspg/register', async (req, res) => {
  try {
    const { email, password, password2, full_name, business_name, phone } = req.body;
    const bcrypt = require('bcryptjs');
    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/spinspg/register');
    }
    const hash = await bcrypt.hash(password, 10);
    await db.query(
      'INSERT INTO spinspg_users (email, password, full_name, business_name, phone, role) VALUES (?, ?, ?, ?, ?, ?)',
      [email, hash, full_name, business_name, phone, 'owner']
    );
    req.flash('success_msg', 'Account created! Login now.');
    res.redirect('/spinspg/login');
  } catch(err) {
    req.flash('error_msg', 'Registration failed');
    res.redirect('/spinspg/register');
  }
});

app.get('/spinspg/logout', (req, res) => {
  delete req.session.spinUser;
  res.redirect('/spinspg/login');
});

app.get('/spinspg/dashboard', isSpinAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [devices] = await db.query(
      'SELECT * FROM spinspg_devices WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );
    const [orders] = await db.query(
      'SELECT * FROM spinspg_orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 10',
      [userId]
    );
    const [stats] = await db.query(
      'SELECT SUM(today_revenue) as today_rev, SUM(total_revenue) as total_rev, SUM(today_cycles) as today_cyc, SUM(cycles_completed) as total_cyc FROM spinspg_devices WHERE owner_id = ?',
      [userId]
    );
    res.render('spinspring/dashboard', {
      title: 'SpinSpring Dashboard',
      devices,
      orders,
      stats: stats[0],
      user: req.session.spinUser
    });
  } catch(err) {
    res.render('spinspring/dashboard', { title: 'SpinSpring Dashboard', devices: [], orders: [], stats: {}, user: req.session.spinUser });
  }
});

app.get('/spinspg/register-device', isSpinAuth, (req, res) => {
  res.render('spinspring/register-device', { title: 'Register Device - SpinSpring' });
});

app.post('/spinspg/register-device', isSpinAuth, async (req, res) => {
  try {
    const { device_name, device_type, location, price_per_cycle } = req.body;
    const ownerId = req.session.spinUser.id;
    const deviceId = 'SPIN-' + Date.now().toString(36).toUpperCase() + '-' + spinspgCrypto.randomBytes(3).toString('hex').toUpperCase();
    const apiKey = generateSpinApiKey();
    await db.query(
      `INSERT INTO spinspg_devices (device_id, device_name, device_type, api_key, owner_id, location_area, price_per_cycle, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'offline')`,
      [deviceId, device_name, device_type, apiKey, ownerId, location, price_per_cycle || 300]
    );
    req.session.newSpinDevice = { device_id: deviceId, device_name, api_key };
    res.redirect('/spinspg/device-credentials');
  } catch(err) {
    req.flash('error_msg', 'Registration failed');
    res.redirect('/spinspg/register-device');
  }
});

app.get('/spinspg/device-credentials', isSpinAuth, (req, res) => {
  const device = req.session.newSpinDevice;
  if (!device) return res.redirect('/spinspg/dashboard');
  delete req.session.newSpinDevice;
  res.render('spinspring/device-credentials', { title: 'Device Credentials', device });
});

app.get('/spinspg/device/:deviceId', isSpinAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [devices] = await db.query(
      'SELECT * FROM spinspg_devices WHERE device_id = ? AND owner_id = ?',
      [req.params.deviceId, userId]
    );
    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found');
      return res.redirect('/spinspg/dashboard');
    }
    const device = devices[0];
    const [orders] = await db.query(
      'SELECT * FROM spinspg_orders WHERE device_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.params.deviceId]
    );
    const [payments] = await db.query(
      'SELECT * FROM spinspg_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 20',
      [req.params.deviceId]
    );
    res.render('spinspring/device-detail', {
      title: device.device_name + ' - SpinSpring',
      device,
      orders,
      payments
    });
  } catch(err) {
    res.redirect('/spinspg/dashboard');
  }
});

app.get('/spinspg/orders', isSpinAuth, async (req, res) => {
  const userId = req.session.spinUser.id;
  const [orders] = await db.query(
    'SELECT o.*, d.device_name FROM spinspg_orders o LEFT JOIN spinspg_devices d ON o.device_id = d.device_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 50',
    [userId]
  );
  res.render('spinspring/orders', { title: 'Orders - SpinSpring', orders });
});

app.post('/spinspg/device/:deviceId/command', isSpinAuth, async (req, res) => {
  try {
    const { command_type, command_value } = req.body;
    await db.query(
      "INSERT INTO spinspg_commands (device_id, command_type, command_value, status) VALUES (?, ?, ?, 'pending')",
      [req.params.deviceId, command_type, command_value]
    );
    
    if (command_type === 'start_cycle') {
      await db.query("UPDATE spinspg_devices SET status = 'running', current_cycle = ?, cycle_progress = 0 WHERE device_id = ?", [command_value, req.params.deviceId]);
    } else if (command_type === 'stop') {
      await db.query("UPDATE spinspg_devices SET status = 'idle', current_cycle = NULL, cycle_progress = 0 WHERE device_id = ?", [req.params.deviceId]);
    } else if (command_type === 'change_price') {
      await db.query('UPDATE spinspg_devices SET price_per_cycle = ? WHERE device_id = ?', [parseFloat(command_value), req.params.deviceId]);
    }
    
    req.flash('success_msg', 'Command sent!');
    res.redirect(`/spinspg/device/${req.params.deviceId}`);
  } catch(err) {
    req.flash('error_msg', 'Command failed');
    res.redirect(`/spinspg/device/${req.params.deviceId}`);
  }
});

// ============================================
// SPINSPRING MULTI-ROLE SYSTEM
// ============================================

app.get('/spinspg/owner', isSpinOwner, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [devices] = await db.query('SELECT * FROM spinspg_devices WHERE owner_id = ?', [userId]);
    const [attendants] = await db.query('SELECT * FROM spinspg_attendants WHERE owner_id = ?', [userId]);
    const [customers] = await db.query('SELECT * FROM spinspg_customers WHERE owner_id = ?', [userId]);
    const [stats] = await db.query(
      'SELECT SUM(today_revenue) as today_rev, SUM(total_revenue) as total_rev, SUM(cycles_completed) as total_cyc FROM spinspg_devices WHERE owner_id = ?',
      [userId]
    );
    res.render('spinspring/owner-dashboard', {
      title: 'Owner Panel - SpinSpring',
      devices, attendants, customers, stats: stats[0],
      user: req.session.spinUser
    });
  } catch(err) {
    res.render('spinspring/owner-dashboard', { title: 'Owner Panel', devices: [], attendants: [], customers: [], stats: {}, user: req.session.spinUser });
  }
});

app.post('/spinspg/owner/attendants', isSpinOwner, async (req, res) => {
  try {
    const { full_name, email, phone, pin_code, device_access } = req.body;
    const ownerId = req.session.spinUser.id;
    
    const [existing] = await db.query('SELECT id FROM spinspg_attendants WHERE email = ? AND owner_id = ?', [email, ownerId]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Attendant email already exists');
      return res.redirect('/spinspg/owner');
    }
    
    await db.query(
      'INSERT INTO spinspg_attendants (owner_id, full_name, email, phone, pin_code, device_access) VALUES (?, ?, ?, ?, ?, ?)',
      [ownerId, full_name, email, phone, pin_code, JSON.stringify(device_access || [])]
    );
    req.flash('success_msg', 'Attendant created!');
    res.redirect('/spinspg/owner');
  } catch(err) {
    req.flash('error_msg', 'Failed to create attendant');
    res.redirect('/spinspg/owner');
  }
});

app.post('/spinspg/owner/attendants/:id/toggle', isSpinOwner, async (req, res) => {
  await db.query('UPDATE spinspg_attendants SET is_active = NOT is_active WHERE id = ? AND owner_id = ?', [req.params.id, req.session.spinUser.id]);
  res.redirect('/spinspg/owner');
});

app.post('/spinspg/owner/attendants/:id/delete', isSpinOwner, async (req, res) => {
  await db.query('DELETE FROM spinspg_attendants WHERE id = ? AND owner_id = ?', [req.params.id, req.session.spinUser.id]);
  req.flash('success_msg', 'Attendant deleted');
  res.redirect('/spinspg/owner');
});

app.post('/spinspg/owner/customers', isSpinOwner, async (req, res) => {
  try {
    const { full_name, phone, email } = req.body;
    const ownerId = req.session.spinUser.id;
    const customerId = generateCustomerId();
    
    if (email) {
      const [existing] = await db.query('SELECT id FROM spinspg_customers WHERE email = ? AND owner_id = ?', [email, ownerId]);
      if (existing.length > 0) {
        req.flash('error_msg', 'Customer email already exists');
        return res.redirect('/spinspg/owner');
      }
    }
    
    await db.query(
      'INSERT INTO spinspg_customers (owner_id, customer_unique_id, full_name, phone, email) VALUES (?, ?, ?, ?, ?)',
      [ownerId, customerId, full_name, phone, email || null]
    );
    req.flash('success_msg', 'Customer created with ID: ' + customerId);
    res.redirect('/spinspg/owner');
  } catch(err) {
    req.flash('error_msg', 'Failed to create customer');
    res.redirect('/spinspg/owner');
  }
});

// Attendant Panel
app.get('/spinspg/attendant-login', (req, res) => {
  res.render('spinspring/attendant-login', { title: 'Attendant Login - SpinSpring' });
});

app.post('/spinspg/attendant-login', async (req, res) => {
  try {
    const { email, pin_code } = req.body;
    const [attendants] = await db.query(
      'SELECT a.*, u.business_name, u.full_name as owner_name FROM spinspg_attendants a LEFT JOIN spinspg_users u ON a.owner_id = u.id WHERE a.email = ? AND a.pin_code = ? AND a.is_active = 1',
      [email, pin_code]
    );
    
    if (attendants.length === 0) {
      req.flash('error_msg', 'Invalid attendant credentials');
      return res.redirect('/spinspg/attendant-login');
    }
    
    const attendant = attendants[0];
    req.session.spinUser = {
      id: attendant.id,
      email: attendant.email,
      name: attendant.full_name,
      business: attendant.business_name,
      role: 'attendant',
      ownerId: attendant.owner_id,
      deviceAccess: Array.isArray(attendant.device_access) ? attendant.device_access : (typeof attendant.device_access === 'string' ? JSON.parse(attendant.device_access) : [])
    };
    
    res.redirect('/spinspg/attendant');
  } catch(err) {
    req.flash('error_msg', 'Login failed');
    res.redirect('/spinspg/attendant-login');
  }
});

app.get('/spinspg/attendant', isSpinAttendant, async (req, res) => {
  try {
    const ownerId = req.session.spinUser.ownerId;
    const deviceAccess = req.session.spinUser.deviceAccess || [];
    
    let devices;
    if (deviceAccess.length > 0) {
      const [result] = await db.query(
        'SELECT * FROM spinspg_devices WHERE owner_id = ? AND device_id IN (?)',
        [ownerId, deviceAccess]
      );
      devices = result;
    } else {
      const [result] = await db.query('SELECT * FROM spinspg_devices WHERE owner_id = ?', [ownerId]);
      devices = result;
    }
    
    const [customers] = await db.query('SELECT * FROM spinspg_customers WHERE owner_id = ? AND is_active = 1', [ownerId]);
    const [activeOrders] = await db.query(
      "SELECT o.*, d.device_name FROM spinspg_orders o LEFT JOIN spinspg_devices d ON o.device_id = d.device_id WHERE o.user_id = ? AND o.order_status IN ('queued', 'in_progress') ORDER BY o.created_at DESC",
      [ownerId]
    );
    
    res.render('spinspring/attendant-dashboard', {
      title: 'Attendant Panel - SpinSpring',
      devices, customers, activeOrders,
      user: req.session.spinUser
    });
  } catch(err) {
    res.render('spinspring/attendant-dashboard', {
      title: 'Attendant Panel', 
      devices: [], customers: [], activeOrders: [],
      user: req.session.spinUser
    });
  }
});

// Customer Panel
app.get('/spinspg/customer-login', (req, res) => {
  res.render('spinspring/customer-login', { title: 'Customer Login - SpinSpring' });
});

app.post('/spinspg/customer-login', async (req, res) => {
  try {
    const { customer_id } = req.body;
    const [customers] = await db.query('SELECT * FROM spinspg_customers WHERE customer_unique_id = ? AND is_active = 1', [customer_id]);
    
    if (customers.length === 0) {
      req.flash('error_msg', 'Invalid customer ID');
      return res.redirect('/spinspg/customer-login');
    }
    
    const customer = customers[0];
    req.session.spinUser = {
      id: customer.id,
      name: customer.full_name,
      customerId: customer.customer_unique_id,
      role: 'customer',
      ownerId: customer.owner_id
    };
    
    res.redirect('/spinspg/customer');
  } catch(err) {
    req.flash('error_msg', 'Login failed');
    res.redirect('/spinspg/customer-login');
  }
});

app.get('/spinspg/customer', async (req, res) => {
  if (!req.session.spinUser || req.session.spinUser.role !== 'customer') {
    return res.redirect('/spinspg/customer-login');
  }
  
  const customerId = req.session.spinUser.customerId;
  const [customerData] = await db.query('SELECT * FROM spinspg_customers WHERE customer_unique_id = ?', [customerId]);
  const [orders] = await db.query('SELECT * FROM spinspg_orders WHERE customer_name = ? ORDER BY created_at DESC LIMIT 20', [customerId]);
  const [activeOrders] = await db.query(
    "SELECT * FROM spinspg_orders WHERE customer_name = ? AND order_status IN ('queued', 'in_progress') ORDER BY created_at DESC",
    [customerId]
  );
  
  res.render('spinspring/customer-dashboard', {
    title: 'My Account - SpinSpring',
    customer: customerData[0],
    orders, activeOrders,
    user: req.session.spinUser
  });
});

app.get('/spinspg/api/customer-orders', async (req, res) => {
  if (!req.session.spinUser || req.session.spinUser.role !== 'customer') {
    return res.json({ success: false });
  }
  const customerId = req.session.spinUser.customerId;
  const [activeOrders] = await db.query(
    "SELECT * FROM spinspg_orders WHERE customer_name = ? AND order_status IN ('queued', 'in_progress') ORDER BY created_at DESC",
    [customerId]
  );
  res.json({ success: true, activeOrders });
});

app.post('/spinspg/attendant/orders', isSpinAttendant, async (req, res) => {
  try {
    const { device_id, customer_id, service_type, cycle_type, price, payment_status } = req.body;
    const orderNumber = 'SS-' + Date.now().toString(36).toUpperCase();
    
    await db.query(
      'INSERT INTO spinspg_orders (order_number, device_id, user_id, customer_name, service_type, cycle_type, price, payment_status, order_status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [orderNumber, device_id, req.session.spinUser.ownerId, customer_id, service_type, cycle_type, price, payment_status, 'queued']
    );
    
    await db.query('UPDATE spinspg_customers SET total_cycles = total_cycles + 1, total_spent = total_spent + ?, loyalty_points = loyalty_points + FLOOR(?/100) WHERE customer_unique_id = ?',
      [price, price, customer_id]);
    
    req.flash('success_msg', 'Order created: ' + orderNumber);
    res.redirect('/spinspg/attendant');
  } catch(err) {
    req.flash('error_msg', 'Failed to create order');
    res.redirect('/spinspg/attendant');
  }
});

// ============================================
// SPINSPRING API SYNC & PAYMENT INTEGRATION
// ============================================

app.post('/spinspg/api/sync', validateSpinApiKey, async (req, res) => {
  try {
    const device = req.spinDevice;
    const data = req.body;
    
    await db.query(
      `UPDATE spinspg_devices SET 
        status = ?,
        current_cycle = ?,
        cycle_progress = ?,
        water_temp = ?,
        water_level = ?,
        door_locked = ?,
        error_code = ?,
        cycles_completed = ?,
        total_runtime_minutes = ?,
        today_revenue = ?,
        total_revenue = ?,
        today_cycles = ?,
        last_sync = NOW()
       WHERE device_id = ?`,
      [
        data.status || 'idle',
        data.current_cycle || null,
        data.cycle_progress || 0,
        data.water_temp || 0,
        data.water_level || 0,
        data.door_locked ? 1 : 0,
        data.error_code || null,
        data.cycles_completed || 0,
        data.total_runtime_minutes || 0,
        data.today_revenue || 0,
        data.total_revenue || 0,
        data.today_cycles || 0,
        device.device_id
      ]
    );
    
    const [commands] = await db.query(
      "SELECT * FROM spinspg_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 5",
      [device.device_id]
    );
    
    if (commands.length > 0) {
      const ids = commands.map(c => c.id);
      await db.query("UPDATE spinspg_commands SET status = 'sent' WHERE id IN (?)", [ids]);
    }
    
    res.json({
      status: 'success',
      commands: commands.map(c => ({ type: c.command_type, value: c.command_value })),
      current_price: device.price_per_cycle
    });
  } catch(err) {
    res.status(500).json({ error: 'Sync failed' });
  }
});

app.get('/spinspg/api/time', (req, res) => {
  const now = new Date();
  res.json({
    timestamp: now.toISOString(),
    time: now.toLocaleTimeString('en-KE', { timeZone: 'Africa/Nairobi', hour12: false }),
    date: now.toLocaleDateString('en-KE', { timeZone: 'Africa/Nairobi' })
  });
});

app.get('/spinspg/reports', isSpinAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [devices] = await db.query('SELECT * FROM spinspg_devices WHERE owner_id = ?', [userId]);
    const [orders] = await db.query(
      'SELECT o.*, d.device_name FROM spinspg_orders o LEFT JOIN spinspg_devices d ON o.device_id = d.device_id WHERE o.user_id = ? ORDER BY o.created_at DESC LIMIT 20',
      [userId]
    );
    const [stats] = await db.query(
      'SELECT SUM(today_revenue) as today_rev, SUM(total_revenue) as total_rev, SUM(today_cycles) as today_cyc, SUM(cycles_completed) as total_cyc FROM spinspg_devices WHERE owner_id = ?',
      [userId]
    );
    res.render('spinspring/reports', { title: 'Reports - SpinSpring', devices, orders, stats: stats[0] });
  } catch(err) {
    res.render('spinspring/reports', { title: 'Reports - SpinSpring', devices: [], orders: [], stats: {} });
  }
});

app.get('/spinspg/order/:orderId', isSpinAuth, async (req, res) => {
  try {
    const [orders] = await db.query(
      'SELECT o.*, d.device_name FROM spinspg_orders o LEFT JOIN spinspg_devices d ON o.device_id = d.device_id WHERE o.id = ?',
      [req.params.orderId]
    );
    if (orders.length === 0) {
      req.flash('error_msg', 'Order not found');
      return res.redirect('/spinspg/orders');
    }
    res.render('spinspring/order-detail', { title: 'Order Details - SpinSpring', order: orders[0] });
  } catch(err) {
    res.redirect('/spinspg/orders');
  }
});

app.get('/spinspg/settings', isSpinAuth, (req, res) => {
  res.render('spinspring/settings', {
    title: 'Settings - SpinSpring',
    user: req.session.spinUser
  });
});

app.post('/spinspg/settings/business', isSpinAuth, async (req, res) => {
  try {
    const { business_name, phone } = req.body;
    await db.query('UPDATE spinspg_users SET business_name = ?, phone = ? WHERE id = ?',
      [business_name, phone, req.session.spinUser.id]);
    req.session.spinUser.business = business_name;
    req.flash('success_msg', 'Business info updated!');
  } catch(err) {
    req.flash('error_msg', 'Update failed');
  }
  res.redirect('/spinspg/settings');
});

app.get('/spinspg/api/dashboard-data', isSpinAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [devices] = await db.query(
      'SELECT device_id, device_name, status, current_cycle, cycle_progress, today_revenue, cycles_completed FROM spinspg_devices WHERE owner_id = ?',
      [userId]
    );
    res.json({ success: true, devices });
  } catch(err) {
    res.json({ success: false, devices: [] });
  }
});

// ============================================
// SPINSPRING PAYMENT INTEGRATION
// ============================================

app.post('/spinspg/api/payment', validateSpinApiKey, async (req, res) => {
  try {
    const device = req.spinDevice;
    const { transaction_id, amount, customer_number, order_number } = req.body;
    
    await db.query(
      'INSERT INTO spinspg_payments (device_id, order_number, transaction_id, amount, customer_number) VALUES (?, ?, ?, ?, ?)',
      [device.device_id, order_number, transaction_id, amount, customer_number]
    );
    
    await db.query(
      'UPDATE spinspg_devices SET today_revenue = today_revenue + ?, total_revenue = total_revenue + ? WHERE device_id = ?',
      [amount, amount, device.device_id]
    );
    
    if (order_number) {
      await db.query(
        "UPDATE spinspg_orders SET payment_status = 'paid', order_status = 'in_progress', start_time = NOW() WHERE order_number = ?",
        [order_number]
      );
    }
    
    res.json({ success: true, message: 'Payment recorded' });
  } catch(err) {
    res.status(500).json({ error: 'Payment processing failed' });
  }
});

app.get('/spinspg/api/payments/:deviceId', isSpinAuth, async (req, res) => {
  const [payments] = await db.query(
    'SELECT * FROM spinspg_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 50',
    [req.params.deviceId]
  );
  res.json({ success: true, payments });
});

// ============================================
// ORDER LIFECYCLE MANAGEMENT
// ============================================

app.post('/spinspg/order/:orderId/status', isSpinAuth, async (req, res) => {
  try {
    const { status } = req.body;
    const orderId = req.params.orderId;
    
    if (status === 'in_progress') {
      await db.query(
        "UPDATE spinspg_orders SET order_status = 'in_progress', start_time = NOW() WHERE id = ?",
        [orderId]
      );
    } else if (status === 'completed') {
      await db.query(
        "UPDATE spinspg_orders SET order_status = 'completed', end_time = NOW() WHERE id = ?",
        [orderId]
      );
      
      const [orders] = await db.query('SELECT * FROM spinspg_orders WHERE id = ?', [orderId]);
      if (orders.length > 0) {
        const order = orders[0];
        const [customers] = await db.query(
          'SELECT * FROM spinspg_customers WHERE customer_unique_id = ?',
          [order.customer_name]
        );
        
        if (customers.length > 0 && customers[0].email) {
          await sendEmail(
            customers[0].email,
            'Your laundry is ready!',
            'Your order ' + order.order_number + ' is complete. Please collect your laundry.\n\nService: ' + order.service_type + '\nPrice: Ksh ' + order.price + '\n\nThank you for using SpinSpring!'
          );
        }
      }
    } else if (status === 'cancelled') {
      await db.query(
        "UPDATE spinspg_orders SET order_status = 'cancelled' WHERE id = ?",
        [orderId]
      );
    }
    
    req.flash('success_msg', 'Order status updated to ' + status);
    res.redirect('/spinspg/orders');
  } catch(err) {
    req.flash('error_msg', 'Failed to update order');
    res.redirect('/spinspg/orders');
  }
});

setInterval(async () => {
  try {
    await db.query(`
      UPDATE spinspg_orders o
      JOIN spinspg_devices d ON o.device_id = d.device_id
      SET o.order_status = 'completed', o.end_time = NOW()
      WHERE o.order_status = 'in_progress' AND d.status = 'idle'
    `);
  } catch(err) {}
}, 60000);

// ============================================
// EMAIL NOTIFICATIONS
// ============================================

app.get('/spinspg/settings/notifications', isSpinAuth, async (req, res) => {
  const userId = req.session.spinUser.id;
  const [settings] = await db.query(
    'SELECT * FROM spinspg_notification_settings WHERE user_id = ?',
    [userId]
  );
  res.json({ success: true, settings: settings[0] || {} });
});

app.post('/spinspg/settings/notifications', isSpinAuth, async (req, res) => {
  const userId = req.session.spinUser.id;
  const { emailAlerts, lowRevenue, maintenance } = req.body;
  
  await db.query(`
    INSERT INTO spinspg_notification_settings (user_id, email_alerts, low_revenue, maintenance)
    VALUES (?, ?, ?, ?)
    ON DUPLICATE KEY UPDATE email_alerts = ?, low_revenue = ?, maintenance = ?
  `, [userId, emailAlerts, lowRevenue, maintenance, emailAlerts, lowRevenue, maintenance]);
  
  res.json({ success: true });
});

setInterval(async () => {
  try {
    const [completedOrders] = await db.query(`
      SELECT o.*, c.email as customer_email, c.full_name as customer_name
      FROM spinspg_orders o
      LEFT JOIN spinspg_customers c ON o.customer_name = c.customer_unique_id
      WHERE o.order_status = 'completed' 
        AND o.end_time > DATE_SUB(NOW(), INTERVAL 5 MINUTE)
        AND c.email IS NOT NULL
    `);
    
    for (const order of completedOrders) {
      await sendEmail(
        order.customer_email,
        'Your laundry is ready for pickup!',
        'Hello ' + (order.customer_name || 'Customer') + ',\n\nYour order ' + order.order_number + ' is complete.\n\nService: ' + order.service_type.replace('_', ' → ') + '\nCycle: ' + order.cycle_type + '\nPrice: Ksh ' + order.price + '\n\nPlease collect your laundry. Thank you for using SpinSpring!'
      );
    }
  } catch(err) {}
}, 300000);

setInterval(async () => {
  try {
    const [lowRevenue] = await db.query(`
      SELECT d.*, u.email
      FROM spinspg_devices d
      LEFT JOIN spinspg_users u ON d.owner_id = u.id
      WHERE d.today_revenue < 500 AND d.status = 'online'
        AND d.last_sync > DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `);
    
    for (const device of lowRevenue) {
      if (device.email && isBusinessHours()) {
        await sendEmail(
          device.email,
          'Low revenue alert for ' + device.device_name,
          device.device_name + ' has only made Ksh ' + device.today_revenue + ' today.\n\nCheck your machine: https://ardthonsolutions.com/spinspg/device/' + device.device_id        );
      }
    }
  } catch(err) {}
}, 3600000);

// ============================================
// SETTINGS ROUTES
// ============================================

app.post('/spinspg/settings/business', isSpinAuth, async (req, res) => {
  try {
    const { business_name, phone } = req.body;
    const userId = req.session.spinUser.id;
    
    await db.query(
      'UPDATE spinspg_users SET business_name = ?, phone = ? WHERE id = ?',
      [business_name, phone, userId]
    );
    
    req.session.spinUser.business = business_name;
    req.flash('success_msg', 'Business info updated!');
  } catch(err) {
    req.flash('error_msg', 'Failed to update business info');
  }
  res.redirect('/spinspg/settings');
});

app.post('/spinspg/settings/password', isSpinAuth, async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;
    const bcrypt = require('bcryptjs');
    const userId = req.session.spinUser.id;
    
    if (new_password !== confirm_password) {
      req.flash('error_msg', 'New passwords do not match');
      return res.redirect('/spinspg/settings');
    }
    
    const [users] = await db.query('SELECT password FROM spinspg_users WHERE id = ?', [userId]);
    const match = await bcrypt.compare(current_password, users[0].password);
    
    if (!match) {
      req.flash('error_msg', 'Current password is incorrect');
      return res.redirect('/spinspg/settings');
    }
    
    const hash = await bcrypt.hash(new_password, 10);
    await db.query('UPDATE spinspg_users SET password = ? WHERE id = ?', [hash, userId]);
    
    req.flash('success_msg', 'Password changed successfully!');
  } catch(err) {
    req.flash('error_msg', 'Failed to change password');
  }
  res.redirect('/spinspg/settings');
});

app.post('/spinspg/settings/defaults', isSpinAuth, async (req, res) => {
  try {
    const { default_price, default_cycle } = req.body;
    const userId = req.session.spinUser.id;
    
    await db.query(
      'UPDATE spinspg_devices SET price_per_cycle = ? WHERE owner_id = ?',
      [default_price, userId]
    );
    
    req.flash('success_msg', 'Default settings updated!');
  } catch(err) {
    req.flash('error_msg', 'Failed to update defaults');
  }
  res.redirect('/spinspg/settings');
});

// ============================================
// REPORTS ENHANCEMENT
// ============================================

app.get('/spinspg/export/orders', isSpinAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [orders] = await db.query(
      'SELECT order_number, customer_name, service_type, cycle_type, price, payment_status, order_status, created_at FROM spinspg_orders WHERE user_id = ? ORDER BY created_at DESC',
      [userId]
    );
    
    let csv = 'Order Number,Customer,Service,Cycle,Price,Payment,Status,Date\n';
    orders.forEach(o => {
      csv += `${o.order_number},${o.customer_name},${o.service_type},${o.cycle_type},${o.price},${o.payment_status},${o.order_status},${o.created_at}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=spinspring_orders_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch(err) {
    res.redirect('/spinspg/reports');
  }
});

app.get('/spinspg/export/revenue', isSpinAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [devices] = await db.query(
      'SELECT device_name, device_type, cycles_completed, today_revenue, total_revenue FROM spinspg_devices WHERE owner_id = ?',
      [userId]
    );
    
    let csv = 'Machine,Type,Total Cycles,Today Revenue,Total Revenue\n';
    devices.forEach(d => {
      csv += `${d.device_name},${d.device_type},${d.cycles_completed},${d.today_revenue},${d.total_revenue}\n`;
    });
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=spinspring_revenue_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch(err) {
    res.redirect('/spinspg/reports');
  }
});

app.get('/spinspg/api/chart-data', isSpinAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    
    const [daily] = await db.query(`
      SELECT DATE(created_at) as date, SUM(price) as revenue, COUNT(*) as orders
      FROM spinspg_orders
      WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date
    `, [userId]);
    
    const [hourly] = await db.query(`
      SELECT HOUR(created_at) as hour, COUNT(*) as orders
      FROM spinspg_orders
      WHERE user_id = ? AND created_at >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
      GROUP BY HOUR(created_at)
      ORDER BY hour
    `, [userId]);
    
    res.json({ success: true, daily, hourly });
  } catch(err) {
    res.json({ success: false });
  }
});

// ============================================
// WEIGHT-BASED PRICING SYSTEM
// ============================================

function calculateWeightPrice(weightKg, pricePerKg) {
  if (!weightKg || !pricePerKg) return 0;
  return parseFloat((weightKg * pricePerKg).toFixed(2));
}

app.post('/spinspg/device/:deviceId/weight-settings', isSpinAuth, async (req, res) => {
  try {
    const { price_per_kg, max_capacity_kg, min_capacity_kg } = req.body;
    const userId = req.session.spinUser.id;
    
    await db.query(
      'UPDATE spinspg_devices SET price_per_kg = ?, max_capacity_kg = ?, min_capacity_kg = ? WHERE device_id = ? AND owner_id = ?',
      [price_per_kg, max_capacity_kg, min_capacity_kg || 1, req.params.deviceId, userId]
    );
    
    req.flash('success_msg', 'Weight settings updated!');
    res.redirect(`/spinspg/device/${req.params.deviceId}`);
  } catch(err) {
    req.flash('error_msg', 'Failed to update weight settings');
    res.redirect(`/spinspg/device/${req.params.deviceId}`);
  }
});

app.post('/spinspg/attendant/orders', isSpinAttendant, async (req, res) => {
  try {
    const { device_id, customer_id, service_type, cycle_type, weight_kg, payment_status } = req.body;
    const ownerId = req.session.spinUser.ownerId;
    const orderNumber = 'SS-' + Date.now().toString(36).toUpperCase();
    
    const [devices] = await db.query(
      'SELECT price_per_kg, max_capacity_kg, min_capacity_kg FROM spinspg_devices WHERE device_id = ?',
      [device_id]
    );
    
    if (devices.length === 0) {
      req.flash('error_msg', 'Machine not found');
      return res.redirect('/spinspg/attendant');
    }
    
    const machine = devices[0];
    const weight = parseFloat(weight_kg);
    
    if (weight > parseFloat(machine.max_capacity_kg)) {
      req.flash('error_msg', `Weight exceeds machine capacity! Max: ${machine.max_capacity_kg}kg`);
      return res.redirect('/spinspg/attendant');
    }
    
    if (weight < parseFloat(machine.min_capacity_kg || 1)) {
      req.flash('error_msg', `Weight below minimum! Min: ${machine.min_capacity_kg || 1}kg`);
      return res.redirect('/spinspg/attendant');
    }
    
    const totalPrice = calculateWeightPrice(weight, parseFloat(machine.price_per_kg));
    
    await db.query(
      `INSERT INTO spinspg_orders (order_number, device_id, user_id, customer_name, service_type, cycle_type, price, weight_kg, price_per_kg, total_weight_price, payment_status, order_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'queued')`,
      [orderNumber, device_id, ownerId, customer_id, service_type, cycle_type, totalPrice, weight, machine.price_per_kg, totalPrice, payment_status]
    );
    
    if (customer_id !== 'walk-in') {
      await db.query(
        'UPDATE spinspg_customers SET total_cycles = total_cycles + 1, total_spent = total_spent + ?, loyalty_points = loyalty_points + FLOOR(?/100) WHERE customer_unique_id = ?',
        [totalPrice, totalPrice, customer_id]
      );
    }
    
    req.flash('success_msg', `Order ${orderNumber} created! ${weight}kg × Ksh ${machine.price_per_kg}/kg = Ksh ${totalPrice}`);
    res.redirect('/spinspg/attendant');
  } catch(err) {
    console.error('Order error:', err);
    req.flash('error_msg', 'Failed to create order');
    res.redirect('/spinspg/attendant');
  }
});

app.get('/spinspg/api/machine/:deviceId/weight', isSpinAuth, async (req, res) => {
  try {
    const [devices] = await db.query(
      'SELECT price_per_kg, max_capacity_kg, min_capacity_kg FROM spinspg_devices WHERE device_id = ?',
      [req.params.deviceId]
    );
    if (devices.length === 0) {
      return res.json({ success: false, error: 'Machine not found' });
    }
    res.json({ success: true, machine: devices[0] });
  } catch(err) {
    res.json({ success: false, error: err.message });
  }
});

// ============================================
// CUEPAY ANALYTICS & REPORTS
// ============================================

async function getDeviceStats(deviceId, startDate, endDate) {
  const [stats] = await db.query(
    `SELECT
      COUNT(*) as total_payments,
      COALESCE(SUM(games_earned), 0) as total_games,
      COALESCE(SUM(amount), 0) as total_revenue,
      COALESCE(AVG(amount), 0) as avg_payment,
      COUNT(DISTINCT customer_number) as unique_customers,
      MIN(payment_time) as first_payment,
      MAX(payment_time) as last_payment
     FROM cuepay_payments
     WHERE device_id = ? AND payment_time >= ? AND payment_time <= ?`,
    [deviceId, startDate, endDate]
  );
  return stats[0];
}

async function getPeakHour(deviceId, date) {
  const [hours] = await db.query(
    `SELECT HOUR(payment_time) as hour, COUNT(*) as count, SUM(amount) as revenue
     FROM cuepay_payments
     WHERE device_id = ? AND DATE(payment_time) = ?
     GROUP BY HOUR(payment_time)
     ORDER BY count DESC LIMIT 1`,
    [deviceId, date]
  );
  return hours[0] || null;
}

app.get('/cuepay/dashboard', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];

    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE owner_id = ? ORDER BY created_at DESC',
      [userId]
    );

    for (let device of devices) {
      device.battery_percent = device.battery_voltage ?
        Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
      device.battery_percent = Math.max(0, Math.min(100, device.battery_percent));
      device.is_online = device.status === 'online';

      const todayStats = await getDeviceStats(device.device_id, today + ' 00:00:00', today + ' 23:59:59');
      device.today_games = todayStats.total_games;
      device.today_revenue = todayStats.total_revenue;
      device.today_payments = todayStats.total_payments;
      device.today_customers = todayStats.unique_customers;

      const weekStats = await getDeviceStats(device.device_id, weekAgo + ' 00:00:00', today + ' 23:59:59');
      device.week_games = weekStats.total_games;
      device.week_revenue = weekStats.total_revenue;
      device.week_avg_payment = weekStats.avg_payment;

      const monthStats = await getDeviceStats(device.device_id, monthAgo + ' 00:00:00', today + ' 23:59:59');
      device.month_games = monthStats.total_games;
      device.month_revenue = monthStats.total_revenue;

      const peak = await getPeakHour(device.device_id, today);
      device.peak_hour = peak ? peak.hour : null;
      device.peak_hour_count = peak ? peak.count : 0;

      const [dailyBreakdown] = await db.query(
        `SELECT DATE(payment_time) as date,
                SUM(amount) as revenue,
                SUM(games_earned) as games,
                COUNT(*) as payments
         FROM cuepay_payments
         WHERE device_id = ? AND payment_time >= ?
         GROUP BY DATE(payment_time)
         ORDER BY date DESC LIMIT 7`,
        [device.device_id, weekAgo + ' 00:00:00']
      );
      device.daily_breakdown = dailyBreakdown.reverse();

      const [recentPayments] = await db.query(
        'SELECT * FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 10',
        [device.device_id]
      );
      device.recent_payments = recentPayments;
    }

    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard - Ardthon Solutions',
      devices,
      user: req.session.cuepayUser
    });
  } catch(err) {
    console.error('Dashboard error:', err);
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices: [],
      user: req.session.cuepayUser
    });
  }
});

app.get('/cuepay/device/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const { deviceId } = req.params;
    const { period } = req.query;

    const [devices] = await db.query(
      'SELECT * FROM cuepay_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );

    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found');
      return res.redirect('/cuepay/dashboard');
    }

    const device = devices[0];
    device.battery_percent = device.battery_voltage ?
      Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;

    const today = new Date().toISOString().split('T')[0];
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
    const monthStart = new Date().toISOString().split('T')[0].substring(0, 7) + '-01';

    const todayStats = await getDeviceStats(deviceId, today + ' 00:00:00', today + ' 23:59:59');
    const weekStats = await getDeviceStats(deviceId, weekAgo + ' 00:00:00', today + ' 23:59:59');
    const monthStats = await getDeviceStats(deviceId, monthStart + ' 00:00:00', today + ' 23:59:59');

    const [hourlyBreakdown] = await db.query(
      `SELECT HOUR(payment_time) as hour,
              SUM(amount) as revenue,
              SUM(games_earned) as games,
              COUNT(*) as payments,
              COUNT(DISTINCT customer_number) as customers
       FROM cuepay_payments
       WHERE device_id = ? AND DATE(payment_time) = ?
       GROUP BY HOUR(payment_time)
       ORDER BY hour`,
      [deviceId, today]
    );

    const [dailyBreakdown] = await db.query(
      `SELECT DATE(payment_time) as date,
              SUM(amount) as revenue,
              SUM(games_earned) as games,
              COUNT(*) as payments,
              COUNT(DISTINCT customer_number) as customers
       FROM cuepay_payments
       WHERE device_id = ? AND payment_time >= ?
       GROUP BY DATE(payment_time)
       ORDER BY date DESC`,
      [deviceId, new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0] + ' 00:00:00']
    );

    const [weeklySummary] = await db.query(
      `SELECT YEARWEEK(payment_time, 1) as yw,
              MIN(DATE(payment_time)) as week_start,
              MAX(DATE(payment_time)) as week_end,
              SUM(amount) as revenue,
              SUM(games_earned) as games,
              COUNT(*) as payments
       FROM cuepay_payments
       WHERE device_id = ? AND payment_time >= ?
       GROUP BY YEARWEEK(payment_time, 1)
       ORDER BY yw DESC LIMIT 12`,
      [deviceId, new Date(Date.now() - 84 * 86400000).toISOString().split('T')[0] + ' 00:00:00']
    );

    const [topCustomers] = await db.query(
      `SELECT customer_number,
              COUNT(*) as visits,
              SUM(amount) as total_spent,
              SUM(games_earned) as total_games,
              MAX(payment_time) as last_visit
       FROM cuepay_payments
       WHERE device_id = ? AND customer_number != 'Unknown'
       GROUP BY customer_number
       ORDER BY total_spent DESC LIMIT 10`,
      [deviceId]
    );

    const [payments] = await db.query(
      'SELECT * FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 50',
      [deviceId]
    );

    const [commands] = await db.query(
      "SELECT * FROM cuepay_commands WHERE device_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 10",
      [deviceId]
    );

    res.render('cuepay/device-detail', {
      title: `${device.device_name} - CuePay Analytics`,
      device,
      todayStats,
      weekStats,
      monthStats,
      hourlyBreakdown,
      dailyBreakdown,
      weeklySummary,
      topCustomers,
      payments,
      commands,
      selectedPeriod: period || 'today'
    });
  } catch(err) {
    console.error('Device detail error:', err);
    res.redirect('/cuepay/dashboard');
  }
});

app.get('/cuepay/api/analytics/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const { deviceId } = req.params;

    const [devices] = await db.query(
      'SELECT id FROM cuepay_devices WHERE device_id = ? AND owner_id = ?',
      [deviceId, userId]
    );
    if (devices.length === 0) return res.status(403).json({ error: 'Access denied' });

    const today = new Date().toISOString().split('T')[0];

    const [hourly] = await db.query(
      `SELECT HOUR(payment_time) as hour, SUM(amount) as revenue, SUM(games_earned) as games, COUNT(*) as payments
       FROM cuepay_payments WHERE device_id = ? AND DATE(payment_time) = ?
       GROUP BY HOUR(payment_time) ORDER BY hour`,
      [deviceId, today]
    );

    const [daily] = await db.query(
      `SELECT DATE(payment_time) as date, SUM(amount) as revenue, SUM(games_earned) as games
       FROM cuepay_payments WHERE device_id = ? AND payment_time >= ?
       GROUP BY DATE(payment_time) ORDER BY date DESC LIMIT 7`,
      [deviceId, new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0] + ' 00:00:00']
    );

    res.json({ hourly: hourly.reverse(), daily: daily.reverse() });
  } catch(err) {
    res.status(500).json({ error: 'Failed to get analytics' });
  }
});

// ============================================
// FINANCIAL REPORTS
// ============================================

app.get('/cuepay/reports/daily', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const date = req.query.date || new Date().toISOString().split('T')[0];

    const [devices] = await db.query(
      'SELECT device_id, device_name FROM cuepay_devices WHERE owner_id = ?',
      [userId]
    );

    const reports = [];
    for (const device of devices) {
      const [stats] = await db.query(
        `SELECT
          COUNT(*) as payments,
          SUM(amount) as revenue,
          SUM(games_earned) as games,
          COUNT(DISTINCT customer_number) as customers,
          AVG(amount) as avg_payment,
          MIN(payment_time) as first_game,
          MAX(payment_time) as last_game
         FROM cuepay_payments
         WHERE device_id = ? AND DATE(payment_time) = ?`,
        [device.device_id, date]
      );

      const [hourly] = await db.query(
        `SELECT HOUR(payment_time) as hour, SUM(amount) as revenue, COUNT(*) as payments
         FROM cuepay_payments WHERE device_id = ? AND DATE(payment_time) = ?
         GROUP BY HOUR(payment_time) ORDER BY hour`,
        [device.device_id, date]
      );

      reports.push({
        ...device,
        stats: stats[0],
        hourly_breakdown: hourly
      });
    }

    const [goals] = await db.query(
      'SELECT * FROM cuepay_goals WHERE owner_id = ? AND is_active = 1 AND start_date <= ? AND (end_date >= ? OR end_date IS NULL)',
      [userId, date, date]
    );

    res.render('cuepay/reports/daily', {
      title: 'Daily Report - CuePay',
      reports,
      goals,
      selectedDate: date,
      user: req.session.cuepayUser
    });
  } catch(err) {
    console.error('Daily report error:', err);
    res.redirect('/cuepay/dashboard');
  }
});

app.get('/cuepay/reports/weekly', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const [devices] = await db.query('SELECT device_id, device_name FROM cuepay_devices WHERE owner_id = ?', [userId]);

    const reports = [];
    for (const device of devices) {
      const [dailyStats] = await db.query(
        `SELECT DATE(payment_time) as date,
                DAYNAME(payment_time) as day_name,
                SUM(amount) as revenue,
                SUM(games_earned) as games,
                COUNT(*) as payments,
                COUNT(DISTINCT customer_number) as customers
         FROM cuepay_payments
         WHERE device_id = ? AND payment_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)
         GROUP BY DATE(payment_time)
         ORDER BY date DESC`,
        [device.device_id]
      );

      const [weekTotal] = await db.query(
        `SELECT SUM(amount) as total_revenue, SUM(games_earned) as total_games, COUNT(*) as total_payments
         FROM cuepay_payments WHERE device_id = ? AND payment_time >= DATE_SUB(CURDATE(), INTERVAL 7 DAY)`,
        [device.device_id]
      );

      reports.push({ ...device, daily: dailyStats, total: weekTotal[0] });
    }

    res.render('cuepay/reports/weekly', {
      title: 'Weekly Report - CuePay',
      reports,
      user: req.session.cuepayUser
    });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

app.get('/cuepay/reports/monthly', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const month = req.query.month || new Date().toISOString().substring(0, 7);

    const [devices] = await db.query('SELECT device_id, device_name FROM cuepay_devices WHERE owner_id = ?', [userId]);

    const reports = [];
    for (const device of devices) {
      const [weeklyStats] = await db.query(
        `SELECT WEEK(payment_time, 1) as week_num,
                MIN(DATE(payment_time)) as week_start,
                SUM(amount) as revenue,
                SUM(games_earned) as games,
                COUNT(*) as payments
         FROM cuepay_payments
         WHERE device_id = ? AND DATE_FORMAT(payment_time, '%Y-%m') = ?
         GROUP BY WEEK(payment_time, 1)
         ORDER BY week_num`,
        [device.device_id, month]
      );

      const [monthTotal] = await db.query(
        `SELECT SUM(amount) as total_revenue, SUM(games_earned) as total_games,
                COUNT(*) as total_payments, COUNT(DISTINCT customer_number) as total_customers,
                AVG(amount) as avg_payment
         FROM cuepay_payments WHERE device_id = ? AND DATE_FORMAT(payment_time, '%Y-%m') = ?`,
        [device.device_id, month]
      );

      const prevMonth = month.substring(5) === '01' ?
        (parseInt(month.substring(0,4)) - 1) + '-12' :
        month.substring(0,5) + String(parseInt(month.substring(5)) - 1).padStart(2, '0');

      const [prevTotal] = await db.query(
        `SELECT SUM(amount) as prev_revenue FROM cuepay_payments
         WHERE device_id = ? AND DATE_FORMAT(payment_time, '%Y-%m') = ?`,
        [device.device_id, prevMonth]
      );

      const growth = prevTotal[0].prev_revenue > 0 ?
        ((monthTotal[0].total_revenue - prevTotal[0].prev_revenue) / prevTotal[0].prev_revenue * 100) : 0;

      reports.push({ ...device, weekly: weeklyStats, total: monthTotal[0], growth: growth.toFixed(1) });
    }

    res.render('cuepay/reports/monthly', {
      title: 'Monthly Report - CuePay',
      reports,
      selectedMonth: month,
      user: req.session.cuepayUser
    });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

app.get('/cuepay/export/csv/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const [payments] = await db.query(
      'SELECT transaction_id, amount, customer_number, games_earned, payment_time FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 1000',
      [deviceId]
    );

    let csv = 'Transaction ID,Amount,Customer,Games,Date Time\n';
    payments.forEach(p => {
      csv += `${p.transaction_id},${p.amount},${p.customer_number},${p.games_earned},${p.payment_time}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=cuepay_${deviceId}_${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csv);
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// ============================================
// CUSTOMER ANALYTICS
// ============================================

async function getCustomerRetention(deviceId, days) {
  const [result] = await db.query(
    `SELECT
      COUNT(DISTINCT customer_number) as total_customers,
      COUNT(DISTINCT CASE WHEN visits >= 2 THEN customer_number END) as returning_customers,
      COUNT(DISTINCT CASE WHEN visits = 1 THEN customer_number END) as new_customers
     FROM (
       SELECT customer_number, COUNT(*) as visits
       FROM cuepay_payments
       WHERE device_id = ? AND payment_time >= DATE_SUB(NOW(), INTERVAL ? DAY)
         AND customer_number != 'Unknown'
       GROUP BY customer_number
     ) t`,
    [deviceId, days]
  );
  return result[0];
}

app.get('/cuepay/customers/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const [topCustomers] = await db.query(
      `SELECT customer_number,
              COUNT(*) as visits,
              SUM(amount) as total_spent,
              SUM(games_earned) as total_games,
              AVG(amount) as avg_spend,
              MAX(payment_time) as last_visit,
              MIN(payment_time) as first_visit
       FROM cuepay_payments
       WHERE device_id = ? AND customer_number != 'Unknown'
       GROUP BY customer_number
       ORDER BY total_spent DESC LIMIT 20`,
      [deviceId]
    );

    const retention = await getCustomerRetention(deviceId, 30);

    res.render('cuepay/customers', {
      title: 'Customer Analytics - CuePay',
      topCustomers,
      retention,
      deviceId,
      user: req.session.cuepayUser
    });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// ============================================
// TABLE PERFORMANCE
// ============================================

app.get('/cuepay/compare', isCuePayAuth, async (req, res) => {
  try {
    const userId = req.session.cuepayUser.id;
    const period = req.query.period || '7';

    const [devices] = await db.query(
      `SELECT d.*,
        (SELECT SUM(amount) FROM cuepay_payments WHERE device_id = d.device_id AND payment_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) as period_revenue,
        (SELECT SUM(games_earned) FROM cuepay_payments WHERE device_id = d.device_id AND payment_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) as period_games,
        (SELECT COUNT(*) FROM cuepay_payments WHERE device_id = d.device_id AND payment_time >= DATE_SUB(NOW(), INTERVAL ? DAY)) as period_payments
       FROM cuepay_devices d WHERE d.owner_id = ?
       ORDER BY period_revenue DESC`,
      [parseInt(period), parseInt(period), userId]
    );

    res.render('cuepay/compare', {
      title: 'Table Comparison - CuePay',
      devices,
      selectedPeriod: period,
      user: req.session.cuepayUser
    });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// ============================================
// GOALS MANAGEMENT
// ============================================

app.post('/cuepay/goals', isCuePayAuth, async (req, res) => {
  try {
    const { device_id, goal_type, target_revenue, target_games, start_date } = req.body;
    await db.query(
      'INSERT INTO cuepay_goals (owner_id, device_id, goal_type, target_revenue, target_games, start_date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.session.cuepayUser.id, device_id || null, goal_type, target_revenue, target_games || null, start_date]
    );
    req.flash('success_msg', 'Goal set successfully!');
    res.redirect('/cuepay/dashboard');
  } catch(err) {
    req.flash('error_msg', 'Failed to set goal');
    res.redirect('/cuepay/dashboard');
  }
});

// ============================================
// STAFF MANAGEMENT
// ============================================

app.get('/cuepay/staff', isCuePayAuth, async (req, res) => {
  try {
    const [staff] = await db.query('SELECT * FROM cuepay_staff WHERE owner_id = ? ORDER BY full_name', [req.session.cuepayUser.id]);
    res.render('cuepay/staff', { title: 'Staff Management - CuePay', staff, user: req.session.cuepayUser });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

app.post('/cuepay/staff', isCuePayAuth, async (req, res) => {
  try {
    const { full_name, email, phone, pin_code, role, commission_percent } = req.body;
    await db.query(
      'INSERT INTO cuepay_staff (owner_id, full_name, email, phone, pin_code, role, commission_percent) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.session.cuepayUser.id, full_name, email, phone, pin_code, role, commission_percent || 0]
    );
    req.flash('success_msg', 'Staff added!');
    res.redirect('/cuepay/staff');
  } catch(err) {
    req.flash('error_msg', 'Failed to add staff');
    res.redirect('/cuepay/staff');
  }
});

// ============================================
// ALERTS
// ============================================

app.get('/cuepay/alerts', isCuePayAuth, async (req, res) => {
  try {
    const [alerts] = await db.query('SELECT * FROM cuepay_alerts WHERE owner_id = ?', [req.session.cuepayUser.id]);
    const [history] = await db.query(
      'SELECT * FROM cuepay_alert_history WHERE owner_id = ? ORDER BY created_at DESC LIMIT 20',
      [req.session.cuepayUser.id]
    );
    res.render('cuepay/alerts', { title: 'Alert Settings - CuePay', alerts, history, user: req.session.cuepayUser });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

app.post('/cuepay/alerts/toggle/:id', isCuePayAuth, async (req, res) => {
  await db.query('UPDATE cuepay_alerts SET is_enabled = NOT is_enabled WHERE id = ? AND owner_id = ?', [req.params.id, req.session.cuepayUser.id]);
  res.redirect('/cuepay/alerts');
});

// ============================================
// MAINTENANCE LOG
// ============================================

app.get('/cuepay/maintenance/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const [logs] = await db.query('SELECT * FROM cuepay_maintenance WHERE device_id = ? ORDER BY created_at DESC', [req.params.deviceId]);
    res.render('cuepay/maintenance', { title: 'Maintenance Log - CuePay', logs, deviceId: req.params.deviceId, user: req.session.cuepayUser });
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

app.post('/cuepay/maintenance/:deviceId', isCuePayAuth, async (req, res) => {
  try {
    const { maintenance_type, description, performed_by, cost, next_due_date } = req.body;
    await db.query(
      'INSERT INTO cuepay_maintenance (device_id, maintenance_type, description, performed_by, cost, next_due_date) VALUES (?, ?, ?, ?, ?, ?)',
      [req.params.deviceId, maintenance_type, description, performed_by, cost, next_due_date || null]
    );
    req.flash('success_msg', 'Maintenance logged!');
    res.redirect(`/cuepay/maintenance/${req.params.deviceId}`);
  } catch(err) {
    res.redirect('/cuepay/dashboard');
  }
});

// ============================================
// M-PESA DARAJA INTEGRATION
// ============================================

const mpesa = require('./modules/mpesa');

app.post('/spinspg/api/mpesa/stkpush', isSpinAuth, async (req, res) => {
  try {
    const { phone_number, amount, order_number, device_id } = req.body;
    const ownerId = req.session.spinUser.id;
    
    let formattedPhone = phone_number.replace(/\D/g, '');
    if (formattedPhone.startsWith('0')) formattedPhone = '254' + formattedPhone.substring(1);
    if (!formattedPhone.startsWith('254')) formattedPhone = '254' + formattedPhone;
    
    const result = await mpesa.stkPush(formattedPhone, amount, order_number || 'SpinSpring', 'Laundry Payment');
    
    if (result.success) {
      await db.query(
        "INSERT INTO spinspg_mpesa_transactions (owner_id, device_id, order_number, checkout_request_id, merchant_request_id, phone_number, amount, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')",
        [ownerId, device_id, order_number, result.CheckoutRequestID, result.MerchantRequestID, formattedPhone, amount]
      );
      res.json({ success: true, checkout_request_id: result.CheckoutRequestID, message: result.CustomerMessage || 'STK Push sent. Enter PIN.' });
    } else {
      res.json({ success: false, error: result.error });
    }
  } catch(err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/spinspg/api/mpesa/query', isSpinAuth, async (req, res) => {
  try {
    const result = await mpesa.stkPushQuery(req.body.checkout_request_id);
    res.json(result);
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/spinspg/api/mpesa/callback', async (req, res) => {
  try {
    const stkCallback = req.body.Body?.stkCallback;
    if (stkCallback) {
      const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = stkCallback;
      let mpesaReceiptNumber = null, amount = null, transactionDate = null;
      
      if (CallbackMetadata?.Item) {
        CallbackMetadata.Item.forEach(item => {
          if (item.Name === 'MpesaReceiptNumber') mpesaReceiptNumber = item.Value;
          if (item.Name === 'Amount') amount = item.Value;
          if (item.Name === 'TransactionDate') transactionDate = item.Value;
        });
      }
      
      if (ResultCode === 0) {
        await db.query(
          "UPDATE spinspg_mpesa_transactions SET status = 'success', mpesa_receipt_number = ?, transaction_date = ? WHERE checkout_request_id = ?",
          [mpesaReceiptNumber, transactionDate, CheckoutRequestID]
        );
        const [transactions] = await db.query('SELECT * FROM spinspg_mpesa_transactions WHERE checkout_request_id = ?', [CheckoutRequestID]);
        if (transactions.length > 0 && transactions[0].order_number) {
          await db.query("UPDATE spinspg_orders SET payment_status = 'paid' WHERE order_number = ?", [transactions[0].order_number]);
          if (transactions[0].device_id && amount) {
            await db.query('UPDATE spinspg_devices SET today_revenue = today_revenue + ?, total_revenue = total_revenue + ? WHERE device_id = ?', [amount, amount, transactions[0].device_id]);
          }
        }
      } else {
        await db.query("UPDATE spinspg_mpesa_transactions SET status = 'failed' WHERE checkout_request_id = ?", [CheckoutRequestID]);
      }
    }
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/spinspg/api/mpesa/callback/validation', (req, res) => {
  res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
});

app.post('/spinspg/api/mpesa/callback/confirmation', async (req, res) => {
  try {
    const { TransID, TransAmount, BillRefNumber, MSISDN, TransTime } = req.body;
    await db.query(
      "INSERT INTO spinspg_mpesa_transactions (owner_id, transaction_id, amount, phone_number, status, mpesa_receipt_number, transaction_date) VALUES (?, ?, ?, ?, 'success', ?, ?)",
      [1, TransID, TransAmount, MSISDN, TransID, TransTime]
    );
    await db.query("UPDATE spinspg_orders SET payment_status = 'paid' WHERE order_number = ?", [BillRefNumber]);
    res.json({ success: true });
  } catch(err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/spinspg/mpesa-settings', isSpinAuth, async (req, res) => {
  try {
    const userId = req.session.spinUser.id;
    const [config] = await db.query('SELECT * FROM spinspg_mpesa_config WHERE owner_id = ?', [userId]);
    res.render('spinspring/mpesa-settings', {
      title: 'M-PESA Settings - SpinSpring',
      config: config[0] || {},
      user: req.session.spinUser
    });
  } catch(err) {
    res.render('spinspring/mpesa-settings', { title: 'M-PESA Settings', config: {}, user: req.session.spinUser });
  }
});

app.post('/spinspg/mpesa-settings', isSpinAuth, async (req, res) => {
  try {
    const { business_shortcode, consumer_key, consumer_secret, passkey, account_type } = req.body;
    const userId = req.session.spinUser.id;
    await db.query(
      "INSERT INTO spinspg_mpesa_config (owner_id, business_shortcode, consumer_key, consumer_secret, passkey, account_type) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE business_shortcode = ?, consumer_key = ?, consumer_secret = ?, passkey = ?, account_type = ?",
      [userId, business_shortcode, consumer_key, consumer_secret, passkey, account_type, business_shortcode, consumer_key, consumer_secret, passkey, account_type]
    );
    req.flash('success_msg', 'M-PESA settings saved!');
    res.redirect('/spinspg/mpesa-settings');
  } catch(err) {
    req.flash('error_msg', 'Failed to save');
    res.redirect('/spinspg/mpesa-settings');
  }
});

app.post('/spinspg/mpesa/register-urls', isSpinAuth, async (req, res) => {
  const result = await mpesa.registerC2BUrls();
  if (result.success) req.flash('success_msg', 'C2B URLs registered!');
  else req.flash('error_msg', 'Failed: ' + result.error);
  res.redirect('/spinspg/mpesa-settings');
});

// ============================================
// 404 & ERROR HANDLERS
// ============================================

app.use((req, res) => {
  res.status(404).render('404', { title: 'Page Not Found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).render('error', { title: 'Server Error', message: 'Something went wrong', error: {} });
});

// ============================================
// START SERVER
// ============================================

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
});