const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const [blogs] = await req.db.query(
      `SELECT b.*, u.username, u.fullName 
       FROM blogs b 
       LEFT JOIN users u ON b.authorId = u.id 
       WHERE b.status = 'published' 
       ORDER BY b.createdAt DESC`
    );
    blogs.forEach(b => {
      try { b.tags = JSON.parse(b.tags || '[]'); } catch(e) { b.tags = []; }
    });
    res.render('blog', { title: 'Blog - Ardthon Solutions', blogs });
  } catch (err) {
    console.error('Blog error:', err);
    res.render('blog', { title: 'Blog', blogs: [] });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const [blogs] = await req.db.query(
      `SELECT b.*, u.username, u.fullName 
       FROM blogs b 
       LEFT JOIN users u ON b.authorId = u.id 
       WHERE b.slug = ? AND b.status = 'published'`,
      [req.params.slug]
    );
    if (blogs.length === 0) {
      req.flash('error_msg', 'Blog post not found');
      return res.redirect('/blog');
    }
    const blog = blogs[0];
    try { blog.tags = JSON.parse(blog.tags || '[]'); } catch(e) { blog.tags = []; }
    await req.db.query('UPDATE blogs SET views = views + 1 WHERE id = ?', [blog.id]);
    res.render('blog-detail', { title: `${blog.title} - Ardthon Solutions`, blog });
  } catch (err) {
    console.error('Blog detail error:', err);
    res.redirect('/blog');
  }
});

module.exports = router;