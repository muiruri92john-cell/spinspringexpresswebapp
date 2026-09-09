const express = require('express');
const router = express.Router();

// Homepage
router.get('/', async (req, res) => {
  let featuredProducts = [];
  let latestProjects = [];
  let latestBlogs = [];
  
  try {
    const [fp] = await req.db.query('SELECT * FROM products WHERE featured = 1 LIMIT 8');
    featuredProducts = fp;
    featuredProducts.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
    });
  } catch(e) { console.error('Products error:', e.message); }
  
  try {
    const [lp] = await req.db.query('SELECT * FROM projects WHERE isPublished = 1 ORDER BY createdAt DESC LIMIT 3');
    latestProjects = lp;
    latestProjects.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
    });
  } catch(e) { console.error('Projects error:', e.message); }
  
  try {
    const [lb] = await req.db.query("SELECT * FROM blogs WHERE status = 'published' ORDER BY createdAt DESC LIMIT 3");
    latestBlogs = lb;
  } catch(e) { console.error('Blogs error:', e.message); }
  
  res.render('index', {
    title: 'Ardthon Solutions - Connect With Ease',
    featuredProducts,
    latestProjects,
    latestBlogs
  });
});

// Static pages
router.get('/about', (req, res) => res.render('about', { title: 'About Us' }));
router.get('/contact', (req, res) => res.render('contact', { title: 'Contact Us' }));
router.get('/discord', (req, res) => res.render('discord', { title: 'Discord' }));

// Dashboard
router.get('/dashboard', (req, res) => {
  if (!req.session.user) return res.redirect('/auth/login');
  res.render('dashboard', { title: 'Dashboard', orders: [], userData: req.session.user });
});

module.exports = router;