const db = require('../db/database');
const dayjs = require('dayjs');
const { annualLeaveEntitlement, currentLeaveYearStart, currentLeaveYearEnd } = require('./leaveCalculator');

function getBalance(employeeId, hireDate) {
  const legalEntitlement = annualLeaveEntitlement(hireDate);
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

  // 관리자가 수동으로 조정한 값(정정/이월 등, 양수=추가, 음수=차감)
  const adjustment = db.prepare(
    `SELECT COALESCE(SUM(amount), 0) as total FROM leave_adjustments WHERE employee_id = ?`
  ).get(employeeId);

  const entitlement = Math.round((legalEntitlement + adjustment.total) * 100) / 100;

  return {
    legalEntitlement,
    adjustment: adjustment.total,
    entitlement,
    used: used.total,
    pending: pending.total,
    remaining: Math.round((entitlement - used.total) * 100) / 100,
    yearStart: yearStart.format('YYYY-MM-DD'),
    yearEnd: yearEnd.format('YYYY-MM-DD'),
  };
}

module.exports = { getBalance };
