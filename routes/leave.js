const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const db = require('../db/database');
const { requireLogin } = require('../middleware/auth');
const { getBalance } = require('../utils/balance');

router.get('/', requireLogin, (req, res) => {
  const emp = req.session.employee;
  const balance = getBalance(emp.id, emp.hire_date);
  const requests = db.prepare(
    `SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY requested_at DESC LIMIT 20`
  ).all(emp.id);
  res.render('dashboard', { emp, balance, requests, error: null, success: req.query.success });
});

router.post('/request', requireLogin, (req, res) => {
  const emp = req.session.employee;
  const { start_date, end_date, reason } = req.body;

  if (!start_date || !end_date) {
    const balance = getBalance(emp.id, emp.hire_date);
    const requests = db.prepare(`SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY requested_at DESC LIMIT 20`).all(emp.id);
    return res.render('dashboard', { emp, balance, requests, error: '시작일과 종료일을 입력해주세요.', success: null });
  }

  const start = dayjs(start_date);
  const end = dayjs(end_date);
  const days = end.diff(start, 'day') + 1;

  const balance = getBalance(emp.id, emp.hire_date);

  if (days <= 0) {
    const requests = db.prepare(`SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY requested_at DESC LIMIT 20`).all(emp.id);
    return res.render('dashboard', { emp, balance, requests, error: '종료일은 시작일 이후여야 합니다.', success: null });
  }

  if (days > balance.remaining) {
    const requests = db.prepare(`SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY requested_at DESC LIMIT 20`).all(emp.id);
    return res.render('dashboard', { emp, balance, requests, error: `잔여 연차(${balance.remaining}일)를 초과했습니다.`, success: null });
  }

  db.prepare(
    `INSERT INTO leave_requests (employee_id, start_date, end_date, days, reason, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`
  ).run(emp.id, start_date, end_date, days, reason || '');

  res.redirect('/?success=신청이 접수되었습니다.');
});

router.post('/request/:id/cancel', requireLogin, (req, res) => {
  const emp = req.session.employee;
  const reqRow = db.prepare(`SELECT * FROM leave_requests WHERE id = ? AND employee_id = ?`).get(req.params.id, emp.id);
  if (reqRow && reqRow.status === 'pending') {
    db.prepare(`UPDATE leave_requests SET status = 'cancelled' WHERE id = ?`).run(req.params.id);
  }
  res.redirect('/');
});

module.exports = router;
