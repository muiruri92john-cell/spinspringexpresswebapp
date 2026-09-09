// routes/spinspring.js
const express = require('express');
const router = express.Router();

// SpinSpring Landing Page
router.get('/', (req, res) => {
    res.render('spinspring/landing', { 
        title: 'SpinSpring - Smart Laundry Automation',
        user: null 
    });
});

// SpinSpring Login Pages
router.get('/login', (req, res) => {
    res.render('spinspring/login', { 
        title: 'Login - SpinSpring',
        error: null 
    });
});

router.get('/register', (req, res) => {
    res.render('spinspring/register', { 
        title: 'Register - SpinSpring',
        error: null 
    });
});

// Role-specific Logins
router.get('/owner-login', (req, res) => {
    res.render('spinspring/owner-login', { 
        title: 'Owner Login - SpinSpring',
        error: null 
    });
});

router.get('/attendant-login', (req, res) => {
    res.render('spinspring/attendant-login', { 
        title: 'Attendant Login - SpinSpring',
        error: null 
    });
});

router.get('/customer-login', (req, res) => {
    res.render('spinspring/customer-login', { 
        title: 'Customer Login - SpinSpring',
        error: null 
    });
});

// SpinSpring Dashboards
router.get('/owner-dashboard', (req, res) => {
    res.render('spinspring/owner-dashboard', { 
        title: 'Owner Dashboard - SpinSpring',
        user: { name: 'Owner', role: 'owner' }
    });
});

router.get('/attendant-dashboard', (req, res) => {
    res.render('spinspring/attendant-dashboard', { 
        title: 'Attendant Dashboard - SpinSpring',
        user: { name: 'Attendant', role: 'attendant' }
    });
});

router.get('/customer-dashboard', (req, res) => {
    res.render('spinspring/customer-dashboard', { 
        title: 'Customer Dashboard - SpinSpring',
        user: { name: 'Customer', role: 'customer' }
    });
});

// SpinSpring Device Management
router.get('/register-device', (req, res) => {
    res.render('spinspring/register-device', { 
        title: 'Register Device - SpinSpring',
        error: null 
    });
});

router.get('/device-detail/:id', (req, res) => {
    const deviceId = req.params.id;
    res.render('spinspring/device-detail', { 
        title: 'Device Detail - SpinSpring',
        device: { 
            id: deviceId, 
            name: `Machine ${deviceId}`, 
            status: 'Active' 
        }
    });
});

router.get('/settings', (req, res) => {
    res.render('spinspring/settings', { 
        title: 'Settings - SpinSpring',
        user: { name: 'User' }
    });
});

// SpinSpring API Routes
router.get('/api/machines', (req, res) => {
    res.json({ 
        success: true,
        machines: [
            { id: 1, name: 'Machine 1', status: 'active', location: 'Laundry A' },
            { id: 2, name: 'Machine 2', status: 'idle', location: 'Laundry B' },
            { id: 3, name: 'Machine 3', status: 'active', location: 'Laundry A' },
            { id: 4, name: 'Machine 4', status: 'maintenance', location: 'Laundry C' }
        ]
    });
});

router.get('/api/stats', (req, res) => {
    res.json({
        success: true,
        stats: {
            machines: 4,
            cycles: 156,
            businesses: 3,
            uptime: '99.8%'
        }
    });
});

router.post('/api/register-device', (req, res) => {
    res.json({ 
        success: true, 
        message: 'Device registered successfully',
        device: req.body 
    });
});

module.exports = router;