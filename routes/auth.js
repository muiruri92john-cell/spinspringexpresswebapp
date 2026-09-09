const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { isGuest, isAuth } = require('../middleware/auth');

// Login Page
router.get('/login', isGuest, (req, res) => {
  res.render('auth/login', { title: 'Login - Ardthon Solutions' });
});

// Register Page
router.get('/register', isGuest, (req, res) => {
  res.render('auth/register', { title: 'Create Account - Ardthon Solutions' });
});

// Register Handle
router.post('/register', isGuest, async (req, res) => {
  try {
    const { username, email, password, password2, fullName, phone, institution, field } = req.body;
    
    if (password !== password2) {
      req.flash('error_msg', 'Passwords do not match');
      return res.redirect('/auth/register');
    }
    
    if (password.length < 6) {
      req.flash('error_msg', 'Password must be at least 6 characters');
      return res.redirect('/auth/register');
    }

    const [existing] = await req.db.query(
      'SELECT id FROM users WHERE email = ? OR username = ?',
      [email, username]
    );

    if (existing.length > 0) {
      req.flash('error_msg', 'Email or username already registered');
      return res.redirect('/auth/register');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    await req.db.query(
      `INSERT INTO users (username, email, password, fullName, phone, institution, field, role)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'customer')`,
      [username, email, hashedPassword, fullName || '', phone || '', institution || '', field || 'Other']
    );

    req.flash('success_msg', 'Registration successful! Please log in.');
    res.redirect('/auth/login');
  } catch (err) {
    console.error('Register error:', err);
    req.flash('error_msg', 'Registration failed');
    res.redirect('/auth/register');
  }
});

// Login Handle
router.post('/login', isGuest, async (req, res) => {
  try {
    const { email, password } = req.body;

    const [users] = await req.db.query('SELECT * FROM users WHERE email = ?', [email]);

    if (users.length === 0) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    const user = users[0];
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      req.flash('error_msg', 'Invalid email or password');
      return res.redirect('/auth/login');
    }

    req.session.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
      fullName: user.fullName
    };

    req.flash('success_msg', `Welcome back, ${user.fullName || user.username}!`);
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Login error:', err);
    req.flash('error_msg', 'Login failed');
    res.redirect('/auth/login');
  }
});

// Logout
router.get('/logout', (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

module.exports = router;