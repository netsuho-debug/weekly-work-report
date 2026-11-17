// Design Ref: §1-3 현황판 — "주차는 화살표·목록으로 고른다. 기본값은 이번 주."
// Plan SC: 작업 11 "주차를 골라 과거 보고와 현황 보기" (PRD 5장: 주차는 월요일~일요일을 한 주로 센다)
//
// 화살표는 링크, 목록은 일반 폼(GET)이다. 목록은 고르면 바로 이동하고, 자바스크립트가 꺼졌을 때만 [보기] 버튼이 보인다.
// 고른 주차는 주소(?week=YYYY-MM-DD)에 남아서, 새로고침해도 같은 주차가 유지되고 주소를 공유할 수도 있다.

import Link from "next/link";
import AutoSubmitSelect from "./AutoSubmitSelect";
import { addWeeks, formatWeekRange, getWeekEnd, recentWeekStarts } from "@/lib/week";

/** 목록에 보여 줄 최근 주차 수 (약 반 년). 더 오래된 주차는 화살표로 계속 거슬러 갈 수 있다 */
const LIST_WEEKS = 26;

/** 보기 방식: 이번 주 작업 내용(this, 기본) / 다음 주 예정 작업(next). 주소의 ?view=next */
export type DashboardView = "this" | "next";

/** 현황판 주소. 이번 주는 `?week=` 없이, 청사를 고르지 않았으면 `?office=` 없이, 기본 보기면 `?view=` 없이 둔다 */
export function dashboardHref(
  weekStart: string,
  currentWeekStart: string,
  officeId: number | null = null,
  view: DashboardView = "this",
): string {
  const params = new URLSearchParams();
  if (weekStart !== currentWeekStart) params.set("week", weekStart);
  if (officeId !== null) params.set("office", String(officeId));
  if (view === "next") params.set("view", "next");
  const query = params.toString();
  return query ? `/dashboard?${query}` : "/dashboard";
}

type WeekPickerProps = {
  /** 지금 보고 있는 주차 (월요일 날짜) */
  weekStart: string;
  /** 이번 주 (월요일 날짜) */
  currentWeekStart: string;
  /** 고른 청사 (전체면 null). 주차를 옮겨도 유지한다 */
  officeId?: number | null;
  /** 보기 방식. 주차를 옮겨도 유지한다 */
  view?: DashboardView;
};

/** 세 칸이 한 덩어리로 붙은 버튼(이전 주 | 이번 주 | 다음 주)의 한 칸 */
const segClass =
  "flex items-center justify-center px-2 py-2.5 text-sm font-medium text-zinc-800 hover:bg-zinc-100 " +
  "dark:text-zinc-200 dark:hover:bg-zinc-800";
const segActiveClass = "flex items-center justify-center bg-brand px-2 py-2.5 text-sm font-semibold text-white";
const segDisabledClass =
  "flex items-center justify-center px-2 py-2.5 text-sm font-medium text-zinc-300 dark:text-zinc-600";

/** 선택 상자 공통 모양 (주차·사업장) */
export const selectClass =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-2.5 text-sm " +
  "dark:border-zinc-700 dark:bg-zinc-900";

/** 자바스크립트가 꺼졌을 때만 보이는 [보기] 버튼 */
export const noscriptButtonClass = "shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700";

/** 이전 주 | 이번 주 | 다음 주 — 화면 폭을 꽉 채우는 세 칸 버튼 */
export default function WeekPicker({ weekStart, currentWeekStart, officeId = null, view = "this" }: WeekPickerProps) {
  const isCurrent = weekStart === currentWeekStart;
  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);
  // 다음 주까지만 볼 수 있다 (lib/week.ts 의 resolveWeekParam 과 같은 규칙)
  const isLatest = weekStart >= addWeeks(currentWeekStart, 1);

  return (
    <nav
      aria-label="주차 이동"
      className="grid grid-cols-3 divide-x divide-zinc-300 overflow-hidden rounded-lg border border-zinc-300 bg-white dark:divide-zinc-700 dark:border-zinc-700"
    >
      <Link href={dashboardHref(prev, currentWeekStart, officeId, view)} className={segClass} aria-label="이전 주">
        ◀ 이전 주
      </Link>
      {/* 이번 주로 바로 돌아가는 버튼. 이미 이번 주를 보고 있으면 눌린 상태로 보여 준다 */}
      {isCurrent ? (
        <span className={segActiveClass} aria-current="page">
          이번 주
        </span>
      ) : (
        <Link href={dashboardHref(currentWeekStart, currentWeekStart, officeId, view)} className={segClass}>
          이번 주
        </Link>
      )}
      {isLatest ? (
        // 다음 주보다 먼 미래로는 갈 수 없다
        <span className={segDisabledClass} aria-disabled="true">
          다음 주 ▶
        </span>
      ) : (
        <Link href={dashboardHref(next, currentWeekStart, officeId, view)} className={segClass} aria-label="다음 주">
          다음 주 ▶
        </Link>
      )}
    </nav>
  );
}

/** 주차 목록. 고르면 바로 그 주로 이동한다 */
export function WeekSelect({ weekStart, currentWeekStart, officeId = null, view = "this" }: WeekPickerProps) {
  const nextWeekStart = addWeeks(currentWeekStart, 1);
  // 목록: 다음 주 + 최근 주차들 + (그보다 오래된 주차를 보고 있다면) 지금 보는 주차
  const options = [nextWeekStart, ...recentWeekStarts(currentWeekStart, LIST_WEEKS)];
  if (!options.includes(weekStart)) options.push(weekStart);

  return (
    <form action="/dashboard" method="get" className="flex min-w-0 items-center gap-2">
      {officeId !== null && <input type="hidden" name="office" value={officeId} />}
      {view === "next" && <input type="hidden" name="view" value="next" />}
      <label htmlFor="week-select" className="sr-only">
        주차 고르기
      </label>
      <AutoSubmitSelect
        // key: 화살표로 주차를 옮겨도(페이지 새로고침 없이 화면만 바뀜) 목록이 지금 주차를 가리키게 새로 만든다.
        // defaultValue 는 처음 한 번만 적용되기 때문이다.
        key={weekStart}
        id="week-select"
        name="week"
        defaultValue={weekStart}
        className={selectClass}
      >
        {options.map((w) => (
          <option key={w} value={w}>
            {/* 휴대폰 반쪽 폭에도 들어가도록 짧게 적는다. 예) 11.16~11.22 이번 주 */}
            {w.slice(5).replace("-", ".")}~{getWeekEnd(w).slice(5).replace("-", ".")}
            {w === currentWeekStart ? " 이번 주" : w === nextWeekStart ? " 다음 주" : ""}
          </option>
        ))}
      </AutoSubmitSelect>
      <noscript>
        <button type="submit" className={noscriptButtonClass}>
          보기
        </button>
      </noscript>
    </form>
  );
}

/** 위쪽에 보여 줄 "어느 주차인지" 문구 */
export function weekHeading(weekStart: string, currentWeekStart: string): string {
  const label =
    weekStart === currentWeekStart ? " (이번 주)" : weekStart === addWeeks(currentWeekStart, 1) ? " (다음 주)" : "";
  return `${formatWeekRange(weekStart)} 주${label}`;
}
