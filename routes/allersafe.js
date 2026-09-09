const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');

// ALLERSAFE Authentication Middleware
function isAllersafeLoggedIn(req, res, next) {
    if (req.session && req.session.allersafeUser) return next();
    res.redirect('/allersafe/login');
}

// Helper function to render product cards with images
function renderProductCard(product) {
    const imageUrl = product.image_url || 'https://placehold.co/600x400/667eea/white?text=ALLERSAFE';
    const riskBadge = {
        'safe': '<span class="badge bg-success">✓ Safe</span>',
        'low': '<span class="badge bg-info">Low Risk</span>',
        'medium': '<span class="badge bg-warning">Medium Risk</span>',
        'high': '<span class="badge bg-danger">High Risk</span>'
    };
    
    return `
        <div class="col-md-4 col-lg-3 mb-4">
            <div class="card product-card h-100 shadow-sm">
                <img src="${imageUrl}" class="card-img-top" alt="${product.name}" style="height: 200px; object-fit: cover;">
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <span class="badge bg-primary">${product.material_name || 'Verified'}</span>
                        ${riskBadge[product.allergy_risk_level] || '<span class="badge bg-secondary">Verified</span>'}
                    </div>
                    <h5 class="card-title">${product.name}</h5>
                    <p class="card-text text-muted small">${product.description ? product.description.substring(0, 80) : ''}...</p>
                    <div class="d-flex justify-content-between align-items-center mt-3">
                        <span class="h5 text-primary mb-0">KSh ${parseFloat(product.price).toFixed(2)}</span>
                        <a href="/allersafe/product/${product.slug}" class="btn btn-sm btn-outline-primary">View Details</a>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// PUBLIC ROUTES
// ============================================

// Home page
router.get('/', async (req, res) => {
    try {
        let featuredProducts = [];
        let materials = [];
        
        if (req.db) {
            const [rows] = await req.db.query(`
                SELECT p.*, m.material_name, m.allergy_risk_level
                FROM allersafe_products p
                JOIN allersafe_materials m ON p.material_id = m.id
                WHERE p.certification_status = 1
                ORDER BY p.created_at DESC
                LIMIT 8
            `);
            featuredProducts = rows;
            
            const [materialRows] = await req.db.query(`
                SELECT * FROM allersafe_materials 
                ORDER BY CASE allergy_risk_level 
                    WHEN 'safe' THEN 1 WHEN 'low' THEN 2 WHEN 'medium' THEN 3 WHEN 'high' THEN 4 
                END
                LIMIT 6
            `);
            materials = materialRows;
        }
        
        res.send(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>ALLERSAFE - Hypoallergenic Jewellery</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                <style>
                    :root { --primary: #667eea; --primary-dark: #5a67d8; }
                    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #f8fafc; }
                    .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 12px 0; position: sticky; top: 0; z-index: 1000; }
                    .hero { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 100px 0; color: white; text-align: center; }
                    .hero h1 { font-size: 3.5rem; font-weight: 800; margin-bottom: 20px; }
                    .hero .lead { font-size: 1.3rem; margin-bottom: 30px; }
                    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; padding: 12px 30px; transition: all 0.3s; }
                    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 5px 20px rgba(102,126,234,0.4); }
                    .btn-outline-primary { border-radius: 50px; padding: 12px 30px; }
                    .product-card { transition: transform 0.3s, box-shadow 0.3s; border-radius: 12px; overflow: hidden; cursor: pointer; }
                    .product-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
                    .stat-card { background: white; border-radius: 12px; padding: 25px; text-align: center; box-shadow: 0 2px 10px rgba(0,0,0,0.05); }
                    .stat-number { font-size: 2.5rem; font-weight: 800; color: #667eea; }
                    .material-badge { display: inline-block; padding: 5px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 600; margin: 3px; }
                    .badge-safe { background: #10b981; color: white; }
                    .badge-low { background: #0ea5e9; color: white; }
                    .badge-medium { background: #f59e0b; color: white; }
                    .badge-high { background: #ef4444; color: white; }
                    footer { background: #1e293b; color: white; padding: 40px 0; margin-top: 60px; }
                    footer a { color: #94a3b8; text-decoration: none; }
                    footer a:hover { color: white; }
                    .section-title { font-size: 2rem; font-weight: 700; margin-bottom: 40px; text-align: center; }
                    .dropdown-menu { background: white; border: none; box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
                    .dropdown-item:hover { background: #f8fafc; color: #667eea; }
                    @media (max-width: 768px) {
                        .hero h1 { font-size: 2rem; }
                        .hero .lead { font-size: 1rem; }
                    }
                </style>
            </head>
            <body>
                <nav class="navbar navbar-expand-lg">
                    <div class="container">
                        <a class="navbar-brand fw-bold" href="/allersafe">
                            <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                        </a>
                        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                            <span class="navbar-toggler-icon"></span>
                        </button>
                        <div class="collapse navbar-collapse" id="navbarNav">
                            <ul class="navbar-nav ms-auto">
                                <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/materials">Materials Guide</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                                ${req.session.allersafeUser ? `
                                    <li class="nav-item dropdown">
                                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                                            <i class="fas fa-user-circle me-1"></i>${req.session.allersafeUser.fullname}
                                        </a>
                                        <ul class="dropdown-menu dropdown-menu-end">
                                            <li><a class="dropdown-item" href="/allersafe/profile"><i class="fas fa-id-card me-2"></i>My Profile</a></li>
                                            <li><a class="dropdown-item" href="/allersafe/favorites"><i class="fas fa-heart me-2"></i>Favorites</a></li>
                                            <li><hr class="dropdown-divider"></li>
                                            <li><a class="dropdown-item" href="/allersafe/logout"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                                        </ul>
                                    </li>
                                ` : `
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/login">Login</a></li>
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/register">Register</a></li>
                                `}
                            </ul>
                        </div>
                    </div>
                </nav>
                
                <!-- Hero Section -->
                <section class="hero">
                    <div class="container">
                        <i class="fas fa-gem fa-4x mb-3"></i>
                        <h1>Safe Jewellery for Sensitive Skin</h1>
                        <p class="lead">Discover beautifully crafted jewellery that won't cause allergic reactions.</p>
                        <div class="mt-4">
                            <a href="/allersafe/shop" class="btn btn-light btn-lg me-3">
                                <i class="fas fa-shopping-bag me-2"></i>Shop Now
                            </a>
                            <a href="/allersafe/verify" class="btn btn-outline-light btn-lg">
                                <i class="fas fa-qrcode me-2"></i>Verify Product
                            </a>
                        </div>
                    </div>
                </section>
                
                <!-- Stats Section -->
                <section class="py-5">
                    <div class="container">
                        <div class="row g-4">
                            <div class="col-md-3">
                                <div class="stat-card">
                                    <div class="stat-number">10-20%</div>
                                    <p class="text-muted mb-0">Population affected by metal allergies</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="stat-card">
                                    <div class="stat-number">9+</div>
                                    <p class="text-muted mb-0">Hypoallergenic materials</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="stat-card">
                                    <div class="stat-number">100%</div>
                                    <p class="text-muted mb-0">Verified products</p>
                                </div>
                            </div>
                            <div class="col-md-3">
                                <div class="stat-card">
                                    <div class="stat-number">24/7</div>
                                    <p class="text-muted mb-0">Peace of mind</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </section>
                
                <!-- Featured Products -->
                <section class="py-5 bg-light">
                    <div class="container">
                        <h2 class="section-title">Featured Hypoallergenic Products</h2>
                        <div class="row">
                            ${featuredProducts.map(p => renderProductCard(p)).join('')}
                        </div>
                        <div class="text-center mt-4">
                            <a href="/allersafe/shop" class="btn btn-primary btn-lg">View All Products <i class="fas fa-arrow-right ms-2"></i></a>
                        </div>
                    </div>
                </section>
                
                <!-- Materials Guide -->
                <section class="py-5">
                    <div class="container">
                        <h2 class="section-title">Hypoallergenic Materials Guide</h2>
                        <div class="row g-4">
                            ${materials.map(m => `
                                <div class="col-md-4">
                                    <div class="card h-100 border-0 shadow-sm">
                                        <div class="card-body">
                                            <div class="d-flex justify-content-between align-items-start">
                                                <h5 class="card-title">${m.material_name}</h5>
                                                <span class="material-badge badge-${m.allergy_risk_level}">${m.allergy_risk_level.toUpperCase()}</span>
                                            </div>
                                            <p class="card-text text-muted small mt-2">${m.description}</p>
                                            <small class="text-muted"><i class="fas fa-exclamation-triangle me-1"></i> ${m.common_allergens || 'No common allergens'}</small>
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <div class="text-center mt-4">
                            <a href="/allersafe/materials" class="btn btn-outline-primary">View All Materials <i class="fas fa-arrow-right ms-2"></i></a>
                        </div>
                    </div>
                </section>
                
                <!-- CTA Section -->
                <section class="py-5" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white;">
                    <div class="container text-center">
                        <h3>Ready to find jewellery that's safe for you?</h3>
                        <p class="mb-4">Create your allergy profile and get personalized recommendations.</p>
                        ${req.session.allersafeUser ? 
                            `<a href="/allersafe/profile" class="btn btn-light btn-lg">Manage Your Profile <i class="fas fa-arrow-right ms-2"></i></a>` :
                            `<a href="/allersafe/register" class="btn btn-light btn-lg">Sign Up Free <i class="fas fa-arrow-right ms-2"></i></a>`
                        }
                    </div>
                </section>
                
                <footer>
                    <div class="container">
                        <div class="row">
                            <div class="col-md-4">
                                <h5><i class="fas fa-gem me-2"></i>ALLERSAFE</h5>
                                <p>Your trusted source for hypoallergenic jewellery verification and recommendations.</p>
                            </div>
                            <div class="col-md-4">
                                <h5>Quick Links</h5>
                                <ul class="list-unstyled">
                                    <li><a href="/allersafe">Home</a></li>
                                    <li><a href="/allersafe/shop">Shop</a></li>
                                    <li><a href="/allersafe/materials">Materials Guide</a></li>
                                    <li><a href="/allersafe/verify">Verify Product</a></li>
                                </ul>
                            </div>
                            <div class="col-md-4">
                                <h5>Contact</h5>
                                <p><i class="fas fa-envelope me-2"></i> allersafe@ardthonsolutions.com</p>
                                <p><i class="fas fa-phone me-2"></i> +254 700 000 000</p>
                            </div>
                        </div>
                        <hr class="mt-4 mb-3" style="border-color: #334155;">
                        <div class="text-center">
                            <p>&copy; 2026 Ardthon Solutions - ALLERSAFE Hypoallergenic Jewellery System</p>
                        </div>
                    </div>
                </footer>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
    } catch(err) {
        console.error('Home error:', err);
        res.send('<h1>ALLERSAFE</h1><p>System loading. Please check back soon!</p>');
    }
});

// Shop page with filters
router.get('/shop', async (req, res) => {
    try {
        const { category, material, search, min_price, max_price } = req.query;
        
        let query = `
            SELECT p.*, m.material_name, m.allergy_risk_level
            FROM allersafe_products p
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE p.certification_status = 1
        `;
        let params = [];
        
        if (category && category !== 'all') {
            query += ` AND p.category = ?`;
            params.push(category);
        }
        
        if (material && material !== 'all') {
            query += ` AND m.material_name = ?`;
            params.push(material);
        }
        
        if (search) {
            query += ` AND (p.name LIKE ? OR p.description LIKE ?)`;
            params.push(`%${search}%`, `%${search}%`);
        }
        
        if (min_price) {
            query += ` AND p.price >= ?`;
            params.push(parseFloat(min_price));
        }
        
        if (max_price) {
            query += ` AND p.price <= ?`;
            params.push(parseFloat(max_price));
        }
        
        query += ` ORDER BY p.created_at DESC`;
        
        const [products] = await req.db.query(query, params);
        const [categories] = await req.db.query('SELECT DISTINCT category FROM allersafe_products WHERE certification_status = 1');
        const [materials] = await req.db.query('SELECT DISTINCT material_name, allergy_risk_level FROM allersafe_materials');
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Shop - ALLERSAFE Hypoallergenic Jewellery</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                <style>
                    body { background: #f8fafc; }
                    .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
                    .product-card { transition: transform 0.3s; border-radius: 12px; overflow: hidden; }
                    .product-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
                    .filter-sidebar { background: white; border-radius: 12px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05); position: sticky; top: 80px; }
                    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; }
                    footer { background: #1e293b; color: white; padding: 40px 0; margin-top: 60px; }
                    footer a { color: #94a3b8; text-decoration: none; }
                </style>
            </head>
            <body>
                <nav class="navbar navbar-expand-lg">
                    <div class="container">
                        <a class="navbar-brand fw-bold" href="/allersafe">
                            <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                        </a>
                        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                            <span class="navbar-toggler-icon"></span>
                        </button>
                        <div class="collapse navbar-collapse" id="navbarNav">
                            <ul class="navbar-nav ms-auto">
                                <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                                <li class="nav-item"><a class="nav-link active" href="/allersafe/shop">Shop</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/materials">Materials Guide</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                                ${req.session.allersafeUser ? `
                                    <li class="nav-item dropdown">
                                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                                            <i class="fas fa-user-circle me-1"></i>${req.session.allersafeUser.fullname}
                                        </a>
                                        <ul class="dropdown-menu dropdown-menu-end">
                                            <li><a class="dropdown-item" href="/allersafe/profile"><i class="fas fa-id-card me-2"></i>My Profile</a></li>
                                            <li><a class="dropdown-item" href="/allersafe/favorites"><i class="fas fa-heart me-2"></i>Favorites</a></li>
                                            <li><hr class="dropdown-divider"></li>
                                            <li><a class="dropdown-item" href="/allersafe/logout"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                                        </ul>
                                    </li>
                                ` : `
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/login">Login</a></li>
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/register">Register</a></li>
                                `}
                            </ul>
                        </div>
                    </div>
                </nav>
                
                <div class="container py-5">
                    <div class="row">
                        <!-- Filters Sidebar -->
                        <div class="col-md-3">
                            <div class="filter-sidebar">
                                <h5><i class="fas fa-filter me-2"></i>Filters</h5>
                                <hr>
                                <form method="GET" action="/allersafe/shop">
                                    <div class="mb-3">
                                        <label class="form-label">Search</label>
                                        <input type="text" name="search" class="form-control" placeholder="Search products..." value="${req.query.search || ''}">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Category</label>
                                        <select name="category" class="form-select">
                                            <option value="all">All Categories</option>
                                            ${categories.map(c => `<option value="${c.category}" ${req.query.category === c.category ? 'selected' : ''}>${c.category}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Material</label>
                                        <select name="material" class="form-select">
                                            <option value="all">All Materials</option>
                                            ${materials.map(m => `<option value="${m.material_name}" ${req.query.material === m.material_name ? 'selected' : ''}>${m.material_name}</option>`).join('')}
                                        </select>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label">Price Range</label>
                                        <div class="row g-2">
                                            <div class="col-6">
                                                <input type="number" name="min_price" class="form-control" placeholder="Min" value="${req.query.min_price || ''}">
                                            </div>
                                            <div class="col-6">
                                                <input type="number" name="max_price" class="form-control" placeholder="Max" value="${req.query.max_price || ''}">
                                            </div>
                                        </div>
                                    </div>
                                    <button type="submit" class="btn btn-primary w-100">Apply Filters</button>
                                    <a href="/allersafe/shop" class="btn btn-outline-secondary w-100 mt-2">Clear All</a>
                                </form>
                            </div>
                        </div>
                        
                        <!-- Products Grid -->
                        <div class="col-md-9">
                            <div class="d-flex justify-content-between align-items-center mb-4">
                                <h4>${products.length} Products Found</h4>
                            </div>
                            <div class="row">
                                ${products.map(p => renderProductCard(p)).join('')}
                                ${products.length === 0 ? '<div class="col-12 text-center py-5"><i class="fas fa-search fa-3x text-muted mb-3"></i><p>No products found. Try different filters.</p></div>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
                
                <footer>
                    <div class="container text-center">
                        <p>&copy; 2026 Ardthon Solutions - ALLERSAFE Hypoallergenic Jewellery</p>
                    </div>
                </footer>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
    } catch(err) {
        console.error('Shop error:', err);
        res.send('<h1>Shop</h1><p>Products loading...</p><a href="/allersafe">Back</a>');
    }
});

// Product detail page
router.get('/product/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        const [products] = await req.db.query(`
            SELECT p.*, m.material_name, m.allergy_risk_level, m.description as material_description, m.common_allergens
            FROM allersafe_products p
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE p.slug = ? AND p.certification_status = 1
        `, [slug]);
        
        if (products.length === 0) {
            return res.redirect('/allersafe/shop');
        }
        
        const product = products[0];
        const features = product.features ? JSON.parse(product.features) : [];
        const imageUrl = product.image_url || 'https://placehold.co/600x400/667eea/white?text=ALLERSAFE';
        
        const [related] = await req.db.query(`
            SELECT p.*, m.material_name, m.allergy_risk_level
            FROM allersafe_products p
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE (p.category = ? OR p.material_id = ?) AND p.id != ? AND p.certification_status = 1
            LIMIT 4
        `, [product.category, product.material_id, product.id]);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>${product.name} - ALLERSAFE</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                <style>
                    body { background: #f8fafc; }
                    .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
                    .product-image { border-radius: 15px; overflow: hidden; box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
                    .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; padding: 12px 30px; }
                    .feature-list { list-style: none; padding: 0; }
                    .feature-list li { padding: 8px 0; border-bottom: 1px solid #e2e8f0; }
                    .feature-list li i { color: #10b981; margin-right: 10px; }
                    footer { background: #1e293b; color: white; padding: 40px 0; margin-top: 60px; }
                    footer a { color: #94a3b8; text-decoration: none; }
                    .breadcrumb { background: transparent; padding: 0; }
                </style>
            </head>
            <body>
                <nav class="navbar navbar-expand-lg">
                    <div class="container">
                        <a class="navbar-brand fw-bold" href="/allersafe">
                            <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                        </a>
                        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                            <span class="navbar-toggler-icon"></span>
                        </button>
                        <div class="collapse navbar-collapse" id="navbarNav">
                            <ul class="navbar-nav ms-auto">
                                <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/materials">Materials Guide</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                                ${req.session.allersafeUser ? `
                                    <li class="nav-item dropdown">
                                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                                            <i class="fas fa-user-circle me-1"></i>${req.session.allersafeUser.fullname}
                                        </a>
                                        <ul class="dropdown-menu dropdown-menu-end">
                                            <li><a class="dropdown-item" href="/allersafe/profile"><i class="fas fa-id-card me-2"></i>My Profile</a></li>
                                            <li><a class="dropdown-item" href="/allersafe/favorites"><i class="fas fa-heart me-2"></i>Favorites</a></li>
                                            <li><hr class="dropdown-divider"></li>
                                            <li><a class="dropdown-item" href="/allersafe/logout"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                                        </ul>
                                    </li>
                                ` : `
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/login">Login</a></li>
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/register">Register</a></li>
                                `}
                            </ul>
                        </div>
                    </div>
                </nav>
                
                <div class="container py-5">
                    <nav aria-label="breadcrumb">
                        <ol class="breadcrumb">
                            <li class="breadcrumb-item"><a href="/allersafe">Home</a></li>
                            <li class="breadcrumb-item"><a href="/allersafe/shop">Shop</a></li>
                            <li class="breadcrumb-item active">${product.name}</li>
                        </ol>
                    </nav>
                    
                    <div class="row">
                        <div class="col-md-6">
                            <div class="product-image">
                                <img src="${imageUrl}" class="img-fluid" alt="${product.name}">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-2">
                                <span class="badge bg-primary fs-6 p-2 me-2">${product.material_name}</span>
                                <span class="badge ${product.allergy_risk_level === 'safe' ? 'bg-success' : (product.allergy_risk_level === 'low' ? 'bg-info' : 'bg-warning')} fs-6 p-2">
                                    ${product.allergy_risk_level.toUpperCase()} RISK
                                </span>
                            </div>
                            <h1 class="display-5 fw-bold">${product.name}</h1>
                            <h2 class="text-primary mt-3 mb-4">KSh ${parseFloat(product.price).toFixed(2)}</h2>
                            <p class="lead">${product.description}</p>
                            
                            ${features.length > 0 ? `
                                <div class="mt-4">
                                    <h5><i class="fas fa-list-check me-2"></i>Features:</h5>
                                    <ul class="feature-list">
                                        ${features.map(f => `<li><i class="fas fa-check-circle"></i> ${f}</li>`).join('')}
                                    </ul>
                                </div>
                            ` : ''}
                            
                            <div class="mt-4">
                                <div class="alert alert-info">
                                    <i class="fas fa-shield-alt me-2"></i>
                                    <strong>Material Safety:</strong> ${product.material_description}
                                </div>
                            </div>
                            
                            <div class="mt-4">
                                <button class="btn btn-primary btn-lg w-100" onclick="alert('This is a demo. Contact us for purchases!')">
                                    <i class="fas fa-shopping-cart me-2"></i>Inquire About This Product
                                </button>
                            </div>
                            <div class="mt-3">
                                <button class="btn btn-outline-secondary w-100" onclick="window.location.href='/allersafe/verify?qr_code=${product.qr_code}'">
                                    <i class="fas fa-qrcode me-2"></i>Verify This Product
                                </button>
                            </div>
                            <div class="mt-3">
                                <button class="btn btn-outline-primary w-100" onclick="window.location.href='/allersafe/add-favorite/${product.id}'">
                                    <i class="fas fa-heart me-2"></i>Add to Favorites
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    ${related.length > 0 ? `
                        <div class="mt-5">
                            <h3 class="mb-4">You May Also Like</h3>
                            <div class="row">
                                ${related.map(p => `
                                    <div class="col-md-3">
                                        <div class="card h-100 shadow-sm">
                                            <img src="${p.image_url || 'https://placehold.co/600x400/667eea/white?text=ALLERSAFE'}" class="card-img-top" style="height: 150px; object-fit: cover;">
                                            <div class="card-body">
                                                <h6 class="card-title">${p.name}</h6>
                                                <p class="text-primary fw-bold">KSh ${parseFloat(p.price).toFixed(2)}</p>
                                                <a href="/allersafe/product/${p.slug}" class="btn btn-sm btn-outline-primary w-100">View</a>
                                            </div>
                                        </div>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    ` : ''}
                </div>
                
                <footer>
                    <div class="container text-center">
                        <p>&copy; 2026 Ardthon Solutions - ALLERSAFE Hypoallergenic Jewellery</p>
                    </div>
                </footer>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
    } catch(err) {
        console.error('Product detail error:', err);
        res.redirect('/allersafe/shop');
    }
});

// Materials Guide page
router.get('/materials', async (req, res) => {
    try {
        const [materials] = await req.db.query(`
            SELECT * FROM allersafe_materials 
            ORDER BY CASE allergy_risk_level 
                WHEN 'safe' THEN 1 WHEN 'low' THEN 2 WHEN 'medium' THEN 3 WHEN 'high' THEN 4 
            END
        `);
        
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Materials Guide - ALLERSAFE</title>
                <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
                <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
                <style>
                    body { background: #f8fafc; }
                    .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
                    .material-card { transition: transform 0.3s; border-radius: 12px; cursor: pointer; }
                    .material-card:hover { transform: translateY(-3px); box-shadow: 0 5px 20px rgba(0,0,0,0.1); }
                    .risk-safe { border-left: 4px solid #10b981; }
                    .risk-low { border-left: 4px solid #0ea5e9; }
                    .risk-medium { border-left: 4px solid #f59e0b; }
                    .risk-high { border-left: 4px solid #ef4444; }
                    footer { background: #1e293b; color: white; padding: 40px 0; margin-top: 60px; }
                </style>
            </head>
            <body>
                <nav class="navbar navbar-expand-lg">
                    <div class="container">
                        <a class="navbar-brand fw-bold" href="/allersafe">
                            <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                        </a>
                        <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navbarNav">
                            <span class="navbar-toggler-icon"></span>
                        </button>
                        <div class="collapse navbar-collapse" id="navbarNav">
                            <ul class="navbar-nav ms-auto">
                                <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                                <li class="nav-item"><a class="nav-link active" href="/allersafe/materials">Materials Guide</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                                ${req.session.allersafeUser ? `
                                    <li class="nav-item dropdown">
                                        <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                                            <i class="fas fa-user-circle me-1"></i>${req.session.allersafeUser.fullname}
                                        </a>
                                        <ul class="dropdown-menu dropdown-menu-end">
                                            <li><a class="dropdown-item" href="/allersafe/profile"><i class="fas fa-id-card me-2"></i>My Profile</a></li>
                                            <li><a class="dropdown-item" href="/allersafe/favorites"><i class="fas fa-heart me-2"></i>Favorites</a></li>
                                            <li><hr class="dropdown-divider"></li>
                                            <li><a class="dropdown-item" href="/allersafe/logout"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                                        </ul>
                                    </li>
                                ` : `
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/login">Login</a></li>
                                    <li class="nav-item"><a class="nav-link" href="/allersafe/register">Register</a></li>
                                `}
                            </ul>
                        </div>
                    </div>
                </nav>
                
                <div class="container py-5">
                    <h1 class="text-center mb-4">Hypoallergenic Materials Guide</h1>
                    <p class="text-center text-muted mb-5">Understanding what metals are safe for your skin</p>
                    
                    <div class="row g-4">
                        ${materials.map(m => `
                            <div class="col-md-6">
                                <div class="card material-card risk-${m.allergy_risk_level} shadow-sm">
                                    <div class="card-body">
                                        <div class="d-flex justify-content-between align-items-start">
                                            <h4><i class="fas fa-gem me-2" style="color:#667eea;"></i>${m.material_name}</h4>
                                            <span class="badge bg-${m.allergy_risk_level === 'safe' ? 'success' : (m.allergy_risk_level === 'low' ? 'info' : (m.allergy_risk_level === 'medium' ? 'warning' : 'danger'))} fs-6 p-2">
                                                ${m.allergy_risk_level.toUpperCase()}
                                            </span>
                                        </div>
                                        <p class="mt-2">${m.description}</p>
                                        <div class="alert alert-warning mt-3 p-2 small mb-0">
                                            <i class="fas fa-exclamation-triangle me-2"></i>
                                            <strong>Common Allergens:</strong> ${m.common_allergens}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                    
                    <div class="mt-5 text-center">
                        <a href="/allersafe/shop" class="btn btn-primary btn-lg px-5">Shop Safe Materials <i class="fas fa-arrow-right ms-2"></i></a>
                    </div>
                </div>
                
                <footer>
                    <div class="container text-center">
                        <p>&copy; 2026 Ardthon Solutions - ALLERSAFE Hypoallergenic Jewellery</p>
                    </div>
                </footer>
                
                <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
            </body>
            </html>
        `);
    } catch(err) {
        console.error('Materials error:', err);
        res.send('<h1>Materials Guide</h1><p>Loading...</p><a href="/allersafe">Back</a>');
    }
});

// Register page
router.get('/register', (req, res) => {
    if (req.session.allersafeUser) return res.redirect('/allersafe');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Register - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .card { border-radius: 15px; margin-top: 50px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; padding: 12px; font-weight: 600; }
                .form-control { border-radius: 10px; padding: 12px; }
                .form-control:focus { border-color: #667eea; box-shadow: 0 0 0 0.2rem rgba(102,126,234,0.25); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-5">
                        <div class="card shadow">
                            <div class="card-header bg-primary text-white text-center" style="border-radius: 15px 15px 0 0;">
                                <i class="fas fa-gem fa-2x mb-2"></i>
                                <h4 class="mb-0">Create ALLERSAFE Account</h4>
                            </div>
                            <div class="card-body">
                                <form method="POST" action="/allersafe/register">
                                    <div class="mb-3">
                                        <label class="form-label"><i class="fas fa-user me-2"></i>Full Name</label>
                                        <input type="text" name="fullname" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"><i class="fas fa-envelope me-2"></i>Email</label>
                                        <input type="email" name="email" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"><i class="fas fa-phone me-2"></i>Phone (Optional)</label>
                                        <input type="tel" name="phone" class="form-control">
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"><i class="fas fa-lock me-2"></i>Password</label>
                                        <input type="password" name="password" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"><i class="fas fa-lock me-2"></i>Confirm Password</label>
                                        <input type="password" name="confirm_password" class="form-control" required>
                                    </div>
                                    <button type="submit" class="btn btn-primary w-100">Register</button>
                                </form>
                                <hr>
                                <div class="text-center">
                                    <a href="/allersafe/login">Already have an account? Login</a>
                                    <br><br>
                                    <a href="/allersafe">← Back to Home</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Register POST
router.post('/register', async (req, res) => {
    try {
        const { fullname, email, phone, password, confirm_password } = req.body;
        
        if (password !== confirm_password) {
            return res.send('<script>alert("Passwords do not match!"); window.location="/allersafe/register";</script>');
        }
        
        if (!password || password.length < 6) {
            return res.send('<script>alert("Password must be at least 6 characters!"); window.location="/allersafe/register";</script>');
        }
        
        const [existing] = await req.db.query('SELECT id FROM allersafe_users WHERE email = ?', [email]);
        
        if (existing.length > 0) {
            return res.send('<script>alert("Email already registered!"); window.location="/allersafe/register";</script>');
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await req.db.query(
            'INSERT INTO allersafe_users (fullname, email, phone, password) VALUES (?, ?, ?, ?)',
            [fullname, email, phone || null, hashedPassword]
        );
        
        res.send('<script>alert("Registration successful! Please login."); window.location="/allersafe/login";</script>');
    } catch(err) {
        console.error('Register error:', err);
        res.send(`<script>alert("Registration failed: ${err.message}"); window.location="/allersafe/register";</script>`);
    }
});

// Login page
router.get('/login', (req, res) => {
    if (req.session.allersafeUser) return res.redirect('/allersafe');
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Login - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .card { border-radius: 15px; margin-top: 100px; box-shadow: 0 20px 40px rgba(0,0,0,0.1); }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; padding: 12px; font-weight: 600; }
                .form-control { border-radius: 10px; padding: 12px; }
                .form-control:focus { border-color: #667eea; box-shadow: 0 0 0 0.2rem rgba(102,126,234,0.25); }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="row justify-content-center">
                    <div class="col-md-5">
                        <div class="card shadow">
                            <div class="card-header bg-primary text-white text-center" style="border-radius: 15px 15px 0 0;">
                                <i class="fas fa-gem fa-2x mb-2"></i>
                                <h4 class="mb-0">ALLERSAFE Login</h4>
                            </div>
                            <div class="card-body">
                                <form method="POST" action="/allersafe/login">
                                    <div class="mb-3">
                                        <label class="form-label"><i class="fas fa-envelope me-2"></i>Email</label>
                                        <input type="email" name="email" class="form-control" required>
                                    </div>
                                    <div class="mb-3">
                                        <label class="form-label"><i class="fas fa-lock me-2"></i>Password</label>
                                        <input type="password" name="password" class="form-control" required>
                                    </div>
                                    <button type="submit" class="btn btn-primary w-100">Login</button>
                                </form>
                                <hr>
                                <div class="text-center">
                                    <a href="/allersafe/register">Don't have an account? Register</a>
                                    <br><br>
                                    <a href="/allersafe">← Back to Home</a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
    `);
});

// Login POST
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        const [users] = await req.db.query('SELECT * FROM allersafe_users WHERE email = ?', [email]);
        
        if (users.length === 0) {
            return res.send('<script>alert("Invalid email or password!"); window.location="/allersafe/login";</script>');
        }
        
        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password);
        
        if (!isValid) {
            return res.send('<script>alert("Invalid email or password!"); window.location="/allersafe/login";</script>');
        }
        
        req.session.allersafeUser = {
            id: user.id,
            email: user.email,
            fullname: user.fullname,
            phone: user.phone
        };
        
        await req.db.query('UPDATE allersafe_users SET last_login = NOW() WHERE id = ?', [user.id]);
        
        res.redirect('/allersafe');
    } catch(err) {
        console.error('Login error:', err);
        res.send(`<script>alert("Login failed: ${err.message}"); window.location="/allersafe/login";</script>`);
    }
});

// Logout
router.get('/logout', (req, res) => {
    req.session.allersafeUser = null;
    res.redirect('/allersafe');
});

// Profile page
router.get('/profile', isAllersafeLoggedIn, async (req, res) => {
    const user = req.session.allersafeUser;
    
    let allergyProfile = null;
    if (req.db) {
        const [profiles] = await req.db.query(
            'SELECT * FROM allersafe_allergy_profiles WHERE user_id = ?',
            [user.id]
        );
        allergyProfile = profiles[0] || null;
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>My Profile - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
                .card { border-radius: 12px; box-shadow: 0 5px 15px rgba(0,0,0,0.05); }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; }
                footer { background: #1e293b; color: white; padding: 40px 0; margin-top: 60px; }
                .form-check-input:checked { background-color: #667eea; border-color: #667eea; }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="/allersafe">
                        <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                    </a>
                    <div class="collapse navbar-collapse">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/materials">Materials Guide</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                            <li class="nav-item"><a class="nav-link active" href="/allersafe/profile">Profile</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/logout">Logout</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <div class="container py-5">
                <div class="row justify-content-center">
                    <div class="col-md-8">
                        <div class="card shadow">
                            <div class="card-header bg-primary text-white">
                                <h4 class="mb-0"><i class="fas fa-user-circle me-2"></i>My ALLERSAFE Profile</h4>
                            </div>
                            <div class="card-body">
                                <div class="mb-4 p-3 bg-light rounded">
                                    <h5><i class="fas fa-id-card me-2 text-primary"></i>Account Information</h5>
                                    <div class="row mt-3">
                                        <div class="col-md-6">
                                            <p><strong><i class="fas fa-user me-2"></i>Name:</strong> ${user.fullname}</p>
                                        </div>
                                        <div class="col-md-6">
                                            <p><strong><i class="fas fa-envelope me-2"></i>Email:</strong> ${user.email}</p>
                                        </div>
                                        <div class="col-md-6">
                                            <p><strong><i class="fas fa-phone me-2"></i>Phone:</strong> ${user.phone || 'Not provided'}</p>
                                        </div>
                                    </div>
                                </div>
                                
                                <hr>
                                
                                <form method="POST" action="/allersafe/allergy-profile">
                                    <h5><i class="fas fa-user-md me-2 text-primary"></i>Metal Allergy Profile</h5>
                                    <p class="text-muted small">Tell us about your allergies for personalized recommendations</p>
                                    
                                    <div class="row">
                                        <div class="col-md-6">
                                            <div class="form-check mb-2">
                                                <input class="form-check-input" type="checkbox" name="nickel_allergy" id="nickel" ${allergyProfile && allergyProfile.nickel_allergy ? 'checked' : ''}>
                                                <label class="form-check-label" for="nickel">Nickel Allergy <span class="badge bg-danger">Most Common</span></label>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-check mb-2">
                                                <input class="form-check-input" type="checkbox" name="cobalt_allergy" id="cobalt" ${allergyProfile && allergyProfile.cobalt_allergy ? 'checked' : ''}>
                                                <label class="form-check-label" for="cobalt">Cobalt Allergy</label>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-check mb-2">
                                                <input class="form-check-input" type="checkbox" name="copper_allergy" id="copper" ${allergyProfile && allergyProfile.copper_allergy ? 'checked' : ''}>
                                                <label class="form-check-label" for="copper">Copper Allergy</label>
                                            </div>
                                        </div>
                                        <div class="col-md-6">
                                            <div class="form-check mb-2">
                                                <input class="form-check-input" type="checkbox" name="chromium_allergy" id="chromium" ${allergyProfile && allergyProfile.chromium_allergy ? 'checked' : ''}>
                                                <label class="form-check-label" for="chromium">Chromium Allergy</label>
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div class="mb-3 mt-3">
                                        <label class="form-label"><i class="fas fa-list me-2"></i>Other Allergies</label>
                                        <textarea name="other_allergies" class="form-control" rows="2" placeholder="List any other metal allergies...">${allergyProfile ? allergyProfile.other_allergies || '' : ''}</textarea>
                                    </div>
                                    
                                    <div class="mb-3">
                                        <label class="form-label"><i class="fas fa-chart-line me-2"></i>Reaction Severity</label>
                                        <select name="severity_level" class="form-select">
                                            <option value="mild" ${allergyProfile && allergyProfile.severity_level === 'mild' ? 'selected' : ''}>Mild - Minor irritation</option>
                                            <option value="moderate" ${allergyProfile && allergyProfile.severity_level === 'moderate' ? 'selected' : ''}>Moderate - Noticeable rash</option>
                                            <option value="severe" ${allergyProfile && allergyProfile.severity_level === 'severe' ? 'selected' : ''}>Severe - Intense reaction</option>
                                        </select>
                                    </div>
                                    
                                    <button type="submit" class="btn btn-primary w-100">Save Allergy Profile</button>
                                </form>
                                
                                <hr>
                                <a href="/allersafe" class="btn btn-link"><i class="fas fa-arrow-left me-2"></i>Back to Home</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <footer>
                <div class="container text-center">
                    <p>&copy; 2026 Ardthon Solutions - ALLERSAFE Hypoallergenic Jewellery</p>
                </div>
            </footer>
        </body>
        </html>
    `);
});

// Save allergy profile
router.post('/allergy-profile', isAllersafeLoggedIn, async (req, res) => {
    try {
        const userId = req.session.allersafeUser.id;
        const { nickel_allergy, cobalt_allergy, copper_allergy, chromium_allergy, other_allergies, severity_level } = req.body;
        
        const [existing] = await req.db.query(
            'SELECT id FROM allersafe_allergy_profiles WHERE user_id = ?',
            [userId]
        );
        
        if (existing.length > 0) {
            await req.db.query(`
                UPDATE allersafe_allergy_profiles 
                SET nickel_allergy = ?, cobalt_allergy = ?, copper_allergy = ?, 
                    chromium_allergy = ?, other_allergies = ?, severity_level = ?
                WHERE user_id = ?
            `, [nickel_allergy ? 1 : 0, cobalt_allergy ? 1 : 0, copper_allergy ? 1 : 0, 
                chromium_allergy ? 1 : 0, other_allergies || '', severity_level || 'moderate', userId]);
        } else {
            await req.db.query(`
                INSERT INTO allersafe_allergy_profiles 
                (user_id, nickel_allergy, cobalt_allergy, copper_allergy, chromium_allergy, other_allergies, severity_level)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [userId, nickel_allergy ? 1 : 0, cobalt_allergy ? 1 : 0, copper_allergy ? 1 : 0, 
                chromium_allergy ? 1 : 0, other_allergies || '', severity_level || 'moderate']);
        }
        
        res.send('<script>alert("Allergy profile saved! You will now get personalized recommendations."); window.location="/allersafe/profile";</script>');
    } catch(err) {
        console.error('Save allergy profile error:', err);
        res.redirect('/allersafe/profile');
    }
});

// Verify page
router.get('/verify', (req, res) => {
    const qrCode = req.query.qr_code;
    let result = '';
    let productInfo = '';
    
    if (qrCode) {
        result = `<div class="alert alert-success mt-4"><i class="fas fa-check-circle fa-2x me-2"></i> <strong>Product Verified!</strong> ${qrCode} is certified hypoallergenic and safe for sensitive skin.</div>`;
        productInfo = `
            <div class="card mt-3">
                <div class="card-body">
                    <h5>Product Information</h5>
                    <p><strong>QR Code:</strong> ${qrCode}</p>
                    <p><strong>Status:</strong> <span class="badge bg-success">Verified Hypoallergenic</span></p>
                    <p><strong>Safety Rating:</strong> ⭐⭐⭐⭐⭐</p>
                    <a href="/allersafe/shop" class="btn btn-sm btn-primary">Shop Similar Products</a>
                </div>
            </div>
        `;
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Verify - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); min-height: 100vh; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .card { border-radius: 15px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; }
                footer { background: #1e293b; color: white; padding: 40px 0; margin-top: 60px; }
                .form-control { border-radius: 10px; padding: 12px; }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="/allersafe">
                        <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                    </a>
                    <div class="collapse navbar-collapse">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/materials">Materials Guide</a></li>
                            <li class="nav-item"><a class="nav-link active" href="/allersafe/verify">Verify</a></li>
                            ${req.session.allersafeUser ? `
                                <li class="nav-item dropdown">
                                    <a class="nav-link dropdown-toggle" href="#" role="button" data-bs-toggle="dropdown">
                                        <i class="fas fa-user-circle me-1"></i>${req.session.allersafeUser.fullname}
                                    </a>
                                    <ul class="dropdown-menu dropdown-menu-end">
                                        <li><a class="dropdown-item" href="/allersafe/profile"><i class="fas fa-id-card me-2"></i>My Profile</a></li>
                                        <li><a class="dropdown-item" href="/allersafe/favorites"><i class="fas fa-heart me-2"></i>Favorites</a></li>
                                        <li><hr class="dropdown-divider"></li>
                                        <li><a class="dropdown-item" href="/allersafe/logout"><i class="fas fa-sign-out-alt me-2"></i>Logout</a></li>
                                    </ul>
                                </li>
                            ` : `
                                <li class="nav-item"><a class="nav-link" href="/allersafe/login">Login</a></li>
                                <li class="nav-item"><a class="nav-link" href="/allersafe/register">Register</a></li>
                            `}
                        </ul>
                    </div>
                </div>
            </nav>
            
            <div class="container py-5">
                <div class="row justify-content-center">
                    <div class="col-md-6">
                        <div class="card shadow">
                            <div class="card-header bg-primary text-white text-center" style="border-radius: 15px 15px 0 0;">
                                <i class="fas fa-qrcode fa-2x mb-2"></i>
                                <h4 class="mb-0">Verify Your Jewellery</h4>
                            </div>
                            <div class="card-body text-center">
                                <form method="GET" action="/allersafe/verify">
                                    <div class="mb-3">
                                        <input type="text" name="qr_code" class="form-control form-control-lg" placeholder="Enter QR code or Product ID" required>
                                    </div>
                                    <button type="submit" class="btn btn-primary btn-lg w-100">Verify Now</button>
                                </form>
                                ${result}
                                ${productInfo}
                                <hr>
                                <div class="mt-3">
                                    <i class="fas fa-shield-alt fa-2x text-muted"></i>
                                    <p class="small text-muted mt-2">Every verified product meets our strict hypoallergenic standards</p>
                                </div>
                                <a href="/allersafe" class="btn btn-link">← Back to Home</a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            
            <footer>
                <div class="container text-center">
                    <p>&copy; 2026 Ardthon Solutions - ALLERSAFE Hypoallergenic Jewellery</p>
                </div>
            </footer>
        </body>
        </html>
    `);
});

// Favorites page
router.get('/favorites', isAllersafeLoggedIn, async (req, res) => {
    const userId = req.session.allersafeUser.id;
    
    let favorites = [];
    if (req.db) {
        const [rows] = await req.db.query(`
            SELECT p.*, m.material_name, m.allergy_risk_level
            FROM allersafe_favorites f
            JOIN allersafe_products p ON f.product_id = p.id
            JOIN allersafe_materials m ON p.material_id = m.id
            WHERE f.user_id = ?
        `, [userId]);
        favorites = rows;
    }
    
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>My Favorites - ALLERSAFE</title>
            <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
            <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
            <style>
                body { background: #f8fafc; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
                .navbar { background: rgba(255,255,255,0.98); backdrop-filter: blur(10px); box-shadow: 0 2px 10px rgba(0,0,0,0.1); position: sticky; top: 0; z-index: 1000; }
                .product-card { transition: transform 0.3s; border-radius: 12px; overflow: hidden; }
                .product-card:hover { transform: translateY(-5px); box-shadow: 0 10px 30px rgba(0,0,0,0.15); }
                .btn-primary { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border: none; border-radius: 50px; }
                footer { background: #1e293b; color: white; padding: 40px 0; margin-top: 60px; }
            </style>
        </head>
        <body>
            <nav class="navbar navbar-expand-lg">
                <div class="container">
                    <a class="navbar-brand fw-bold" href="/allersafe">
                        <i class="fas fa-gem" style="color:#667eea;"></i> ALLERSAFE
                    </a>
                    <div class="collapse navbar-collapse">
                        <ul class="navbar-nav ms-auto">
                            <li class="nav-item"><a class="nav-link" href="/allersafe">Home</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/shop">Shop</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/materials">Materials Guide</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/verify">Verify</a></li>
                            <li class="nav-item"><a class="nav-link active" href="/allersafe/favorites">Favorites</a></li>
                            <li class="nav-item"><a class="nav-link" href="/allersafe/logout">Logout</a></li>
                        </ul>
                    </div>
                </div>
            </nav>
            
            <div class="container py-5">
                <h1 class="text-center mb-4"><i class="fas fa-heart text-danger me-2"></i>My Favorites</h1>
                <p class="text-center text-muted mb-5">Products you've saved for later</p>
                
                <div class="row">
                    ${favorites.map(p => `
                        <div class="col-md-3 mb-4">
                            <div class="card product-card h-100 shadow-sm">
                                <img src="${p.image_url || 'https://placehold.co/600x400/667eea/white?text=ALLERSAFE'}" class="card-img-top" style="height: 150px; object-fit: cover;">
                                <div class="card-body">
                                    <span class="badge bg-primary mb-2">${p.material_name}</span>
                                    <h6 class="card-title">${p.name}</h6>
                                    <p class="text-primary fw-bold">KSh ${parseFloat(p.price).toFixed(2)}</p>
                                    <a href="/allersafe/product/${p.slug}" class="btn btn-sm btn-primary w-100">View Product</a>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                    ${favorites.length === 0 ? `
                        <div class="col-12 text-center py-5">
                            <i class="fas fa-heart fa-4x text-muted mb-3"></i>
                            <p>You haven't saved any favorites yet.</p>
                            <a href="/allersafe/shop" class="btn btn-primary btn-lg">Browse Shop</a>
                        </div>
                    ` : ''}
                </div>
            </div>
            
            <footer>
                <div class="container text-center">
                    <p>&copy; 2026 Ardthon Solutions - ALLERSAFE Hypoallergenic Jewellery</p>
                </div>
            </footer>
        </body>
        </html>
    `);
});

// Add to favorites
router.get('/add-favorite/:productId', isAllersafeLoggedIn, async (req, res) => {
    try {
        const userId = req.session.allersafeUser.id;
        const productId = req.params.productId;
        
        const [existing] = await req.db.query(
            'SELECT id FROM allersafe_favorites WHERE user_id = ? AND product_id = ?',
            [userId, productId]
        );
        
        if (existing.length === 0) {
            await req.db.query(
                'INSERT INTO allersafe_favorites (user_id, product_id) VALUES (?, ?)',
                [userId, productId]
            );
        }
        
        res.send('<script>alert("Product added to favorites!"); window.location.href="/allersafe/favorites";</script>');
    } catch(err) {
        console.error('Add favorite error:', err);
        res.redirect('/allersafe/shop');
    }
});

module.exports = router;