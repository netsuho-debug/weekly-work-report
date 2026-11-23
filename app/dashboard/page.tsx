// Design Ref: §1-3 현황판 `/dashboard` (서무직원·담당자)
// Plan SC: 작업 9 "13곳을 모두 보여 주고 제출 / 지각 제출 / 미제출 상태 표시"
//          작업 10 "사업장마다 작업별 금액과 합계 (다음 주 금액은 이번 주 합계와 섞지 않음)"
//          작업 11 주차 선택(?week=), 작업 12 엑셀, 작업 14 [코드 변경]
//          설계 점검(16) 보완: 사업장 선택(?office=N) — 고른 사업장만 보여 준다 (DESIGN §1-3)
//
// 2026-11-17 디자인 3차 (덜어내기): "숫자 3개 + 예외 1줄 + 목록"
//  - 남색 머리띠 하나에 제목·주차 이동(◀ ▶)·핵심 숫자 3개(제출·작업·금액)와 보조 버튼을 모은다.
//  - 색은 남색(머리띠)·검정/회색(글자)·주황(예외) 세 가지만 쓴다. 초록은 쓰지 않는다.
//  - 안 낸 곳이 있을 때만 머리띠 아래에 한 줄로 알린다. 다 냈으면 아무것도 나오지 않는다.
//  - 사업장은 흰 판 하나에 목록으로: 13곳 전부를 원래 순서(가나다순)대로 한 줄씩.
//  - 화면 금액은 만 원 단위로 줄여 보여 준다(엑셀은 원 단위 그대로).
//
// 보고 입력 화면과 같은 이유로, 현재 시각·DB 를 읽기 전에 connection() 으로 "요청 때마다 계산"하게 한다.
// (Cache Components 가 켜져 있다 — Next 문서: 08-caching.md)

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import LogoutButton from "@/components/LogoutButton";
import { BAND_BUTTON, PageBand, PageShell, PANEL } from "@/components/PageShell";
import OfficePicker from "@/components/OfficePicker";
import OfficeStatusItem, { rowTasks } from "@/components/OfficeStatusItem";
import WeekPicker, { type DashboardView } from "@/components/WeekPicker";
import { formatManwon, formatWon } from "@/lib/amount";
import { fetchStatusRows } from "@/lib/dashboard";
import { getOfficeById, OFFICE_COUNT } from "@/lib/offices";
import { isDeptSession } from "@/lib/session";
import type { OfficeStatusRow, TaskView } from "@/lib/status";
import { addWeeks, DEADLINE_LABEL, getWeekStart, resolveWeekParam } from "@/lib/week";

export const metadata: Metadata = {
  title: "청사별 주간 작업 현황 | 청사별 주간 공사·작업 현황",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** 주소의 ?office= 값 → 사업장 번호. 비었거나 없는 번호면 null(전체) */
function resolveOfficeParam(param: string | string[] | undefined): number | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || !/^\d{1,2}$/.test(value)) return null;
  return getOfficeById(Number(value))?.id ?? null;
}

const isPending = (r: OfficeStatusRow) => r.status === "missing" || r.status === "overdue";

/** 머리띠 안 핵심 숫자 하나. parts 가 여럿이면 " / "로 잇는다 (예: 9곳 / 16건) */
function Kpi({
  label,
  parts,
  note,
  title,
}: {
  label: string;
  parts: { value: string; unit?: string }[];
  note?: string;
  title?: string;
}) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-sky-200 sm:text-sm">{label}</p>
      <p className="mt-0.5 whitespace-nowrap tabular-nums" title={title}>
        {parts.map((p, i) => (
          <span key={i}>
            {i > 0 && <span className="mx-1 text-sm text-sky-200/70 sm:text-base">/</span>}
            <span className="text-xl font-bold sm:text-3xl">{p.value}</span>
            {p.unit && <span className="ml-0.5 text-xs text-sky-200 sm:text-sm">{p.unit}</span>}
          </span>
        ))}
      </p>
      {note && <p className="text-[11px] text-sky-200/90 sm:text-xs">{note}</p>}
    </div>
  );
}

/** "7,541만원" → 숫자 "7,541" + 단위 "만원" (원·미정도 처리) */
function splitAmount(text: string): { value: string; unit?: string } {
  const m = text.match(/^([\d,]+)(만원|원)$/);
  return m ? { value: m[1], unit: m[2] } : { value: text };
}

async function DashboardScreen({ searchParams }: { searchParams: SearchParams }) {
  await connection(); // 요청 때마다 이번 주와 최신 제출 현황을 계산한다

  // 부서용 코드로 입장한 사람만 볼 수 있다. 아니면 입장 화면으로 보낸다.
  // (사업장 코드로 들어온 사람은 입장 화면이 자기 보고 입력 화면으로 다시 보내 준다)
  if (!(await isDeptSession())) redirect("/");

  // 주소의 ?week= 로 지난 주차를 고른다. 틀리거나 너무 먼 미래 값이면 이번 주로 돌린다 (resolveWeekParam)
  const now = new Date();
  const currentWeekStart = getWeekStart(now);
  const params = await searchParams;
  const weekStart = resolveWeekParam(params.week, now);
  const officeId = resolveOfficeParam(params.office);
  // 다음 주(아직 오지 않은 주)를 고르면, 그 주의 일은 "이번 주 보고에 적은 다음 주 예정 작업"이다.
  // 그래서 이번 주 보고를 읽어 예정 작업만 보여 준다. (보고 주차 = 고른 주차 - 1주)
  const isNextWeek = weekStart > currentWeekStart;
  const sourceWeek = isNextWeek ? currentWeekStart : weekStart;
  // 보기는 주차로 정해진다: 다음 주면 예정 작업만, 그 밖에는 그 주의 작업 내용만
  const view: DashboardView = isNextWeek ? "next" : "this";
  let rows: OfficeStatusRow[] | null = null;
  try {
    rows = await fetchStatusRows(sourceWeek);
  } catch {
    rows = null; // 원인은 서버 로그에 남았다. 화면에는 쉬운 말로만 알린다
  }

  // 이번 주 화면에서 아직 이번 주 보고를 안 낸 청사는 비어 보이므로, 지난주 보고에 적은 "다음 주 예정 작업"을 참고용으로 보여 준다.
  // (합계·핵심 숫자·엑셀에는 넣지 않는다. 읽지 못하면 그냥 비워 둔다)
  const plans = new Map<number, TaskView[]>();
  if (rows !== null && view === "this" && weekStart === currentWeekStart) {
    try {
      for (const prev of await fetchStatusRows(addWeeks(weekStart, -1))) {
        if (prev.submittedAt !== null && !prev.nextNone && prev.nextTasks.length > 0) plans.set(prev.officeId, prev.nextTasks);
      }
    } catch {
      plans.clear(); // 원인은 서버 로그에 남았다
    }
  }

  // 핵심 숫자 3개 (항상 13곳 기준)
  const all = rows ?? [];
  const submittedCount = all.filter((r) => !isPending(r)).length; // 마감 뒤에 낸 보고도 제출로 센다
  const totals = all.map((r) => rowTasks(r, view));
  const taskCount = totals.reduce((n, t) => n + (t.none ? 0 : t.tasks.length), 0);
  const workOfficeCount = totals.filter((t) => !t.none).length; // 작업이 있는 사업장 수
  const amountSum = totals.reduce((s, t) => s + (t.none ? 0 : t.sum), 0);
  const undecided = totals.reduce((n, t) => n + (t.none ? 0 : t.undecided), 0);
  const allUndecided = taskCount > 0 && undecided === taskCount;
  const amount = splitAmount(allUndecided ? "미정" : formatManwon(amountSum));

  return (
    <PageShell width="lg">
        {/* 남색 머리띠: 제목·보조 버튼 / 주차 이동 / 핵심 숫자 3개 (공통 틀 PageBand) */}
        <PageBand title="청사별 주간 작업 현황" right={<LogoutButton onDark />}>
          <div className="mt-2 -ml-2">
            <WeekPicker weekStart={weekStart} currentWeekStart={currentWeekStart} officeId={officeId} />
          </div>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-xs text-sky-200">
              {isNextWeek
                ? "다음 주 · 이번 주 보고 기준"
                : weekStart < currentWeekStart
                  ? "그 주 마지막 제출 기준"
                  : `제출 마감 매주 ${DEADLINE_LABEL}`}
            </p>
            <div className="flex shrink-0 items-center gap-1.5">
              {/* 보고 주차를 엑셀로 받는다 (다음 주 화면이면 그 예정 작업이 들어 있는 이번 주 보고).
                  파일 내려받기라서 화면 이동용 링크(Link)가 아닌 일반 링크를 쓴다 */}
              <a
                href={`/api/export?week=${sourceWeek}`}
                download
                className="whitespace-nowrap rounded-md bg-white px-2.5 py-1 text-xs font-semibold text-brand-dark hover:bg-sky-50"
              >
                엑셀
              </a>
              {/* 접속 코드 변경 화면 (작업 14, 부서용 코드만) */}
              <Link href="/admin/codes" className={BAND_BUTTON}>
                코드 변경
              </Link>
            </div>
          </div>

          {rows !== null && (
            <div role="status" className="mt-4 grid grid-cols-3 gap-3 border-t border-white/15 pt-3.5">
              <Kpi label="제출" parts={[{ value: String(submittedCount), unit: `/ ${OFFICE_COUNT}` }]} />
              <Kpi
                label={isNextWeek ? "예정 작업" : "작업"}
                parts={[
                  { value: String(workOfficeCount), unit: "곳" },
                  { value: String(taskCount), unit: "건" },
                ]}
              />
              <Kpi
                label={isNextWeek ? "예정 금액" : "금액"}
                parts={[amount]}
                title={allUndecided ? undefined : formatWon(amountSum)}
                note={undecided > 0 && !allUndecided ? `미정 ${undecided}건 제외` : undefined}
              />
            </div>
          )}
        </PageBand>

        {rows === null ? (
          <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
            현황을 불러오지 못했습니다. 잠시 후 화면을 새로고침해 주세요.
          </p>
        ) : (
          <SiteList rows={rows} officeId={officeId} view={view} weekStart={weekStart} currentWeekStart={currentWeekStart} plans={plans} />
        )}
    </PageShell>
  );
}

function SiteList({
  rows,
  officeId,
  view,
  weekStart,
  currentWeekStart,
  plans,
}: {
  /** 지난주에 적은 다음 주 예정 작업 (청사 번호별, 이번 주 미제출 청사에만 보여 줌) */
  plans: Map<number, TaskView[]>;
  rows: OfficeStatusRow[];
  /** 고른 사업장 (전체면 null) */
  officeId: number | null;
  view: DashboardView;
  weekStart: string;
  currentWeekStart: string;
}) {
  // 예외 한 줄: 아직 안 낸 곳 ("미제출"(마감 전)과 "제출지연"(마감 뒤)은 동시에 생기지 않는다)
  const pendingRows = rows.filter(isPending);
  const isOverdue = pendingRows.some((r) => r.status === "overdue");

  // 목록: 13곳 전부를 원래 순서(가나다순 1~13번)대로 한 줄씩 보여 준다. 작업 없는 곳도 자기 줄에 "작업 없음"으로 (2026-11-18 요청)
  const listed = officeId === null ? rows : rows.filter((r) => r.officeId === officeId);

  return (
    <>
      {pendingRows.length > 0 && (
        <p
          role={isOverdue ? "alert" : "status"}
          className={`rounded-lg px-4 py-2.5 text-sm ${
            isOverdue ? "bg-orange-100 font-medium text-orange-900" : "bg-white text-zinc-600"
          }`}
        >
          {isOverdue ? `⏰ 제출지연 ${pendingRows.length}곳 (기한 ${DEADLINE_LABEL} 지남)` : `아직 안 낸 곳 ${pendingRows.length}곳`}
          {" · "}
          {pendingRows.map((r) => r.officeName).join(", ")}
        </p>
      )}

      <section aria-label="사업장 목록" className={`${PANEL} px-4 sm:px-6`}>
        {/* 사업장 고르기만 둔다 ("사업장 13곳" 글자는 머리띠의 "제출 13/13"과 겹쳐서 없앴다 — 디자인 4차) */}
        <div className="border-b border-zinc-100 py-3">
          <OfficePicker week={weekStart === currentWeekStart ? null : weekStart} officeId={officeId} />
        </div>
        <ul className="divide-y divide-zinc-100">
          {listed.map((row) => (
            <OfficeStatusItem key={row.officeId} row={row} view={view} plan={plans.get(row.officeId)} />
          ))}
        </ul>
      </section>
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
