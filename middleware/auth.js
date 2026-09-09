module.exports = {
  isAuth: (req, res, next) => {
    if (req.session.user) return next();
    req.flash('error_msg', 'Please log in first');
    res.redirect('/auth/login');
  },
  isGuest: (req, res, next) => {
    if (!req.session.user) return next();
    res.redirect('/dashboard');
  },
  isAdmin: (req, res, next) => {
    if (req.session.user && req.session.user.role === 'admin') return next();
    req.flash('error_msg', 'Admin access required');
    res.redirect('/');
  },
  isCuePayAuth: (req, res, next) => {
    if (req.session.cuepayUser) return next();
    req.flash('error_msg', 'Please login to CuePay');
    res.redirect('/cuepay/login');
  },
  isAttendXAuth: (req, res, next) => {
    if (req.session.attendxUser) return next();
    req.flash('error_msg', 'Please login to AttendX first');
    res.redirect('/attendx/login');
  },
};
