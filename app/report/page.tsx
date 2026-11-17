// Design Ref: §1-2 보고 입력 화면 `/report` (관리소장)
// Plan SC: 작업 2 "보고 입력 화면 틀 — 두 구역과 개인정보 안내 문구"
//          설계 점검(16) 보완: 이미 낸 이번 주 보고를 불러와 고칠 수 있게 하고, 상단에 현재 상태를 표시한다.
//          (DESIGN §5 의 "GET /api/report" 대신 서버 화면이 직접 읽는다 — 현황판과 같은 방식)
//
// 이 화면은 "지금 시각"으로 이번 주를 계산한다. Cache Components 가 켜져 있어서
// 현재 시각을 읽기 전에 connection() 으로 "요청 때 계산"하도록 알려야 한다. (Next 문서: 08-caching.md)

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import LogoutButton from "@/components/LogoutButton";
import { PageBand, PageShell } from "@/components/PageShell";
import ReportForm, { type CarryOver } from "@/components/ReportForm";
import StatusBadge from "@/components/StatusBadge";
import { formatAmountInput } from "@/lib/amount";
import { fetchOfficeStatus } from "@/lib/dashboard";
import { getOfficeById } from "@/lib/offices";
import type { SavedReport } from "@/lib/report-api";
import { getSessionOfficeId } from "@/lib/session";
import type { OfficeStatusRow, TaskView } from "@/lib/status";
import {
  addWeeks,
  DEADLINE_LABEL,
  DEADLINE_LABEL_LONG,
  getNextWeekStart,
  getWeekEnd,
  getWeekStart,
} from "@/lib/week";

export const metadata: Metadata = {
  title: "주간 보고 입력 | 사업장별 주간 공사·작업 현황",
};

/** 저장된 작업 → 입력 칸 모양 (금액은 "1,500,000", 미정이면 빈칸) */
const toInput = (t: TaskView) => ({
  title: t.title,
  content: t.content,
  amount: t.amount === null ? "" : formatAmountInput(String(t.amount)),
});

/** 현황 줄 → 폼에 넘길 "이미 낸 보고". 미제출이면 null */
function toSavedReport(row: OfficeStatusRow): SavedReport | null {
  if (row.status === "missing" || row.status === "overdue" || row.submittedAt === null) return null;
  return {
    isLate: row.status === "late",
    submittedAt: Date.parse(row.submittedAt),
    this: { none: row.thisNone, tasks: row.thisTasks.map(toInput) },
    next: { none: row.nextNone, tasks: row.nextTasks.map(toInput) },
  };
}

/** 구역 제목 옆 짧은 날짜: "11.16(월) ~ 11.22(일)" (휴대폰에서도 한 줄) */
function shortRange(weekStart: string): string {
  const md = (ymd: string) => ymd.slice(5).replace("-", ".");
  return `${md(weekStart)}(월) ~ ${md(getWeekEnd(weekStart))}(일)`;
}

const submittedAtFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

async function ReportScreen() {
  await connection(); // 요청 때마다 현재 주차를 계산한다

  // 내 청사는 접속 코드가 정한다 (쿠키에서만 읽음). 사업장 코드로 입장한 사람이 아니면 입장 화면으로 보낸다.
  // (부서용 코드로 들어온 사람은 입장 화면이 현황판으로 다시 보내 준다)
  const office = getOfficeById((await getSessionOfficeId()) ?? 0);
  if (!office) redirect("/");

  const now = new Date();
  const thisWeek = getWeekStart(now);
  const nextWeek = getNextWeekStart(thisWeek);

  // 이미 낸 이번 주 보고를 읽는다. 읽지 못하면 빈 폼으로 열되, 덮어쓰기 위험을 알린다
  let status: OfficeStatusRow | null = null;
  try {
    status = await fetchOfficeStatus(office.id, thisWeek);
  } catch {
    status = null; // 원인은 서버 로그에 남았다
  }
  const saved = status ? toSavedReport(status) : null;

  // 이번 주 보고를 아직 내지 않았으면, 지난주 보고에 적은 "다음 주 예정 작업"을 이번 주 작업 내용으로 불러온다.
  // (불러오기만 한다. 사업장이 확인하고 [제출하기]를 눌러야 저장된다. 읽지 못하면 그냥 빈 화면으로 연다)
  let carryOver: CarryOver | null = null;
  if (status && saved === null) {
    const lastWeek = addWeeks(thisWeek, -1);
    try {
      const prev = await fetchOfficeStatus(office.id, lastWeek);
      if (prev.submittedAt !== null && !prev.nextNone && prev.nextTasks.length > 0) {
        carryOver = {
          fromLabel: `${lastWeek.slice(5)} ~ ${getWeekEnd(lastWeek).slice(5)}`,
          tasks: prev.nextTasks.map(toInput),
        };
      }
    } catch {
      carryOver = null; // 원인은 서버 로그에 남았다
    }
  }

  return (
    // 2026-11-18 디자인 4차: 다른 화면과 같은 틀(회색 바탕 + 둥근 남색 머리띠 + 흰 판).
    // 마감·상태·개인정보 안내를 머리띠 안에 한 번씩만 모았다 (예전엔 위아래로 마감 안내가 두 번, 안내 상자가 두 개였다)
    <PageShell>
      <PageBand title={`${office.name} 주간 보고`} right={<LogoutButton onDark />}>
        <p className="mt-1.5 text-sm text-sky-200">제출 마감 매주 {DEADLINE_LABEL_LONG}</p>
        {/* 현재 상태 (DESIGN §1-2 "상단에 현재 상태를 표시") */}
        {status && (
          <p className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <StatusBadge status={status.status} />
            {status.submittedAt && (
              <span className="text-xs text-sky-200">{submittedAtFormat.format(new Date(status.submittedAt))} 제출</span>
            )}
          </p>
        )}
        <p role="note" className="mt-3 border-t border-white/15 pt-2.5 text-xs text-sky-100">
          ⚠ 작업 내용에 개인 이름·연락처를 적지 마세요.
        </p>
      </PageBand>

      {/* 알림: 제출 기한이 지났는데 아직 이번 주 보고를 내지 않았으면 눈에 띄게 알려 준다 (화면 안 알림, 발송 아님) */}
      {status?.status === "overdue" && (
        <div role="alert" className="rounded-xl bg-orange-100 px-4 py-3 text-sm text-orange-900">
          <p className="font-bold">⏰ 제출 기한({DEADLINE_LABEL})이 지났습니다</p>
          <p className="mt-0.5">아래 내용을 작성해 지금 제출해 주세요.</p>
        </div>
      )}

      {status === null && (
        <p role="alert" className="rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          이미 낸 보고를 불러오지 못했습니다. 이번 주에 이미 제출했다면 지금 제출할 때 기존 보고가 통째로
          바뀝니다. 화면을 새로고침한 뒤 다시 확인해 주세요.
        </p>
      )}

      <ReportForm
        saved={saved}
        carryOver={carryOver}
        officeId={office.id}
        weekStart={thisWeek}
        thisWeekDescription={shortRange(thisWeek)}
        nextWeekDescription={shortRange(nextWeek)}
      />
    </PageShell>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-zinc-500">불러오는 중...</p>}>
      <ReportScreen />
    </Suspense>
  );
}
