const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'leave.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS employees (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  birth_date TEXT NOT NULL,        -- YYYYMMDD
  hire_date TEXT NOT NULL,         -- YYYY-MM-DD
  department TEXT,
  role TEXT NOT NULL DEFAULT 'employee', -- employee | admin
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS leave_requests (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  days REAL NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected | cancelled
  requested_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT,
  processed_by INTEGER,
  reject_reason TEXT,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS promotion_notices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  leave_year_start TEXT NOT NULL,   -- 해당 연차 발생 회차 기준일
  stage INTEGER NOT NULL,           -- 1 = 1차 촉구, 2 = 2차(사용자 지정)
  remaining_days REAL NOT NULL,
  sent_date TEXT,
  employee_response_date TEXT,
  employee_designated_dates TEXT,
  employer_designated_dates TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- pending | sent | responded | designated
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE TABLE IF NOT EXISTS leave_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  employee_id INTEGER NOT NULL,
  amount REAL NOT NULL,             -- 양수: 추가 부여, 음수: 차감
  reason TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  created_by INTEGER,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
);

CREATE INDEX IF NOT EXISTS idx_leave_employee ON leave_requests(employee_id);
CREATE INDEX IF NOT EXISTS idx_promo_employee ON promotion_notices(employee_id);
CREATE INDEX IF NOT EXISTS idx_adjust_employee ON leave_adjustments(employee_id);
`);

// --- 마이그레이션: 기존 배포된 DB에 새 컬럼 추가 (이미 있으면 무시) ---
function ensureColumn(table, column, definition) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
  if (!cols.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
ensureColumn('leave_requests', 'leave_type', `TEXT NOT NULL DEFAULT 'full'`); // full | half | quarter | hourly
ensureColumn('leave_requests', 'detail', `TEXT`); // 반차(오전/오후), 시차 시간범위 등 부가정보

module.exports = db;
