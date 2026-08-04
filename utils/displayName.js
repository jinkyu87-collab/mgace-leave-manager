const db = require('../db/database');

/**
 * 특정 이름을 가진 모든 직원의 display_name을 재계산한다.
 * 동일 이름이 1명이면 이름 그대로, 2명 이상이면 입사일(오래된 순) 기준으로
 * 이름1, 이름2 ... 순번을 붙인다.
 */
function recalcDisplayNames(name) {
  const rows = db.prepare(
    `SELECT id FROM employees WHERE name = ? ORDER BY hire_date ASC, id ASC`
  ).all(name);

  if (rows.length <= 1) {
    if (rows.length === 1) {
      db.prepare(`UPDATE employees SET display_name = ? WHERE id = ?`).run(name, rows[0].id);
    }
    return;
  }

  rows.forEach((row, idx) => {
    const displayName = `${name}${idx + 1}`;
    db.prepare(`UPDATE employees SET display_name = ? WHERE id = ?`).run(displayName, row.id);
  });
}

module.exports = { recalcDisplayNames };
