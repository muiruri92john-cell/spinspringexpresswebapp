const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

// CuePay Login Page
router.get('/login', (req, res) => {
  if (req.session.cuepayUser) return res.redirect('/cuepay/dashboard');
  res.render('cuepay/login', { title: 'CuePay Login - Ardthon Solutions' });
});

// CuePay Login Handle
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [users] = await req.db.query('SELECT * FROM cuepay_users WHERE email = ?', [email]);
    if (users.length === 0) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/cuepay/login');
    }
    const user = users[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      req.flash('error_msg', 'Invalid credentials');
      return res.redirect('/cuepay/login');
    }
    req.session.cuepayUser = {
      id: user.id,
      email: user.email,
      name: user.full_name,
      business: user.business_name
    };
    res.redirect('/cuepay/dashboard');
  } catch (err) {
    console.error('CuePay login error:', err);
    req.flash('error_msg', 'Login failed');
    res.redirect('/cuepay/login');
  }
});

// CuePay Dashboard
router.get('/dashboard', async (req, res) => {
  if (!req.session.cuepayUser) return res.redirect('/cuepay/login');
  try {
    const userId = req.session.cuepayUser.id;
    const [devices] = await req.db.query(
      `SELECT d.*, l.games_available, l.battery_voltage, l.gsm_connected,
              l.total_revenue, l.today_revenue, l.today_games, l.updated_at as last_data
       FROM cuepay_devices d
       LEFT JOIN cuepay_live_data l ON d.device_id = l.device_id
       WHERE d.owner_id = ?
       ORDER BY d.created_at DESC`,
      [userId]
    );
    devices.forEach(d => {
      d.battery_percent = d.battery_voltage ? Math.round(((d.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
      d.battery_percent = Math.max(0, Math.min(100, d.battery_percent));
      d.last_activity = d.last_sync ? timeAgo(d.last_sync) : 'Never';
    });
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices,
      user: req.session.cuepayUser
    });
  } catch (err) {
    console.error('CuePay dashboard error:', err);
    res.render('cuepay/dashboard', {
      title: 'CuePay Dashboard',
      devices: [],
      user: req.session.cuepayUser
    });
  }
});

// Register Device Page
router.get('/register-device', (req, res) => {
  if (!req.session.cuepayUser) return res.redirect('/cuepay/login');
  res.render('cuepay/register-device', { title: 'Register CuePay Device' });
});

// Register Device Handle
router.post('/register-device', async (req, res) => {
  if (!req.session.cuepayUser) return res.redirect('/cuepay/login');
  try {
    const { device_id, device_name, location, game_price } = req.body;
    const ownerId = req.session.cuepayUser.id;
    const [existing] = await req.db.query('SELECT id FROM cuepay_devices WHERE device_id = ?', [device_id]);
    if (existing.length > 0) {
      req.flash('error_msg', 'Device ID already registered');
      return res.redirect('/cuepay/register-device');
    }
    const apiKey = crypto.randomBytes(32).toString('hex');
    await req.db.query(
      `INSERT INTO cuepay_devices (device_id, device_name, api_key, owner_id, location_area, game_price, status)
       VALUES (?, ?, ?, ?, ?, ?, 'offline')`,
      [device_id, device_name, apiKey, ownerId, location, game_price || 10]
    );
    req.session.newDeviceApiKey = apiKey;
    req.session.newDeviceId = device_id;
    req.flash('success_msg', 'Device registered!');
    res.redirect('/cuepay/device-credentials');
  } catch (err) {
    console.error('Device register error:', err);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/cuepay/register-device');
  }
});

// Device Credentials
router.get('/device-credentials', (req, res) => {
  if (!req.session.cuepayUser) return res.redirect('/cuepay/login');
  const apiKey = req.session.newDeviceApiKey;
  const deviceId = req.session.newDeviceId;
  if (!apiKey || !deviceId) return res.redirect('/cuepay/dashboard');
  delete req.session.newDeviceApiKey;
  delete req.session.newDeviceId;
  res.render('cuepay/device-credentials', { title: 'Device Credentials', apiKey, deviceId });
});

// Device Detail
router.get('/device/:deviceId', async (req, res) => {
  if (!req.session.cuepayUser) return res.redirect('/cuepay/login');
  try {
    const { deviceId } = req.params;
    const userId = req.session.cuepayUser.id;
    const [devices] = await req.db.query(
      `SELECT d.*, l.* FROM cuepay_devices d
       LEFT JOIN cuepay_live_data l ON d.device_id = l.device_id
       WHERE d.device_id = ? AND d.owner_id = ?`,
      [deviceId, userId]
    );
    if (devices.length === 0) {
      req.flash('error_msg', 'Device not found');
      return res.redirect('/cuepay/dashboard');
    }
    const [payments] = await req.db.query(
      'SELECT * FROM cuepay_payments WHERE device_id = ? ORDER BY payment_time DESC LIMIT 50',
      [deviceId]
    );
    const device = devices[0];
    device.battery_percent = device.battery_voltage ? Math.round(((device.battery_voltage - 10.5) / (12.6 - 10.5)) * 100) : 0;
    device.last_activity = device.last_sync ? timeAgo(device.last_sync) : 'Never';
    res.render('cuepay/device-detail', {
      title: `${device.device_name} - CuePay`,
      device,
      payments
    });
  } catch (err) {
    console.error('Device detail error:', err);
    res.redirect('/cuepay/dashboard');
  }
});

// Logout
router.get('/logout', (req, res) => {
  delete req.session.cuepayUser;
  res.redirect('/cuepay/login');
});

// API: Device Sync
router.post('/api/sync', async (req, res) => {
  try {
    const deviceId = req.headers['x-device-id'];
    const apiKey = req.headers['x-api-key'];
    if (!deviceId || !apiKey) return res.status(401).json({ error: 'Missing credentials' });

    const [devices] = await req.db.query(
      'SELECT * FROM cuepay_devices WHERE device_id = ? AND api_key = ?',
      [deviceId, apiKey]
    );
    if (devices.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const data = req.body;
    await req.db.query(
      "UPDATE cuepay_devices SET status = 'online', last_sync = NOW() WHERE device_id = ?",
      [deviceId]
    );
    await req.db.query(
      `INSERT INTO cuepay_live_data (device_id, games_available, battery_voltage, gsm_connected, total_revenue, today_revenue, today_games)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE games_available=VALUES(games_available), battery_voltage=VALUES(battery_voltage),
       gsm_connected=VALUES(gsm_connected), total_revenue=VALUES(total_revenue), today_revenue=VALUES(today_revenue), today_games=VALUES(today_games)`,
      [deviceId, data.games_available || 0, data.battery_voltage || 0, data.gsm_connected || false,
       data.total_revenue || 0, data.today_revenue || 0, data.today_games || 0]
    );
    if (data.recent_payments) {
      for (const p of data.recent_payments) {
        await req.db.query(
          'INSERT IGNORE INTO cuepay_payments (device_id, transaction_id, amount, customer_number, games_earned) VALUES (?, ?, ?, ?, ?)',
          [deviceId, p.transaction_id, p.amount, p.customer, p.games]
        );
      }
    }
    res.json({ status: 'success', message: 'Sync complete', timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('CuePay sync error:', err);
    res.status(500).json({ error: 'Sync failed' });
  }
});

function timeAgo(timestamp) {
  if (!timestamp) return 'Never';
  const diff = Math.floor((Date.now() - new Date(timestamp).getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return Math.floor(diff / 60) + 'm ago';
  if (diff < 86400) return Math.floor(diff / 3600) + 'h ago';
  return Math.floor(diff / 86400) + 'd ago';
}

module.exports = router;