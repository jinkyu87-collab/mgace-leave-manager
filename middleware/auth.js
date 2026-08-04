function requireLogin(req, res, next) {
  if (!req.session.employee) return res.redirect('/login');
  next();
}

function requireAdmin(req, res, next) {
  if (!req.session.employee) return res.redirect('/login');
  if (req.session.employee.role !== 'admin') return res.status(403).send('관리자만 접근 가능합니다.');
  next();
}

module.exports = { requireLogin, requireAdmin };
