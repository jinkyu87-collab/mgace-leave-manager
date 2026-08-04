const express = require('express');
const router = express.Router();
const dayjs = require('dayjs');
const db = require('../db/database');
const { requireAdmin } = require('../middleware/auth');
const { getBalance } = require('../utils/balance');
const {
  currentLeaveYearStart, currentLeaveYearEnd,
  promotionStage1Deadline, promotionStage2Deadline,
} = require('../utils/leaveCalculator');

router.get('/', requireAdmin, (req, res) => {
  const employees = db.prepare(`SELECT * FROM employees WHERE active = 1 ORDER BY hire_date ASC`).all();
  const today = dayjs();

  const targets = employees.map(e => {
    const balance = getBalance(e.id, e.hire_date);
    const yearStart = currentLeaveYearStart(e.hire_date);
    const yearEnd = currentLeaveYearEnd(e.hire_date);
    const stage1 = promotionStage1Deadline(e.hire_date);
    const stage2 = promotionStage2Deadline(e.hire_date);

    const notice = db.prepare(
      `SELECT * FROM promotion_notices WHERE employee_id = ? AND leave_year_start = ? ORDER BY stage DESC LIMIT 1`
    ).get(e.id, yearStart.format('YYYY-MM-DD'));

    const inWindow = balance.remaining > 0 && !today.isBefore(stage1) && today.isBefore(yearEnd);

    return {
      employee: e,
      balance,
      yearStart: yearStart.format('YYYY-MM-DD'),
      yearEnd: yearEnd.format('YYYY-MM-DD'),
      stage1Deadline: stage1.format('YYYY-MM-DD'),
      stage2Deadline: stage2.format('YYYY-MM-DD'),
      pastStage2: !today.isBefore(stage2),
      notice,
      inWindow,
    };
  }).filter(t => t.inWindow);

  res.render('admin/promotion', { emp: req.session.employee, targets, today: today.format('YYYY-MM-DD') });
});

// 1차 촉구 발송 기록
router.post('/:employeeId/stage1', requireAdmin, (req, res) => {
  const e = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.employeeId);
  const balance = getBalance(e.id, e.hire_date);
  const yearStart = currentLeaveYearStart(e.hire_date).format('YYYY-MM-DD');

  db.prepare(
    `INSERT INTO promotion_notices (employee_id, leave_year_start, stage, remaining_days, sent_date, status)
     VALUES (?, ?, 1, ?, date('now'), 'sent')`
  ).run(e.id, yearStart, balance.remaining);

  res.redirect('/admin/promotion');
});

// 근로자 응답(사용시기 지정) 기록
router.post('/:noticeId/response', requireAdmin, (req, res) => {
  db.prepare(
    `UPDATE promotion_notices SET employee_response_date = date('now'), employee_designated_dates = ?, status = 'responded' WHERE id = ?`
  ).run(req.body.designated_dates || '', req.params.noticeId);
  res.redirect('/admin/promotion');
});

// 2차 통보(사용자 지정) 발송 기록
router.post('/:employeeId/stage2', requireAdmin, (req, res) => {
  const e = db.prepare(`SELECT * FROM employees WHERE id = ?`).get(req.params.employeeId);
  const balance = getBalance(e.id, e.hire_date);
  const yearStart = currentLeaveYearStart(e.hire_date).format('YYYY-MM-DD');

  db.prepare(
    `INSERT INTO promotion_notices (employee_id, leave_year_start, stage, remaining_days, sent_date, employer_designated_dates, status)
     VALUES (?, ?, 2, ?, date('now'), ?, 'designated')`
  ).run(e.id, yearStart, balance.remaining, req.body.designated_dates || '');

  res.redirect('/admin/promotion');
});

module.exports = router;
