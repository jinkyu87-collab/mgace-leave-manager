const express = require('express');
const router = express.Router();
const db = require('../db/database');

router.get('/login', (req, res) => {
  if (req.session.employee) return res.redirect('/');
  res.render('login', { error: null });
});

router.post('/login', (req, res) => {
  const { name, birth_date } = req.body;
  const birthDigits = (birth_date || '').replace(/\D/g, '');

  if (!name || birthDigits.length !== 8) {
    return res.render('login', { error: '이름과 생년월일(8자리, 예:19900101)을 정확히 입력해주세요.' });
  }

  const employee = db.prepare(
    `SELECT * FROM employees WHERE name = ? AND birth_date = ? AND active = 1`
  ).get(name.trim(), birthDigits);

  if (!employee) {
    return res.render('login', { error: '일치하는 직원 정보가 없습니다. 이름/생년월일을 확인해주세요.' });
  }

  req.session.employee = {
    id: employee.id,
    name: employee.name,
    display_name: employee.display_name,
    role: employee.role,
    hire_date: employee.hire_date,
  };
  res.redirect(employee.role === 'admin' ? '/admin' : '/');
});

router.post('/logout', (req, res) => {
  req.session.destroy(() => res.redirect('/login'));
});

module.exports = router;
