// Design Ref: §1-3 현황판 — 사업장 한 곳 = 카드 하나
// Plan SC: 작업 10 "사업장마다 이번 주 작업별 금액과 합계 (다음 주 금액은 합계 제외, 비면 '미정')"
// 2026-11-17 디자인 변경: 임원(이사님)이 한눈에 보기 쉽도록 글자를 키우고, 사업장마다 카드로 나눴으며,
// 이번 주 작업 내용과 다음 주 예정 작업을 넓은 화면에서는 좌우로 나란히 보여 준다.
// 접기·펼치기는 브라우저 기본 <details> 를 쓴다 (자바스크립트 없이 동작하고 키보드로도 열린다).

import StatusBadge from "./StatusBadge";
import { formatWon } from "@/lib/amount";
import type { OfficeStatusRow, TaskView } from "@/lib/status";

const submittedAtFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function TaskList({ tasks, none }: { tasks: TaskView[]; none: boolean }) {
  if (none || tasks.length === 0) {
    return <p className="text-sm text-zinc-500 sm:text-base">작업 없음</p>;
  }
  // 휴대폰처럼 좁은 화면에서는 두 구역이 나란히 놓여 칸이 좁으므로, 금액을 작업명 아래로 내리고 글자를 조금 줄인다
  return (
    <ol className="divide-y divide-zinc-200 dark:divide-zinc-700">
      {tasks.map((t, i) => (
        <li key={i} className="space-y-1 py-2.5 first:pt-0 last:pb-0 sm:py-3">
          <p className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <span className="break-words text-sm font-semibold text-zinc-900 sm:text-base dark:text-zinc-100">
              {i + 1}. {t.title}
            </span>
            <span className="shrink-0 text-sm font-bold tabular-nums text-zinc-900 sm:text-base dark:text-zinc-100">
              {formatWon(t.amount)}
            </span>
          </p>
          <p className="whitespace-pre-wrap break-words text-xs leading-relaxed text-zinc-600 sm:text-sm dark:text-zinc-400">
            {t.content}
          </p>
        </li>
      ))}
    </ol>
  );
}

/** 구역 하나 (이번 주 작업 내용 / 다음 주 예정 작업) */
function Section({
  label,
  accent,
  right,
  tasks,
  none,
  ariaLabel,
}: {
  label: string;
  /** 제목 앞 점 색 (이번 주: 남색, 다음 주: 주황) */
  accent: "brand" | "orange";
  right?: React.ReactNode;
  tasks: TaskView[];
  none: boolean;
  ariaLabel: string;
}) {
  return (
    <section aria-label={ariaLabel} className="min-w-0 rounded-lg bg-zinc-50 p-2.5 sm:p-4 dark:bg-zinc-900/60">
      {/* 좁은 화면에서는 제목과 합계를 위아래로 놓는다 */}
      <h3 className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3">
        <span className="flex items-center gap-1.5 text-sm font-bold text-zinc-900 sm:gap-2 sm:text-base dark:text-zinc-100">
          <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${accent === "brand" ? "bg-brand" : "bg-orange-500"}`} />
          {label}
        </span>
        {right}
      </h3>
      <TaskList tasks={tasks} none={none} />
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

  // 다음 주 예정 작업 합계: 금액이 "미정"인 작업은 빼고 더한다 (이번 주 합계와는 섞지 않고 따로 보여 준다)
  const nextUndecided = row.nextTasks.filter((t) => t.amount === null).length;
  const nextSum = row.nextTasks.reduce((sum, t) => sum + (t.amount ?? 0), 0);
  const nextAllUndecided = row.nextTasks.length > 0 && nextUndecided === row.nextTasks.length;

  // 카드 머리줄: 사업장 이름·상태·제출 시각만 둔다. 합계는 아래 각 구역 제목 옆에 한 번만 보여 준다(중복 방지)
  const header = (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <div className="flex items-center gap-3">
        <span className="text-lg font-bold text-zinc-900 dark:text-zinc-100">{row.officeName}</span>
        <StatusBadge status={row.status} size="lg" />
      </div>
      <span className="text-xs text-zinc-500">
        {row.submittedAt ? `${submittedAtFormat.format(new Date(row.submittedAt))} 제출` : "아직 제출 전"}
      </span>
    </div>
  );

  // 아직 내지 않은 사업장은 펼칠 내용이 없어 한 줄 카드로 보여 준다
  if (notSubmitted) {
    return (
      <div
        className={`rounded-xl border px-5 py-4 ${
          row.status === "overdue"
            ? "border-orange-300 bg-orange-50/60 dark:border-orange-800 dark:bg-orange-950/40"
            : "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950"
        }`}
      >
        {header}
      </div>
    );
  }

  return (
    <details
      className="group rounded-xl border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      open={defaultOpen}
    >
      <summary className="cursor-pointer list-none px-3 py-3 sm:px-5 sm:py-4 [&::-webkit-details-marker]:hidden">
        {header}
        <span className="mt-1 block text-xs text-zinc-500">
          <span className="group-open:hidden">▶ 펼치기</span>
          <span className="hidden group-open:inline">▼ 접기</span>
        </span>
      </summary>

      <div
        // 이번 주(지난 주 포함) 화면은 이번 주 작업 내용만, 다음 주 화면은 다음 주 예정 작업만 보여 준다
        className="border-t border-zinc-100 px-3 py-3 sm:px-5 sm:py-4 dark:border-zinc-800"
      >
        {view === "this" ? (
          <Section
            label="이번 주 작업 내용"
            accent="brand"
            ariaLabel={`${row.officeName} 이번 주 작업 내용`}
            tasks={row.thisTasks}
            none={row.thisNone}
            // "작업 없음"이면 아래 목록에 이미 "작업 없음"이 나오므로 합계 줄은 감춘다 (중복 방지)
            right={
              row.thisNone || row.thisTasks.length === 0 ? undefined : (
                <span className="text-sm font-bold tabular-nums text-zinc-900 sm:text-base dark:text-zinc-100">
                  합계 {formatWon(row.thisTotal ?? 0)}
                </span>
              )
            }
          />
        ) : (
        <Section
          label="다음 주 예정 작업"
          accent="orange"
          ariaLabel={`${row.officeName} 다음 주 예정 작업`}
          tasks={row.nextTasks}
          none={row.nextNone}
          right={
            row.nextNone || row.nextTasks.length === 0 ? undefined : (
            <span className="sm:text-right">
              <span className="block text-sm font-bold tabular-nums text-zinc-900 sm:text-base dark:text-zinc-100">
                합계{" "}
                {nextAllUndecided
                    ? "미정" // 모든 작업의 금액이 미정이면 합계도 미정 (0원으로 보이지 않게)
                    : formatWon(nextSum)}
              </span>
              {/* 일부만 미정이면 정해진 금액만 더하고, 몇 건이 빠졌는지 알려 준다 */}
              {nextUndecided > 0 && !nextAllUndecided && (
                <span className="block text-xs text-zinc-500">금액 미정 {nextUndecided}건 제외</span>
              )}
            </span>
            )
          }
        />
        )}
      </div>
    </details>
  );
}
