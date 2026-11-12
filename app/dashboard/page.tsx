// Design Ref: §1-3 현황판 `/dashboard` (서무직원·담당자)
// Plan SC: 작업 9 "13곳을 모두 보여 주고 제출 / 지각 제출 / 미제출 상태 표시"
//          작업 10 "청사마다 이번 주 작업별 금액과 합계 (다음 주 금액은 합계 제외)"
//          작업 11 주차 선택(?week=), 작업 12 엑셀, 작업 14 [코드 변경]
//          설계 점검(16) 보완: 청사 선택(?office=N) — 고른 청사만 펼쳐서 보여 준다 (DESIGN §1-3)
//
// 보고 입력 화면과 같은 이유로, 현재 시각·DB 를 읽기 전에 connection() 으로 "요청 때마다 계산"하게 한다.
// (Cache Components 가 켜져 있다 — Next 문서: 08-caching.md)

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import LogoutButton from "@/components/LogoutButton";
import OfficePicker from "@/components/OfficePicker";
import OfficeStatusItem, { ROW_GRID } from "@/components/OfficeStatusItem";
import ViewTabs from "@/components/ViewTabs";
import { formatWon } from "@/lib/amount";
import { fetchStatusRows } from "@/lib/dashboard";
import { getOfficeById, OFFICE_COUNT } from "@/lib/offices";
import { isDeptSession } from "@/lib/session";
import {
  STATUS_LABEL,
  countStatuses,
  sumThisWeek,
  type OfficeStatusRow,
} from "@/lib/status";
import { addWeeks, DEADLINE_LABEL, formatWeekRange, getWeekStart, resolveWeekParam } from "@/lib/week";
import WeekPicker, { dashboardHref, weekHeading, type DashboardView } from "@/components/WeekPicker";

export const metadata: Metadata = {
  title: "주간 업무 보고 현황 | 사업장별 주간 공사·작업 현황",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** 주소의 ?office= 값 → 청사 번호. 비었거나 없는 번호면 null(전체) */
function resolveOfficeParam(param: string | string[] | undefined): number | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || !/^\d{1,2}$/.test(value)) return null;
  return getOfficeById(Number(value))?.id ?? null;
}

/** 주소의 ?view= 값 → 보기 방식. 기본은 "다음 주 예정 작업"(이 앱의 목적: 다음 주 업무 파악), ?view=this 면 이번 주 진행 사항 */
function resolveViewParam(param: string | string[] | undefined): DashboardView {
  const value = Array.isArray(param) ? param[0] : param;
  return value === "this" ? "this" : "next";
}

async function DashboardScreen({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // 요청 때마다 이번 주와 최신 제출 현황을 계산한다

  // 부서용 코드로 입장한 사람만 볼 수 있다. 아니면 입장 화면으로 보낸다.
  // (사업장 코드로 들어온 사람은 입장 화면이 자기 보고 입력 화면으로 다시 보내 준다)
  if (!(await isDeptSession())) redirect("/");

  // 주소의 ?week= 로 지난 주차를 고른다. 틀리거나 미래 값이면 이번 주로 돌린다 (resolveWeekParam)
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const params = await searchParams;
  const weekStart = resolveWeekParam(params.week, now);
  const officeId = resolveOfficeParam(params.office);
  const view = resolveViewParam(params.view);
  let rows: OfficeStatusRow[] | null = null;
  try {
    rows = await fetchStatusRows(weekStart);
  } catch {
    rows = null; // 원인은 서버 로그에 남았다. 화면에는 쉬운 말로만 알린다
  }

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold">주간 업무 보고 현황</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {weekHeading(weekStart, currentWeekStart)} · 제출 마감 매주 {DEADLINE_LABEL}
          </p>
        </div>
        <LogoutButton />
      </header>

      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <WeekPicker weekStart={weekStart} currentWeekStart={currentWeekStart} officeId={officeId} view={view} />
        <OfficePicker week={weekStart === currentWeekStart ? null : weekStart} officeId={officeId} view={view} />
      </div>

      <ViewTabs weekStart={weekStart} currentWeekStart={currentWeekStart} officeId={officeId} view={view} />

      {/* 다음 주 보기: 어느 주의 일을 보는 건지 날짜로 분명히 알려 준다 (보고 주차 + 1주) */}
      {view === "next" && (
        <p role="note" className="rounded-md bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:bg-blue-950 dark:text-blue-200">
          <strong>{formatWeekRange(addWeeks(weekStart, 1))} 주</strong>에 할 작업 예정입니다.{" "}
          {formatWeekRange(weekStart)} 주 보고에 적은 &quot;다음 주 예정 작업&quot;을 모아 보여 줍니다.
        </p>
      )}

      {/* 지금 보고 있는 주차를 엑셀로 받는다. 파일 내려받기라서 화면 이동용 링크(Link)가 아닌 일반 링크를 쓴다 */}
      <div>
        <a
          href={`/api/export?week=${weekStart}`}
          download
          className="inline-flex items-center gap-2 rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
        >
          ⬇ 엑셀 내려받기
        </a>
        <span className="ml-3 text-xs text-zinc-500">
          {weekHeading(weekStart, currentWeekStart).replace(/ \(이번 주\)$/, "")} 현황 · 작업 1건당 1행
        </span>
        {/* 접속 코드 변경 화면 (작업 14, 부서용 코드만) */}
        <Link
          href="/admin/codes"
          className="float-right rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          코드 변경
        </Link>
      </div>

      {weekStart !== currentWeekStart && (
        <p
          role="note"
          className="rounded-md border border-blue-300 bg-blue-50 px-4 py-3 text-sm text-blue-900 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
        >
          지난 주차의 보고를 보고 있습니다. 상태와 금액은 그 주에 마지막으로 제출한 내용 기준입니다.
        </p>
      )}

      {rows === null ? (
        <p
          role="alert"
          className="rounded-md border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
        >
          현황을 불러오지 못했습니다. 잠시 후 화면을 새로고침해 주세요.
        </p>
      ) : (
        <StatusList
          rows={rows}
          officeId={officeId}
          view={view}
          showAllHref={dashboardHref(weekStart, currentWeekStart, null, view)}
        />
      )}
    </main>
  );
}

function StatusList({
  rows,
  officeId,
  view,
  showAllHref,
}: {
  rows: OfficeStatusRow[];
  /** 보기 방식 */
  view: DashboardView;
  /** 고른 청사 (전체면 null) */
  officeId: number | null;
  /** "전체 보기" 주소 (주차는 유지) */
  showAllHref: string;
}) {
  // 위쪽 상태 수는 항상 13곳 기준이다. 청사를 고르면 표에는 그 청사만 펼쳐서 보여 준다.
  const counts = countStatuses(rows);
  const shown = officeId === null ? rows : rows.filter((r) => r.officeId === officeId);
  // 알림: 제출 기한이 지났는데 아직 내지 않은 사업장 (화면 안 알림, 발송 아님). 어떤 보기·청사 선택에서도 13곳 기준으로 알린다
  const overdueRows = rows.filter((r) => r.status === "overdue");

  return (
    <>
      {overdueRows.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-red-400 bg-red-50 px-4 py-4 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-200"
        >
          <p className="text-base font-bold">⏰ 제출지연 {overdueRows.length}곳</p>
          <p className="mt-1">
            제출 기한({DEADLINE_LABEL})이 지났는데 아직 제출하지 않았습니다:{" "}
            <strong>{overdueRows.map((r) => r.officeName).join(", ")}</strong>
          </p>
        </div>
      )}

      <p role="status" className="text-sm font-medium">
        {/* 마감 뒤에 낸 보고도 제출 완료에 함께 센다 */}
        {STATUS_LABEL.submitted} {counts.submitted + counts.late} · {STATUS_LABEL.missing} {counts.missing} ·{" "}
        {STATUS_LABEL.overdue} {counts.overdue}{" "}
        <span className="font-normal text-zinc-500">(총 {OFFICE_COUNT}곳)</span>
      </p>

      <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
        {/* 칸 이름 (좁은 화면에서는 각 줄 안에 이름이 들어 있어 숨긴다) */}
        <div
          aria-hidden="true"
          className={`${ROW_GRID} hidden bg-zinc-50 px-4 py-2 text-xs font-semibold text-zinc-600 sm:grid dark:bg-zinc-900 dark:text-zinc-400`}
        >
          <span>사업장</span>
          <span>상태</span>
          <span className="text-right">{view === "next" ? "다음 주 예정 작업" : "이번 주 금액 합계"}</span>
          <span>마지막 제출</span>
        </div>

        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {shown.map((row) => (
            <li key={row.officeId}>
              <OfficeStatusItem row={row} view={view} defaultOpen={officeId !== null || view === "next"} />
            </li>
          ))}
        </ul>

        {officeId !== null ? (
          <p className="border-t border-zinc-200 px-4 py-3 text-sm dark:border-zinc-800">
            <Link href={showAllHref} className="font-medium text-brand underline dark:text-sky-300">
              13곳 전체 보기
            </Link>
          </p>
        ) : view === "next" ? null : (
          <div
            className={`${ROW_GRID} border-t-2 border-zinc-300 bg-zinc-50 px-4 py-3 text-sm font-bold dark:border-zinc-700 dark:bg-zinc-900`}
          >
            <span className="col-span-2 sm:col-span-2">이번 주 금액 총합계</span>
            <span className="tabular-nums sm:text-right">{formatWon(sumThisWeek(rows))}</span>
            <span className="text-xs font-normal text-zinc-500">다음 주 금액 제외</span>
          </div>
        )}
      </div>
    </>
  );
}

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-zinc-500">불러오는 중...</p>}>
      <DashboardScreen searchParams={searchParams} />
    </Suspense>
  );
}
