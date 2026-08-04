// 최초 관리자 계정 생성 스크립트
// 사용법: node seed.js
const db = require('./db/database');
const { recalcDisplayNames } = require('./utils/displayName');

const name = process.env.SEED_ADMIN_NAME || '관리자';
const birth = process.env.SEED_ADMIN_BIRTH || '19900101';
const hireDate = process.env.SEED_ADMIN_HIRE || '2020-01-01';

const exists = db.prepare(`SELECT * FROM employees WHERE name = ? AND birth_date = ?`).get(name, birth);
if (exists) {
  console.log('이미 존재하는 관리자 계정입니다:', exists.display_name);
} else {
  db.prepare(
    `INSERT INTO employees (name, display_name, birth_date, hire_date, department, role) VALUES (?, ?, ?, ?, '경영지원', 'admin')`
  ).run(name, name, birth, hireDate);
  recalcDisplayNames(name);
  console.log(`관리자 계정 생성 완료: 이름=${name}, 생년월일=${birth} 로 로그인하세요.`);
}
