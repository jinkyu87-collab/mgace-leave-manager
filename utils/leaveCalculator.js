const dayjs = require('dayjs');

/**
 * 근로기준법 제60조 기준 연차 계산 (입사일 기준)
 * - 1년 미만: 1개월 개근시 1일 (최대 11일)
 * - 1년 이상: 15일 + (근속연수-1)/2 를 내림한 만큼 가산, 최대 25일
 */
function annualLeaveEntitlement(hireDate, asOfDate = dayjs()) {
  const hire = dayjs(hireDate);
  const now = dayjs(asOfDate);
  const fullMonths = now.diff(hire, 'month');
  const fullYears = Math.floor(fullMonths / 12);

  if (fullYears < 1) {
    return Math.max(0, Math.min(fullMonths, 11));
  }
  const additional = Math.floor((fullYears - 1) / 2);
  return Math.min(15 + additional, 25);
}

/**
 * 현재 근속연차 회차의 시작일(연차 발생 기준일)을 구한다.
 * 입사일 기준으로 매년 도래하는 기념일 중 오늘 이전 가장 최근 날짜.
 */
function currentLeaveYearStart(hireDate, asOfDate = dayjs()) {
  const hire = dayjs(hireDate);
  const now = dayjs(asOfDate);
  let years = now.diff(hire, 'year');
  let anniversary = hire.add(years, 'year');
  if (anniversary.isAfter(now)) {
    years -= 1;
    anniversary = hire.add(years, 'year');
  }
  return anniversary;
}

/** 현재 회차의 종료일 (연차 사용기한, 발생일로부터 1년) */
function currentLeaveYearEnd(hireDate, asOfDate = dayjs()) {
  return currentLeaveYearStart(hireDate, asOfDate).add(1, 'year');
}

/** 연차촉진 1차 통보 시점: 사용기한 만료 6개월 전 (~10일 이내) */
function promotionStage1Deadline(hireDate, asOfDate = dayjs()) {
  return currentLeaveYearEnd(hireDate, asOfDate).subtract(6, 'month');
}

/** 연차촉진 2차(사용자 지정) 통보 시점: 사용기한 만료 2개월 전 */
function promotionStage2Deadline(hireDate, asOfDate = dayjs()) {
  return currentLeaveYearEnd(hireDate, asOfDate).subtract(2, 'month');
}

module.exports = {
  annualLeaveEntitlement,
  currentLeaveYearStart,
  currentLeaveYearEnd,
  promotionStage1Deadline,
  promotionStage2Deadline,
};
