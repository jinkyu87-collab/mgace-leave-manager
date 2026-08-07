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

const LEAVE_TYPE_LABELS = {
  full: '연차',
  half: '반차',
  quarter: '반반차',
  hourly: '시차',
};

function renderError(res, emp, error) {
  const balance = getBalance(emp.id, emp.hire_date);
  const requests = db.prepare(`SELECT * FROM leave_requests WHERE employee_id = ? ORDER BY requested_at DESC LIMIT 20`).all(emp.id);
  return res.render('dashboard', { emp, balance, requests, error, success: null });
}

router.post('/request', requireLogin, (req, res) => {
  const emp = req.session.employee;
  const { leave_type, reason } = req.body;
  const type = ['full', 'half', 'quarter', 'hourly'].includes(leave_type) ? leave_type : 'full';

  let start_date, end_date, days, detail;

  if (type === 'full') {
    start_date = req.body.start_date;
    end_date = req.body.end_date;
    if (!start_date || !end_date) return renderError(res, emp, '시작일과 종료일을 입력해주세요.');
    days = dayjs(end_date).diff(dayjs(start_date), 'day') + 1;
    if (days <= 0) return renderError(res, emp, '종료일은 시작일 이후여야 합니다.');
    detail = null;
  } else if (type === 'half') {
    const date = req.body.half_date;
    const period = req.body.half_period === 'pm' ? '오후' : '오전';
    if (!date) return renderError(res, emp, '반차 사용일을 선택해주세요.');
    start_date = end_date = date;
    days = 0.5;
    detail = `${period} 반차`;
  } else if (type === 'quarter') {
    const date = req.body.quarter_date;
    const period = req.body.quarter_period; // am1, am2, pm1, pm2
    const labels = { am1: '오전 1반반차', am2: '오전 2반반차', pm1: '오후 1반반차', pm2: '오후 2반반차' };
    if (!date || !labels[period]) return renderError(res, emp, '반반차 사용일과 시간대를 선택해주세요.');
    start_date = end_date = date;
    days = 0.25;
    detail = labels[period];
  } else if (type === 'hourly') {
    const date = req.body.hourly_date;
    const startHour = parseInt(req.body.hourly_start_hour, 10);
    const hours = parseInt(req.body.hourly_hours, 10);
    if (!date || isNaN(startHour) || isNaN(hours) || hours < 1 || hours > 7) {
      return renderError(res, emp, '시차 사용일, 시작 시각, 사용 시간을 선택해주세요 (1~7시간, 1시간 단위).');
    }
    const from = `${String(startHour).padStart(2, '0')}:00`;
    const to = `${String(startHour + hours).padStart(2, '0')}:00`;
    start_date = end_date = date;
    days = Math.round((hours / 8) * 100) / 100; // 1일 = 8시간 기준 환산
    detail = `${from}~${to} (${hours}시간)`;
  }

  const balance = getBalance(emp.id, emp.hire_date);
  if (days > balance.remaining) {
    return renderError(res, emp, `잔여 연차(${balance.remaining}일)를 초과했습니다. (신청: ${days}일)`);
  }

  db.prepare(
    `INSERT INTO leave_requests (employee_id, start_date, end_date, days, reason, status, leave_type, detail)
     VALUES (?, ?, ?, ?, ?, 'pending', ?, ?)`
  ).run(emp.id, start_date, end_date, days, reason || '', type, detail);

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
