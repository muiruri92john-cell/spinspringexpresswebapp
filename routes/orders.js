const express = require('express');
const router = express.Router();

router.get('/cart', (req, res) => {
  const cart = req.session.cart || [];
  let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('cart', { title: 'Shopping Cart - Ardthon Solutions', cart, total });
});

router.post('/cart/update', (req, res) => {
  const { productId, quantity } = req.body;
  if (!req.session.cart) req.session.cart = [];
  const item = req.session.cart.find(i => i.product == productId);
  if (item) {
    if (parseInt(quantity) > 0) {
      item.quantity = parseInt(quantity);
    } else {
      req.session.cart = req.session.cart.filter(i => i.product != productId);
    }
  }
  res.redirect('/orders/cart');
});

router.get('/checkout', (req, res) => {
  if (!req.session.user) {
    req.flash('error_msg', 'Please login to checkout');
    return res.redirect('/auth/login');
  }
  const cart = req.session.cart || [];
  if (cart.length === 0) {
    req.flash('error_msg', 'Cart is empty');
    return res.redirect('/products');
  }
  let total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  res.render('checkout', { title: 'Checkout - Ardthon Solutions', cart, total });
});

router.post('/checkout', async (req, res) => {
  try {
    const cart = req.session.cart;
    if (!cart || cart.length === 0) return res.redirect('/products');
    const totalAmount = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const orderNumber = 'ARD-' + Date.now();
    await req.db.query(
      `INSERT INTO orders (orderNumber, userId, items, totalAmount, shippingAddress, status, paymentStatus)
       VALUES (?, ?, ?, ?, ?, 'pending', 'pending')`,
      [orderNumber, req.session.user.id, JSON.stringify(cart), totalAmount, JSON.stringify(req.body)]
    );
    req.session.cart = [];
    req.flash('success_msg', 'Order placed successfully!');
    res.redirect('/dashboard');
  } catch (err) {
    console.error('Checkout error:', err);
    req.flash('error_msg', 'Error processing order');
    res.redirect('/orders/cart');
  }
});

module.exports = router;