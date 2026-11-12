// Design Ref: §1-3 현황판 — 청사 한 줄 + [펼치기]
// Plan SC: 작업 10 "청사마다 이번 주 작업별 금액과 합계 (다음 주 금액은 합계 제외, 비면 '미정')"
// 펼치기는 브라우저 기본 <details> 를 쓴다 (자바스크립트 없이 동작하고 키보드로도 열린다).

import StatusBadge from "./StatusBadge";
import { formatWon } from "@/lib/amount";
import type { OfficeStatusRow, TaskView } from "@/lib/status";

/** 한 줄의 칸 나누기. 이름 | 상태 | 이번 주 합계 | 마지막 제출 (좁은 화면에서는 2칸씩 접힌다) */
export const ROW_GRID = "grid grid-cols-2 items-center gap-x-4 gap-y-1 sm:grid-cols-[5rem_7rem_1fr_9rem]";

const submittedAtFormat = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

function TaskList({ tasks, none }: { tasks: TaskView[]; none: boolean }) {
  if (none || tasks.length === 0) {
    return <p className="text-sm text-zinc-500">작업 없음</p>;
  }
  return (
    <ol className="space-y-3">
      {tasks.map((t, i) => (
        <li key={i} className="space-y-0.5">
          <p className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">
              {i + 1}. {t.title}
            </span>
            <span className="shrink-0 tabular-nums">{formatWon(t.amount)}</span>
          </p>
          <p className="whitespace-pre-wrap break-words text-xs text-zinc-600 dark:text-zinc-400">
            {t.content}
          </p>
        </li>
      ))}
    </ol>
  );
}

/**
 * defaultOpen: 처음부터 펼쳐 둘지
 * view: "next" 는 다음 주 예정 작업만, "this" 는 이번 주 진행 사항(금액 합계 포함)과 다음 주 예정 작업을 함께 보여 준다
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
  // 셋째 칸: 이번 주 보기는 금액 합계("12,500,000원"), 다음 주 보기는 작업 건수. 미제출은 "-", "작업 없음"은 글자로
  const notSubmitted = row.status === "missing" || row.status === "overdue";
  const totalText =
    view === "next"
      ? notSubmitted
        ? "-"
        : row.nextNone || row.nextTasks.length === 0
          ? "작업 없음"
          : `${row.nextTasks.length}건`
      : row.thisTotal === null
        ? "-"
        : row.thisNone
          ? "작업 없음"
          : formatWon(row.thisTotal);

  const cells = (
    <>
      <span className="font-medium">{row.officeName}</span>
      <span className="justify-self-end sm:justify-self-start">
        <StatusBadge status={row.status} />
      </span>
      <span className="tabular-nums sm:text-right">
        <span className="mr-2 text-xs text-zinc-500 sm:hidden">{view === "next" ? "다음 주 예정" : "이번 주 합계"}</span>
        {totalText}
      </span>
      <span className="justify-self-end text-xs text-zinc-600 sm:justify-self-start dark:text-zinc-400">
        {row.submittedAt ? submittedAtFormat.format(new Date(row.submittedAt)) : "-"}
      </span>
    </>
  );

  // 미제출 청사는 펼칠 내용이 없다
  if (row.status === "missing" || row.status === "overdue") {
    return <div className={`${ROW_GRID} px-4 py-3 text-sm`}>{cells}</div>;
  }

  return (
    <details className="group" open={defaultOpen}>
      <summary
        className={`${ROW_GRID} cursor-pointer list-none px-4 py-3 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900 [&::-webkit-details-marker]:hidden`}
      >
        {cells}
        <span className="col-span-2 text-xs text-brand sm:col-span-4 dark:text-sky-300">
          <span className="group-open:hidden">▶ 펼치기</span>
          <span className="hidden group-open:inline">▼ 접기</span>
        </span>
      </summary>

      <div className="space-y-5 border-t border-zinc-200 bg-zinc-50 px-4 py-4 dark:border-zinc-800 dark:bg-zinc-900/50">
        {view === "this" && (
          <section aria-label={`${row.officeName} 이번 주 작업 내용`} className="space-y-2">
            <h3 className="flex items-baseline justify-between text-sm font-bold">
              <span>이번 주 작업 내용</span>
              <span className="tabular-nums">
                합계 {row.thisNone ? "작업 없음" : formatWon(row.thisTotal ?? 0)}
              </span>
            </h3>
            <TaskList tasks={row.thisTasks} none={row.thisNone} />
          </section>
        )}

        <section aria-label={`${row.officeName} 다음 주 예정 작업`} className="space-y-2">
          <h3 className="flex items-baseline justify-between text-sm font-bold">
            <span>다음 주 예정 작업</span>
            {view === "this" && <span className="text-xs font-normal text-zinc-500">합계에 넣지 않습니다</span>}
          </h3>
          <TaskList tasks={row.nextTasks} none={row.nextNone} />
        </section>
      </div>
    </details>
  );
}
