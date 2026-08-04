const db = require('../db/database');
const dayjs = require('dayjs');
const { annualLeaveEntitlement, currentLeaveYearStart, currentLeaveYearEnd } = require('./leaveCalculator');

function getBalance(employeeId, hireDate) {
  const entitlement = annualLeaveEntitlement(hireDate);
  const yearStart = currentLeaveYearStart(hireDate);
  const yearEnd = currentLeaveYearEnd(hireDate);

  const used = db.prepare(
    `SELECT COALESCE(SUM(days), 0) as total FROM leave_requests
     WHERE employee_id = ? AND status = 'approved'
     AND start_date >= ? AND start_date < ?`
  ).get(employeeId, yearStart.format('YYYY-MM-DD'), yearEnd.format('YYYY-MM-DD'));

  const pending = db.prepare(
    `SELECT COALESCE(SUM(days), 0) as total FROM leave_requests
     WHERE employee_id = ? AND status = 'pending'
     AND start_date >= ? AND start_date < ?`
  ).get(employeeId, yearStart.format('YYYY-MM-DD'), yearEnd.format('YYYY-MM-DD'));

  return {
    entitlement,
    used: used.total,
    pending: pending.total,
    remaining: Math.round((entitlement - used.total) * 10) / 10,
    yearStart: yearStart.format('YYYY-MM-DD'),
    yearEnd: yearEnd.format('YYYY-MM-DD'),
  };
}

module.exports = { getBalance };
