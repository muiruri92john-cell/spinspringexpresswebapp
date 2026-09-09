const express = require('express');
const router = express.Router();

// List all products
router.get('/', async (req, res) => {
  try {
    const { category, search } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (category) {
      query += ' AND category = ?';
      params.push(category);
    }
    if (search) {
      query += ' AND (name LIKE ? OR description LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY createdAt DESC';

    const [products] = await req.db.query(query, params);
    const [categories] = await req.db.query('SELECT DISTINCT category FROM products');

    products.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
      try { p.specifications = JSON.parse(p.specifications || '[]'); } catch(e) { p.specifications = []; }
    });

    res.render('products', {
      title: 'Products - Ardthon Solutions',
      products,
      categories: categories.map(c => c.category),
      currentCategory: category || '',
      searchQuery: search || ''
    });
  } catch (err) {
    console.error('Products error:', err);
    res.redirect('/');
  }
});

// Single product
router.get('/:slug', async (req, res) => {
  try {
    const [products] = await req.db.query('SELECT * FROM products WHERE slug = ?', [req.params.slug]);

    if (products.length === 0) {
      req.flash('error_msg', 'Product not found');
      return res.redirect('/products');
    }

    const product = products[0];
    try { product.images = JSON.parse(product.images || '[]'); } catch(e) { product.images = []; }
    try { product.specifications = JSON.parse(product.specifications || '[]'); } catch(e) { product.specifications = []; }

    const [related] = await req.db.query(
      'SELECT * FROM products WHERE category = ? AND id != ? LIMIT 4',
      [product.category, product.id]
    );
    related.forEach(p => {
      try { p.images = JSON.parse(p.images || '[]'); } catch(e) { p.images = []; }
    });

    res.render('product-detail', {
      title: `${product.name} - Ardthon Solutions`,
      product,
      relatedProducts: related
    });
  } catch (err) {
    console.error('Product detail error:', err);
    res.redirect('/products');
  }
});

// Add to cart
router.post('/add-to-cart/:id', async (req, res) => {
  try {
    const [products] = await req.db.query('SELECT * FROM products WHERE id = ?', [req.params.id]);
    if (products.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = products[0];
    try { product.images = JSON.parse(product.images || '[]'); } catch(e) { product.images = []; }

    if (!req.session.cart) req.session.cart = [];

    const existing = req.session.cart.find(item => item.product == req.params.id);
    if (existing) {
      existing.quantity += 1;
    } else {
      req.session.cart.push({
        product: product.id,
        name: product.name,
        price: product.price,
        image: product.images[0]?.url || '/images/placeholder.jpg',
        quantity: 1
      });
    }

    res.json({ success: true, cartCount: req.session.cart.length });
  } catch (err) {
    res.status(500).json({ error: 'Error adding to cart' });
  }
});

module.exports = router;