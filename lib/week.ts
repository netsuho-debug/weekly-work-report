// Design Ref: §5 lib/week.ts, §2-1 — 주차(월~일)·마감(목 11:00)·지각 판정을 한국 시간(KST)으로 계산한다.
// Plan SC: S5 "목요일 11:00 이후 제출·재제출은 지각 제출", 위험표 "서버(Vercel)는 UTC이므로 KST 변환 명시"
//
// 주차는 "월요일 날짜"를 문자열("YYYY-MM-DD")로 들고 다닌다. (reports.week_start 와 같은 모양)
// 한국은 서머타임이 없어 항상 UTC+9 이므로 고정값으로 계산한다.

/** 한국 시간은 세계 표준시(UTC)보다 9시간 빠르다 */
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 마감: 매주 목요일 11:00 (공휴일이어도 변경 없음 — PRD 4장. 2026-11-12 화 14:00 에서 변경) */
export const DEADLINE_DAY_FROM_MONDAY = 3; // 월요일 + 3일 = 목요일
export const DEADLINE_HOUR = 11;

const WEEK_START_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 한국 시간 기준 날짜 부품들 (월은 1~12) */
function kstParts(date: Date) {
  // KST 벽시계 시각을 UTC 필드로 읽기 위해 9시간을 더해 둔다
  const shifted = new Date(date.getTime() + KST_OFFSET_MS);
  return {
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate(),
    weekday: shifted.getUTCDay(), // 0=일 ... 6=토
  };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

/** "YYYY-MM-DD" 로 만든다 */
function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** "YYYY-MM-DD"(달력 날짜)를 UTC 자정 시각(ms)으로 바꾼다. 날짜 더하기·빼기 계산용 */
function ymdToUtcMs(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** UTC 자정 시각(ms)을 "YYYY-MM-DD"로 바꾼다 */
function utcMsToYmd(ms: number): string {
  const d = new Date(ms);
  return formatYmd(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

/** week_start 로 쓸 수 있는 값인지 확인한다: 형식이 맞고, 실제 존재하는 날짜이며, 월요일이어야 한다 */
export function isValidWeekStart(value: unknown): value is string {
  if (typeof value !== "string" || !WEEK_START_PATTERN.test(value)) return false;
  const ms = ymdToUtcMs(value);
  // 2026-02-31 같은 없는 날짜는 되돌렸을 때 값이 달라진다
  return utcMsToYmd(ms) === value && new Date(ms).getUTCDay() === 1;
}

/** 어떤 순간이 속한 주의 월요일 날짜를 구한다 (한국 시간 기준, 월~일이 한 주). 기본값은 지금 */
export function getWeekStart(at: Date = new Date()): string {
  const { year, month, day, weekday } = kstParts(at);
  const daysSinceMonday = (weekday + 6) % 7; // 월=0, 화=1, ... 일=6
  return utcMsToYmd(Date.UTC(year, month - 1, day) - daysSinceMonday * DAY_MS);
}

/** 주차를 n주 앞(+)/뒤(-)로 옮긴다. 예: addWeeks("2026-11-09", -1) → "2026-11-02" */
export function addWeeks(weekStart: string, weeks: number): string {
  return utcMsToYmd(ymdToUtcMs(weekStart) + weeks * 7 * DAY_MS);
}

/** 그 주의 일요일 날짜 */
export function getWeekEnd(weekStart: string): string {
  return utcMsToYmd(ymdToUtcMs(weekStart) + 6 * DAY_MS);
}

/** 그 주의 제출 마감 시각 = 목요일 11:00:00 (KST). 반환값은 비교용 Date */
export function getDeadline(weekStart: string): Date {
  const mondayUtcMs = ymdToUtcMs(weekStart);
  const deadlineKstWallMs =
    mondayUtcMs + DEADLINE_DAY_FROM_MONDAY * DAY_MS + DEADLINE_HOUR * 60 * 60 * 1000;
  return new Date(deadlineKstWallMs - KST_OFFSET_MS);
}

/**
 * 지각 제출인지 판정한다. 마감 시각(목 11:00:00 KST) "이상"이면 지각이다. (DESIGN §2-1, §7)
 * - 마감 전에 냈더라도 마감 뒤에 고쳐서 다시 제출하면 마지막 제출 시각으로 다시 판정한다.
 * - weekStart 를 안 주면 제출 시각이 속한 주를 보고 주차로 삼는다. (DESIGN §8-3)
 */
export function isLate(submittedAt: Date, weekStart: string = getWeekStart(submittedAt)): boolean {
  return submittedAt.getTime() >= getDeadline(weekStart).getTime();
}

/** 화면 표시용 주차 문구. 예: "2026-11-09(월) ~ 2026-11-15(일)" */
export function formatWeekRange(weekStart: string): string {
  const end = getWeekEnd(weekStart);
  return `${weekStart}(${DAY_NAMES[1]}) ~ ${end}(${DAY_NAMES[0]})`;
}

/** 화면 표시용 마감 문구. 예: "목 11:00" (마감 요일·시각 상수에서 만든다) */
export const DEADLINE_LABEL = `${DAY_NAMES[(1 + DEADLINE_DAY_FROM_MONDAY) % 7]} ${pad2(DEADLINE_HOUR)}:00`;

/**
 * 주소의 `?week=` 값을 현황판에서 쓸 주차(월요일 날짜)로 정리한다. (작업 11 지난 주차 조회)
 * - 올바른 월요일 날짜이고 이번 주 이전(또는 이번 주)이면 그 주차를 쓴다.
 * - 없거나, 형식·날짜가 틀리거나, 월요일이 아니거나, 아직 오지 않은 주차면 "이번 주"로 돌린다.
 * 사용자가 주소를 직접 고쳐 쓸 수 있으므로 들어온 값은 믿지 않고 항상 이 함수를 거친다.
 */
export function resolveWeekParam(
  param: string | string[] | undefined,
  now: Date = new Date(),
): string {
  const current = getWeekStart(now);
  const value = Array.isArray(param) ? param[0] : param;
  // "YYYY-MM-DD" 는 글자 순서가 곧 날짜 순서라서 문자열 비교로 충분하다
  return isValidWeekStart(value) && value <= current ? value : current;
}

/** 최근 주차 목록 (월요일 날짜, 최신이 맨 앞). 예: recentWeekStarts("2026-11-09", 3) → [11-09, 11-02, 10-26] */
export function recentWeekStarts(currentWeekStart: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => addWeeks(currentWeekStart, -i));
}

/** "이번 주"에 대응하는 "다음 주 예정 작업"의 주차 (월요일 날짜) */
export function getNextWeekStart(weekStart: string): string {
  return addWeeks(weekStart, 1);
}
