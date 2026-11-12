// Design Ref: §1-3 현황판 — "주차는 화살표·목록으로 고른다. 기본값은 이번 주."
// Plan SC: 작업 11 "주차를 골라 과거 보고와 현황 보기" (PRD 5장: 주차는 월요일~일요일을 한 주로 센다)
//
// 자바스크립트 없이 동작한다: 화살표는 링크, 목록은 "보기" 버튼이 있는 일반 폼(GET)이다.
// 고른 주차는 주소(?week=YYYY-MM-DD)에 남아서, 새로고침해도 같은 주차가 유지되고 주소를 공유할 수도 있다.

import Link from "next/link";
import { addWeeks, formatWeekRange, getWeekEnd, recentWeekStarts } from "@/lib/week";

/** 목록에 보여 줄 최근 주차 수 (약 반 년). 더 오래된 주차는 화살표로 계속 거슬러 갈 수 있다 */
const LIST_WEEKS = 26;

/** 보기 방식: 다음 주 예정 작업(next, 기본) / 이번 주 진행 사항(this). 주소의 ?view=this */
export type DashboardView = "this" | "next";

/** 현황판 주소. 이번 주는 `?week=` 없이, 청사를 고르지 않았으면 `?office=` 없이 둔다 */
export function dashboardHref(
  weekStart: string,
  currentWeekStart: string,
  officeId: number | null = null,
  view: DashboardView = "next",
): string {
  const params = new URLSearchParams();
  if (weekStart !== currentWeekStart) params.set("week", weekStart);
  if (officeId !== null) params.set("office", String(officeId));
  if (view === "this") params.set("view", "this");
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

const buttonClass =
  "rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 " +
  "dark:border-zinc-700 dark:hover:bg-zinc-800";
const disabledClass =
  "rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-400 " +
  "dark:border-zinc-800 dark:text-zinc-600";

export default function WeekPicker({ weekStart, currentWeekStart, officeId = null, view = "next" }: WeekPickerProps) {
  const isCurrent = weekStart === currentWeekStart;
  const prev = addWeeks(weekStart, -1);
  const next = addWeeks(weekStart, 1);

  // 목록: 최근 주차들 + (그보다 오래된 주차를 보고 있다면) 지금 보는 주차
  const options = recentWeekStarts(currentWeekStart, LIST_WEEKS);
  if (!options.includes(weekStart)) options.push(weekStart);

  return (
    <nav aria-label="주차 선택" className="flex flex-wrap items-center gap-2">
      <Link href={dashboardHref(prev, currentWeekStart, officeId, view)} className={buttonClass} aria-label="이전 주">
        ◀ 이전 주
      </Link>
      {isCurrent ? (
        // 아직 오지 않은 주차에는 보고가 있을 수 없으므로 "다음 주"로는 갈 수 없다
        <span className={disabledClass} aria-disabled="true">
          다음 주 ▶
        </span>
      ) : (
        <Link href={dashboardHref(next, currentWeekStart, officeId, view)} className={buttonClass} aria-label="다음 주">
          다음 주 ▶
        </Link>
      )}

      <form action="/dashboard" method="get" className="flex items-center gap-2">
        {officeId !== null && <input type="hidden" name="office" value={officeId} />}
        {view === "this" && <input type="hidden" name="view" value="this" />}
        <label htmlFor="week-select" className="sr-only">
          주차 고르기
        </label>
        <select
          // key: 화살표로 주차를 옮겨도(페이지 새로고침 없이 화면만 바뀜) 목록이 지금 주차를 가리키게 새로 만든다.
          // defaultValue 는 처음 한 번만 적용되기 때문이다.
          key={weekStart}
          id="week-select"
          name="week"
          defaultValue={weekStart}
          className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
        >
          {options.map((w) => (
            <option key={w} value={w}>
              {w.slice(5)} ~ {getWeekEnd(w).slice(5)}
              {w === currentWeekStart ? " (이번 주)" : ""}
            </option>
          ))}
        </select>
        <button type="submit" className={buttonClass}>
          보기
        </button>
      </form>

      {!isCurrent && (
        <Link
          href={dashboardHref(currentWeekStart, currentWeekStart, officeId, view)}
          className="text-sm font-medium text-brand underline dark:text-sky-300"
        >
          이번 주로
        </Link>
      )}
    </nav>
  );
}

/** 위쪽에 보여 줄 "어느 주차인지" 문구 */
export function weekHeading(weekStart: string, currentWeekStart: string): string {
  return `${formatWeekRange(weekStart)} 주${weekStart === currentWeekStart ? " (이번 주)" : ""}`;
}
