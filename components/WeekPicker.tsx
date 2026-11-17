// Design Ref: §1-3 현황판 — "주차는 화살표로 고른다. 기본값은 이번 주."
// Plan SC: 작업 11 "주차를 골라 과거 보고와 현황 보기" (PRD 5장: 주차는 월요일~일요일을 한 주로 센다)
//
// 2026-11-17 디자인 3차: 남색 머리띠 안에 "◀ 11.16(월) ~ 11.22(일) [이번 주] ▶" 한 줄로 둔다.
// (따로 있던 세 칸 버튼과 주차 목록은 머리띠의 주차 표시와 겹쳐서 없앴다. 지난 주차는 ◀ 로 계속 거슬러 갈 수 있다)
// 화살표는 링크다. 고른 주차는 주소(?week=YYYY-MM-DD)에 남아서, 새로고침해도 유지되고 주소를 공유할 수도 있다.

import Link from "next/link";
import { addWeeks, getWeekEnd } from "@/lib/week";

/** 보기 방식: 이번 주 작업 내용(this, 기본) / 다음 주 예정 작업(next). 주소의 ?view=next */
export type DashboardView = "this" | "next";

/** 현황판 주소. 이번 주는 `?week=` 없이, 사업장을 고르지 않았으면 `?office=` 없이, 기본 보기면 `?view=` 없이 둔다 */
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

/** 선택 상자 공통 모양 (사업장 목록) */
export const selectClass =
  "w-full min-w-0 rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-sm " +
  "dark:border-zinc-700 dark:bg-zinc-900";

/** 자바스크립트가 꺼졌을 때만 보이는 [보기] 버튼 */
export const noscriptButtonClass = "shrink-0 rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700";

/** "2026-11-16" → "11.16" */
function shortDate(ymd: string): string {
  return ymd.slice(5).replace("-", ".");
}

const arrowClass =
  "inline-flex h-8 w-8 items-center justify-center rounded-full text-sky-100 hover:bg-white/10 hover:text-white";

/** 남색 머리띠 안의 주차 이동: ◀ 11.16(월) ~ 11.22(일) [이번 주] ▶ */
export default function WeekPicker({
  weekStart,
  currentWeekStart,
  officeId = null,
}: {
  /** 지금 보고 있는 주차 (월요일 날짜) */
  weekStart: string;
  /** 이번 주 (월요일 날짜) */
  currentWeekStart: string;
  /** 고른 사업장 (전체면 null). 주차를 옮겨도 유지한다 */
  officeId?: number | null;
}) {
  const nextWeekStart = addWeeks(currentWeekStart, 1);
  // 다음 주까지만 볼 수 있다 (lib/week.ts 의 resolveWeekParam 과 같은 규칙)
  const isLatest = weekStart >= nextWeekStart;
  const tag = "이번 주";

  return (
    <nav aria-label="주차 이동" className="flex flex-wrap items-center gap-x-1 gap-y-1">
      <Link href={dashboardHref(addWeeks(weekStart, -1), currentWeekStart, officeId)} className={arrowClass} aria-label="이전 주">
        ◀
      </Link>
      <span className="text-base font-semibold tabular-nums sm:text-lg">
        {shortDate(weekStart)}(월) ~ {shortDate(getWeekEnd(weekStart))}(일)
      </span>
      {/* 이번 주를 보고 있으면 "이번 주" 표시, 다른 주를 보고 있으면 같은 자리에 "이번 주로" 칩 (휴대폰에서 줄바꿈되지 않게 한 자리만 쓴다) */}
      {weekStart === currentWeekStart ? (
        <span className="ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs font-semibold text-white">{tag}</span>
      ) : (
        <Link
          href={dashboardHref(currentWeekStart, currentWeekStart, officeId)}
          className="ml-1 whitespace-nowrap rounded-full bg-white px-2 py-0.5 text-xs font-semibold text-brand-dark hover:bg-sky-50"
        >
          이번 주로
        </Link>
      )}
      {isLatest ? (
        // 다음 주보다 먼 미래로는 갈 수 없다
        <span className={`${arrowClass} cursor-default opacity-30 hover:bg-transparent`} aria-disabled="true">
          ▶
        </span>
      ) : (
        <Link href={dashboardHref(addWeeks(weekStart, 1), currentWeekStart, officeId)} className={arrowClass} aria-label="다음 주">
          ▶
        </Link>
      )}
    </nav>
  );
}
