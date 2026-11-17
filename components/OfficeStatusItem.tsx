// Design Ref: §1-3 현황판 — 사업장 한 곳 = 카드 하나
// Plan SC: 작업 10 "사업장마다 작업별 금액과 합계"
// 2026-11-17 디자인 변경 (2차):
//  - 카드 왼쪽에 상태 색 띠(제출 완료 초록 / 미제출 회색 / 제출지연 주황)를 붙여, 13곳을 훑을 때 색만으로 안 낸 곳이 보이게 했다.
//  - 구역 머리에 "작업 N건 · 합계"를 한 줄로 먼저 보여 주고, 그 아래 작업 목록을 둔다.
//  - 사업장 이름·합계·작업명은 크고 진하게, 일시·장소·내용 설명은 작은 회색으로 줄였다.
//  - 이번 주·지난 주 화면은 "이번 주 작업 내용"만, 다음 주 화면은 "다음 주 예정 작업"만 보여 준다.
// 접기·펼치기는 브라우저 기본 <details> 를 쓴다 (자바스크립트 없이 동작하고 키보드로도 열린다).

import StatusBadge from "./StatusBadge";
import { formatWon } from "@/lib/amount";
import type { OfficeStatusRow, SubmissionStatus, TaskView } from "@/lib/status";

/** 카드 왼쪽 상태 색 띠 */
const STRIPE: Record<SubmissionStatus, string> = {
  submitted: "border-l-green-500",
  late: "border-l-green-500", // 마감 뒤에 낸 보고도 "제출 완료"
  missing: "border-l-zinc-300",
  overdue: "border-l-orange-500",
};

function TaskList({ tasks }: { tasks: TaskView[] }) {
  return (
    <ol className="divide-y divide-zinc-100">
      {tasks.map((t, i) => (
        <li key={i} className="py-2.5 first:pt-0 last:pb-0">
          <p className="flex items-baseline justify-between gap-3">
            <span className="min-w-0 break-words text-[15px] font-semibold text-zinc-900 sm:text-base">
              {i + 1}. {t.title}
            </span>
            <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-zinc-900 sm:text-base">
              {formatWon(t.amount)}
            </span>
          </p>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-500 sm:text-sm">
            {t.content}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** 구역 하나 (이번 주 작업 내용 / 다음 주 예정 작업): 머리 줄에 "작업 N건 · 합계", 아래에 목록 */
function Section({
  label,
  accent,
  tasks,
  none,
  total,
  totalNote,
  ariaLabel,
}: {
  label: string;
  /** 제목 앞 점 색 (이번 주: 남색, 다음 주: 주황) */
  accent: "brand" | "orange";
  tasks: TaskView[];
  none: boolean;
  /** 합계 문구 (예: "13,775,000원", "미정") */
  total: string;
  /** 합계 아래 덧붙임 (예: "금액 미정 1건 제외") */
  totalNote?: string;
  ariaLabel: string;
}) {
  const empty = none || tasks.length === 0;
  return (
    <section aria-label={ariaLabel}>
      <h3 className="flex items-baseline justify-between gap-3 border-b border-zinc-100 pb-2">
        <span className="flex items-center gap-1.5 text-sm font-medium text-zinc-600">
          <span aria-hidden="true" className={`h-2 w-2 rounded-full ${accent === "brand" ? "bg-brand" : "bg-orange-500"}`} />
          {label}
          {!empty && <span className="text-zinc-400">· {tasks.length}건</span>}
        </span>
        {/* "작업 없음"이면 아래에 이미 "작업 없음"이 나오므로 합계는 감춘다 (중복 방지) */}
        {!empty && (
          <span className="text-right">
            <span className="block whitespace-nowrap text-base font-bold tabular-nums text-brand sm:text-lg">
              합계 {total}
            </span>
            {totalNote && <span className="block text-xs text-zinc-500">{totalNote}</span>}
          </span>
        )}
      </h3>
      <div className="pt-2.5">{empty ? <p className="text-sm text-zinc-500">작업 없음</p> : <TaskList tasks={tasks} />}</div>
    </section>
  );
}

/**
 * defaultOpen: 처음부터 펼쳐 둘지
 * view: "next" 는 다음 주 예정 작업만, "this" 는 이번 주 작업 내용(금액 합계 포함)만 보여 준다
 */
export default function OfficeStatusItem({
  row,
  defaultOpen = false,
  view,
}: {
  row: OfficeStatusRow;
  defaultOpen?: boolean;
  view: "this" | "next";
}) {
  const notSubmitted = row.status === "missing" || row.status === "overdue";
  const cardClass = `rounded-xl border border-zinc-200 border-l-4 bg-white shadow-sm ${STRIPE[row.status]}`;

  // 다음 주 예정 작업 합계: 금액이 "미정"인 작업은 빼고 더한다 (이번 주 합계와는 섞지 않고 따로 보여 준다)
  const nextUndecided = row.nextTasks.filter((t) => t.amount === null).length;
  const nextSum = row.nextTasks.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const nextAllUndecided = row.nextTasks.length > 0 && nextUndecided === row.nextTasks.length;

  // 카드 머리줄: 왼쪽에 사업장 이름, 오른쪽 끝에 상태 배지만 둔다 (제출 시각은 보여 주지 않는다 — 2026-11-17 요청).
  // 합계는 아래 구역 머리에 한 번만 보여 준다(중복 방지)
  const header = (
    <div className="flex items-center justify-between gap-3">
      <span className="min-w-0 text-lg font-bold text-zinc-900">{row.officeName}</span>
      <StatusBadge status={row.status} />
    </div>
  );

  // 아직 내지 않은 사업장은 펼칠 내용이 없어 한 줄 카드로 보여 준다
  if (notSubmitted) {
    return <div className={`${cardClass} px-4 py-3 sm:px-5 ${row.status === "overdue" ? "bg-orange-50/60" : ""}`}>{header}</div>;
  }

  return (
    <details className={`group ${cardClass}`} open={defaultOpen}>
      <summary className="cursor-pointer list-none px-4 pt-3 pb-2 sm:px-5 sm:pt-4 [&::-webkit-details-marker]:hidden">
        {header}
        <span className="mt-0.5 block text-xs text-zinc-400">
          <span className="group-open:hidden">▶ 펼치기</span>
          <span className="hidden group-open:inline">▼ 접기</span>
        </span>
      </summary>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        {view === "this" ? (
          <Section
            label="이번 주 작업 내용"
            accent="brand"
            ariaLabel={`${row.officeName} 이번 주 작업 내용`}
            tasks={row.thisTasks}
            none={row.thisNone}
            total={formatWon(row.thisTotal ?? 0)}
          />
        ) : (
          <Section
            label="다음 주 예정 작업"
            accent="orange"
            ariaLabel={`${row.officeName} 다음 주 예정 작업`}
            tasks={row.nextTasks}
            none={row.nextNone}
            // 모든 작업의 금액이 미정이면 합계도 미정 (0원으로 보이지 않게)
            total={nextAllUndecided ? "미정" : formatWon(nextSum)}
            // 일부만 미정이면 정해진 금액만 더하고, 몇 건이 빠졌는지 알려 준다
            totalNote={nextUndecided > 0 && !nextAllUndecided ? `금액 미정 ${nextUndecided}건 제외` : undefined}
          />
        )}
      </div>
    </details>
  );
}
