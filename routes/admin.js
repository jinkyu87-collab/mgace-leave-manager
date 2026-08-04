const express = require('express');
const router = express.Router();
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { recalcDisplayNames } = require('../utils/displayName');
const { getBalance } = require('../utils/balance');

router.get('/', requireAdmin, (req, res) => {
  const pendingCount = db.prepare(`SELECT COUNT(*) c FROM leave_requests WHERE status='pending'`).get().c;
  const employeeCount = db.prepare(`SELECT COUNT(*) c FROM employees WHERE active=1`).get().c;
  res.render('admin/dashboard', { emp: req.session.employee, pendingCount, employeeCount });
});

// ---- 직원 관리 ----
router.get('/employees', requireAdmin, (req, res) => {
  const employees = db.prepare(`SELECT * FROM employees WHERE active = 1 ORDER BY hire_date ASC`).all();
  const withBalance = employees.map(e => ({ ...e, balance: getBalance(e.id, e.hire_date) }));
  res.render('admin/employees', { emp: req.session.employee, employees: withBalance, error: req.query.error, success: req.query.success });
});

router.post('/employees', requireAdmin, (req, res) => {
  const { name, birth_date, hire_date, department, role } = req.body;
  const birthDigits = (birth_date || '').replace(/\D/g, '');

  if (!name || birthDigits.length !== 8 || !hire_date) {
    return res.redirect('/admin/employees?error=' + encodeURIComponent('이름/생년월일(8자리)/입사일을 확인해주세요.'));
  }

  const info = db.prepare(
    `INSERT INTO employees (name, display_name, birth_date, hire_date, department, role)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(name.trim(), name.trim(), birthDigits, hire_date, department || '', role === 'admin' ? 'admin' : 'employee');

  recalcDisplayNames(name.trim());
  res.redirect('/admin/employees?success=' + encodeURIComponent(`${name} 직원이 등록되었습니다.`));
});

router.post('/employees/:id/deactivate', requireAdmin, (req, res) => {
  db.prepare(`UPDATE employees SET active = 0 WHERE id = ?`).run(req.params.id);
  res.redirect('/admin/employees?success=' + encodeURIComponent('퇴사 처리되었습니다.'));
});

// 직원 정보 수정 (이름/생년월일/입사일/부서/권한 변경, 관리자 지정 포함)
router.get('/employees/:id/edit', requireAdmin, (req, res) => {
  const employee = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id);
  if (!employee) return res.redirect('/admin/employees?error=' + encodeURIComponent('직원을 찾을 수 없습니다.'));
  res.render('admin/employee_edit', { emp: req.session.employee, employee, error: null });
});

router.post('/employees/:id/edit', requireAdmin, (req, res) => {
  const { name, birth_date, hire_date, department, role } = req.body;
  const birthDigits = (birth_date || '').replace(/\D/g, '');
  const employee = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id);

  if (!employee) return res.redirect('/admin/employees?error=' + encodeURIComponent('직원을 찾을 수 없습니다.'));

  if (!name || birthDigits.length !== 8 || !hire_date) {
    return res.render('admin/employee_edit', { emp: req.session.employee, employee, error: '이름/생년월일(8자리)/입사일을 확인해주세요.' });
  }

  const oldName = employee.name;
  const newName = name.trim();

  db.prepare(
    `UPDATE employees SET name = ?, birth_date = ?, hire_date = ?, department = ?, role = ? WHERE id = ?`
  ).run(newName, birthDigits, hire_date, department || '', role === 'admin' ? 'admin' : 'employee', req.params.id);

  // 이름이 바뀌었으면 기존 동명이인 그룹과 새 동명이인 그룹의 표시명을 모두 재계산
  recalcDisplayNames(oldName);
  recalcDisplayNames(newName);

  // 본인이 로그인 중인 계정을 수정한 경우 세션 정보도 갱신
  if (req.session.employee.id === parseInt(req.params.id, 10)) {
    const updated = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.id);
    req.session.employee = {
      id: updated.id, name: updated.name, display_name: updated.display_name,
      role: updated.role, hire_date: updated.hire_date,
    };
  }

  res.redirect('/admin/employees?success=' + encodeURIComponent(`${newName} 정보가 수정되었습니다.`));
});

// ---- 연차 신청 승인/반려 ----
router.get('/requests', requireAdmin, (req, res) => {
  const status = req.query.status || 'pending';
  const requests = db.prepare(
    `SELECT lr.*, e.display_name, e.department FROM leave_requests lr
     JOIN employees e ON e.id = lr.employee_id
     WHERE lr.status = ?
     ORDER BY lr.requested_at ASC`
  ).all(status);
  res.render('admin/requests', { emp: req.session.employee, requests, status });
});

router.post('/requests/:id/approve', requireAdmin, (req, res) => {
  db.prepare(
    `UPDATE leave_requests SET status='approved', processed_at=datetime('now'), processed_by=? WHERE id=?`
  ).run(req.session.employee.id, req.params.id);
  res.redirect('/admin/requests');
});

router.post('/requests/:id/reject', requireAdmin, (req, res) => {
  db.prepare(
    `UPDATE leave_requests SET status='rejected', processed_at=datetime('now'), processed_by=?, reject_reason=? WHERE id=?`
  ).run(req.session.employee.id, req.body.reject_reason || '', req.params.id);
  res.redirect('/admin/requests');
});

module.exports = router;
