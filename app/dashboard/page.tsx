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
import OfficeStatusItem from "@/components/OfficeStatusItem";
import { formatWon } from "@/lib/amount";
import { fetchStatusRows } from "@/lib/dashboard";
import { getOfficeById, OFFICE_COUNT } from "@/lib/offices";
import { isDeptSession } from "@/lib/session";
import {
  countStatuses,
  sumThisWeek,
  type OfficeStatusRow,
} from "@/lib/status";
import { DEADLINE_LABEL, getWeekStart, resolveWeekParam } from "@/lib/week";
import WeekPicker, { dashboardHref, weekHeading, WeekSelect, type DashboardView } from "@/components/WeekPicker";

export const metadata: Metadata = {
  title: "사업장별 주간 작업 현황 | 사업장별 주간 공사·작업 현황",
};

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

/** 주소의 ?office= 값 → 청사 번호. 비었거나 없는 번호면 null(전체) */
function resolveOfficeParam(param: string | string[] | undefined): number | null {
  const value = Array.isArray(param) ? param[0] : param;
  if (!value || !/^\d{1,2}$/.test(value)) return null;
  return getOfficeById(Number(value))?.id ?? null;
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
  // 다음 주(아직 오지 않은 주)를 고르면, 그 주의 일은 "이번 주 보고에 적은 다음 주 예정 작업"이다.
  // 그래서 이번 주 보고를 읽어 예정 작업만 보여 준다. (보고 주차 = 고른 주차 - 1주)
  const isNextWeek = weekStart > currentWeekStart;
  const sourceWeek = isNextWeek ? currentWeekStart : weekStart;
  // 보기는 주차로 정해진다: 다음 주면 예정 작업만, 그 밖에는 그 주의 작업 내용만
  // (예전의 [이번 주 작업 내용]/[다음 주 예정 작업] 전환 탭은 "다음 주 ▶" 버튼과 겹쳐서 없앴다)
  const view: DashboardView = isNextWeek ? "next" : "this";
  let rows: OfficeStatusRow[] | null = null;
  try {
    rows = await fetchStatusRows(sourceWeek);
  } catch {
    rows = null; // 원인은 서버 로그에 남았다. 화면에는 쉬운 말로만 알린다
  }

  return (
    // 2026-11-17 디자인 변경 (2차): 연한 회색 바탕 위에 흰 카드를 올려 경계를 또렷하게 하고,
    // 맨 위에는 입장 화면과 같은 남색 머리띠를 두어 "어느 주 화면인지"가 첫눈에 들어오게 했다.
    <div className="flex-1 bg-zinc-100">
    <main className="mx-auto w-full max-w-5xl space-y-4 px-4 py-6 sm:space-y-5 sm:py-8">
      {/* 남색 머리띠: 제목·주차·마감과 보조 버튼(엑셀·코드 변경·나가기)을 한곳에 모은다 */}
      <header className="space-y-1 rounded-2xl bg-brand-dark px-4 py-4 text-white sm:px-6 sm:py-5">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold sm:text-3xl">사업장별 주간 작업 현황</h1>
          <LogoutButton onDark />
        </div>
        <p className="text-sm font-semibold tracking-tight text-sky-200 sm:text-lg sm:tracking-normal">{weekHeading(weekStart, currentWeekStart)}</p>
        {/* 지난 주·다음 주는 무엇을 기준으로 보여 주는지 한 줄로 알려 준다 (예전 파란 안내 상자를 대신함) */}
        {weekStart !== currentWeekStart && (
          <p className="text-xs text-sky-100/90 sm:text-sm">
            {isNextWeek ? "이번 주 보고에 적은 다음 주 예정 작업 기준입니다." : "그 주에 마지막으로 제출한 내용 기준입니다."}
          </p>
        )}
        <div className="flex items-center justify-between gap-3 pt-1.5">
          <p className="text-xs text-sky-100/90 sm:text-sm">⏱ 제출 마감 매주 {DEADLINE_LABEL}</p>
          <div className="flex shrink-0 items-center gap-1.5">
            {/* 보고 주차를 엑셀로 받는다 (다음 주 화면이면 그 예정 작업이 들어 있는 이번 주 보고).
                파일 내려받기라서 화면 이동용 링크(Link)가 아닌 일반 링크를 쓴다 */}
            <a
              href={`/api/export?week=${sourceWeek}`}
              download
              className="whitespace-nowrap rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-brand-dark hover:bg-sky-50"
            >
              ⬇ 엑셀
            </a>
            {/* 접속 코드 변경 화면 (작업 14, 부서용 코드만) */}
            <Link
              href="/admin/codes"
              className="whitespace-nowrap rounded-md border border-white/40 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/10"
            >
              코드 변경
            </Link>
          </div>
        </div>
      </header>

      {/* 조작 도구 모음 (2026-11-17 단순화): 칸마다 폭을 꽉 채워 휴대폰에서도 빈 곳이 없게 했다.
          휴대폰: [이전 주|이번 주|다음 주] / [주차 목록|사업장 목록] 두 줄, 넓은 화면(lg): 한 줄.
          목록은 고르면 바로 이동해 [보기] 버튼이 필요 없다. 엑셀·코드 변경은 위쪽 머리말로 옮겼다. */}
      <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
        <div className="lg:w-96 lg:shrink-0">
          <WeekPicker weekStart={weekStart} currentWeekStart={currentWeekStart} officeId={officeId} />
        </div>
        <div className="grid min-w-0 grid-cols-2 gap-2 lg:flex-1">
          <WeekSelect weekStart={weekStart} currentWeekStart={currentWeekStart} officeId={officeId} />
          <OfficePicker week={weekStart === currentWeekStart ? null : weekStart} officeId={officeId} />
        </div>
      </div>

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
    </div>
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
  // 위쪽 요약은 항상 13곳 기준이다. 사업장을 고르면 아래 목록에는 그 사업장만 보여 준다.
  const counts = countStatuses(rows);
  const shown = officeId === null ? rows : rows.filter((r) => r.officeId === officeId);
  const submittedCount = counts.submitted + counts.late; // 마감 뒤에 낸 보고도 제출 완료로 센다
  // 아직 내지 않은 사업장. "미제출"(마감 전)과 "제출지연"(마감 뒤)은 동시에 생기지 않으므로 하나로 묶어 이름을 보여 준다
  const pendingRows = rows.filter((r) => r.status === "missing" || r.status === "overdue");
  const isOverdue = pendingRows.some((r) => r.status === "overdue");
  // 이번 주 작업: 건수와 금액 합계
  const thisTasks = rows.flatMap((r) => (r.thisNone ? [] : r.thisTasks));
  const thisOfficeCount = rows.filter((r) => !r.thisNone && r.thisTasks.length > 0).length;
  // 다음 주 예정 작업: 건수와 금액 합계 (금액이 "미정"인 작업은 합계에서 빼고 따로 센다)
  // ※ 이번 주 합계와는 섞지 않고 따로 보여 준다 (PRD: 다음 주 금액은 이번 주 합계에 넣지 않음)
  const nextTasks = rows.flatMap((r) => (r.nextNone ? [] : r.nextTasks));
  const nextOfficeCount = rows.filter((r) => !r.nextNone && r.nextTasks.length > 0).length;
  const nextSum = nextTasks.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const nextUndecided = nextTasks.filter((t) => t.amount === null).length;

  return (
    <>
      {/* 한눈에 보는 요약 (2026-11-17 다시 설계)
          - 상태별 숫자 3개는 의미가 겹쳐서(미제출·제출지연은 동시에 안 생김) "제출 현황" 하나로 합치고,
            숫자보다 중요한 "아직 안 낸 사업장 이름"을 바로 보여 준다. 마감이 지났으면 주황색으로 알린다(화면 안 알림).
          - 이 앱의 목적인 "다음 주 예정 작업"을 별도 카드로 보여 준다. */}
      <div role="status" className="grid grid-cols-2 gap-2 sm:gap-3">
        <div
          role={isOverdue ? "alert" : undefined}
          className={`min-w-0 rounded-xl border px-2.5 py-3 shadow-sm sm:px-5 sm:py-4 ${
            isOverdue ? "border-orange-300 bg-orange-50" : "border-zinc-200 bg-white"
          }`}
        >
          <CardLabel icon="✓" tone={isOverdue ? "orange" : "green"}>
            제출 현황
          </CardLabel>
          <CardValue items={[{ value: String(submittedCount), unit: "곳" }, { value: String(OFFICE_COUNT), unit: "곳" }]} />
          {/* 진행 막대: 숫자를 읽지 않아도 얼마나 냈는지 보이게 한다 (다 내면 초록, 기한 지나 안 낸 곳이 있으면 주황) */}
          <div
            className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-200"
            role="progressbar"
            aria-label="제출 진행"
            aria-valuemin={0}
            aria-valuemax={OFFICE_COUNT}
            aria-valuenow={submittedCount}
          >
            <div
              className={`h-full rounded-full ${
                pendingRows.length === 0 ? "bg-green-600" : isOverdue ? "bg-orange-500" : "bg-brand"
              }`}
              style={{ width: `${Math.round((submittedCount / OFFICE_COUNT) * 100)}%` }}
            />
          </div>
          {pendingRows.length === 0 ? (
            <p className={`${CARD_NOTE} font-medium text-green-700 dark:text-green-400`}>모든 사업장이 제출했습니다</p>
          ) : (
            <p className={`${CARD_NOTE} ${isOverdue ? "text-orange-800 dark:text-orange-200" : "text-zinc-600 dark:text-zinc-400"}`}>
              <span className="font-semibold">
                {isOverdue ? `⏰ 제출지연 ${pendingRows.length}곳 (기한 ${DEADLINE_LABEL} 지남)` : `아직 안 낸 곳 ${pendingRows.length}곳`}
              </span>
              <br />
              {pendingRows.map((r) => r.officeName).join(", ")}
            </p>
          )}
        </div>

        {/* 이번 주(지난 주 포함) 화면은 그 주 작업만, 다음 주 화면은 다음 주 예정 작업만 보여 준다 */}
        {view === "this" ? (
          <SummaryCard
            label="이번 주 작업"
            amount={formatWon(sumThisWeek(rows))}
            count={thisTasks.length}
            note={`${thisOfficeCount}곳에서 작업`}
          />
        ) : (
          <SummaryCard
            label="다음 주 예정 작업"
            amount={nextTasks.length > 0 && nextUndecided === nextTasks.length ? "미정" : formatWon(nextSum)}
            count={nextTasks.length}
            note={`${nextOfficeCount}곳에서 예정${
              nextUndecided > 0 && nextUndecided < nextTasks.length ? ` · 금액 미정 ${nextUndecided}건은 금액에서 제외` : ""
            }`}
          />
        )}
      </div>

      {officeId !== null && (
        <p className="text-sm">
          <Link href={showAllHref} className="font-medium text-brand underline dark:text-sky-300">
            ← 13곳 전체 보기
          </Link>
        </p>
      )}

      {/* 사업장마다 카드 하나. 제출한 사업장은 어느 주차든 처음부터 펼쳐서 보여 준다 (클릭 없이 내용 확인) */}
      <ul className="space-y-3">
        {shown.map((row) => (
          <li key={row.officeId}>
            <OfficeStatusItem row={row} view={view} defaultOpen />
          </li>
        ))}
      </ul>
    </>
  );
}

// 요약 카드 두 장이 같은 비율로 보이도록 글자 단계를 셋으로 맞춘다 (2026-11-17)
//   제목(작은 회색 + 색 아이콘) → 숫자(크고 진하게, 단위는 작은 회색, 금액은 남색) → 설명(작은 회색, 상태일 때만 초록/주황)
const CARD_NOTE = "mt-1.5 text-xs leading-snug sm:text-sm";

const ICON_TONE = {
  green: "bg-green-100 text-green-700",
  orange: "bg-orange-100 text-orange-700",
  brand: "bg-sky-100 text-brand",
} as const;

/** 카드 제목: 작은 색 아이콘 + 회색 글씨 */
function CardLabel({ icon, tone, children }: { icon: string; tone: keyof typeof ICON_TONE; children: React.ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-xs font-medium text-zinc-500 sm:text-sm">
      <span
        aria-hidden="true"
        className={`inline-flex h-5 w-5 items-center justify-center rounded-md text-[11px] font-bold ${ICON_TONE[tone]}`}
      >
        {icon}
      </span>
      {children}
    </p>
  );
}

/** 숫자(크게) + 단위(작게) 한 묶음. accent 면 숫자를 남색으로 (금액) */
function NumUnit({ value, unit, accent = false }: { value: string; unit?: string; accent?: boolean }) {
  return (
    <span className="whitespace-nowrap">
      {/* 휴대폰 반쪽 칸에도 "16건 / 75,406,500원"이 한 줄로 들어가도록 단계적으로 키운다 */}
      <span className={`text-base font-bold tracking-tight sm:text-2xl lg:text-3xl ${accent ? "text-brand" : "text-zinc-900"}`}>
        {value}
      </span>
      {unit && <span className="ml-0.5 text-xs font-medium text-zinc-500 sm:text-sm">{unit}</span>}
    </span>
  );
}

/** 카드의 큰 숫자 줄. 여러 값은 " / "로 잇는다 (예: 13 / 13곳, 16건 / 75,406,500원) */
function CardValue({ items }: { items: { value: string; unit?: string; accent?: boolean }[] }) {
  return (
    <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
      {items.map((item, i) => (
        <span key={i} className="flex items-baseline gap-x-1.5">
          {i > 0 && <span className="text-xs text-zinc-400 sm:text-base">/</span>}
          <NumUnit value={item.value} unit={item.unit} accent={item.accent} />
        </span>
      ))}
    </p>
  );
}

/** 위쪽 요약 카드 하나: 작업 건수와 금액을 한 줄에 같은 크기로 (예: 16건 / 75,406,500원) */
function SummaryCard({ label, amount, count, note }: { label: string; amount: string; count: number; note?: string }) {
  // "75,406,500원" → 숫자는 크게, "원"은 단위로 작게. "미정"은 단위 없이 그대로
  const hasWon = amount.endsWith("원");
  return (
    <div className="min-w-0 rounded-xl border border-zinc-200 bg-white px-2.5 py-3 shadow-sm sm:px-5 sm:py-4">
      <CardLabel icon="₩" tone="brand">
        {label}
      </CardLabel>
      <CardValue
        items={[
          { value: String(count), unit: "건" },
          { value: hasWon ? amount.slice(0, -1) : amount, unit: hasWon ? "원" : undefined, accent: true },
        ]}
      />
      {note && <p className={`${CARD_NOTE} text-zinc-600`}>{note}</p>}
    </div>
  );
}

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<p className="p-8 text-center text-zinc-500">불러오는 중...</p>}>
      <DashboardScreen searchParams={searchParams} />
    </Suspense>
  );
}
