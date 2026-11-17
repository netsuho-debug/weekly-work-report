// Design Ref: §1-3 현황판 — 사업장 한 곳 = 목록 한 줄
// Plan SC: 작업 10 "사업장마다 작업별 금액과 합계"
// 2026-11-17 디자인 3차 (덜어내기):
//  - 카드·색 띠·그림자 대신, 흰 판 하나에 가는 구분선으로 나열한다.
//  - 색은 예외에만: 제출 완료 배지는 빼고, 미제출·제출지연만 배지를 붙인다.
//  - 오른쪽에 금액(만 원 단위)을 세로로 맞춰 큰 공사가 바로 보이게 한다. 정확한 원 단위는 마우스를 올리면 보이고, 엑셀에도 있다.
//  - 작업은 "작업명 … 금액" 한 줄만 보이고, 누르면 일시·장소·내용이 펼쳐진다 (브라우저 기본 <details>).
//  - 작업이 1건이면 합계 = 그 작업 금액이라 금액은 사업장 줄에 한 번만 보여 준다(중복 방지).

import StatusBadge from "./StatusBadge";
import { formatManwon, formatWon } from "@/lib/amount";
import type { OfficeStatusRow, TaskView } from "@/lib/status";

/** 한 사업장의 보여 줄 작업과 합계 (이번 주 / 다음 주 보기에 따라) */
export function rowTasks(row: OfficeStatusRow, view: "this" | "next") {
  const tasks = view === "this" ? row.thisTasks : row.nextTasks;
  const none = (view === "this" ? row.thisNone : row.nextNone) || tasks.length === 0;
  // 금액이 "미정"인 작업(다음 주)은 합계에서 빼고 몇 건인지 센다
  const undecided = tasks.filter((t) => t.amount === null).length;
  const sum = tasks.reduce((s, t) => s + (t.amount ?? 0), 0);
  const allUndecided = tasks.length > 0 && undecided === tasks.length;
  return { tasks, none, sum, undecided, allUndecided, total: allUndecided ? null : sum };
}

function Amount({ value, className = "" }: { value: number | null; className?: string }) {
  return (
    <span className={`shrink-0 whitespace-nowrap tabular-nums ${className}`} title={value === null ? undefined : formatWon(value)}>
      {formatManwon(value)}
    </span>
  );
}

function TaskLine({ task, showAmount }: { task: TaskView; showAmount: boolean }) {
  return (
    <li>
      <details className="group">
        <summary className="flex cursor-pointer list-none items-baseline justify-between gap-3 py-1.5 text-sm sm:py-1 text-zinc-600 hover:text-zinc-900 [&::-webkit-details-marker]:hidden">
          <span className="flex min-w-0 items-baseline gap-1.5">
            <span aria-hidden="true" className="inline-block text-zinc-400 transition-transform group-open:rotate-90">
              ›
            </span>
            <span className="break-words">{task.title}</span>
          </span>
          {showAmount && <Amount value={task.amount} />}
        </summary>
        <p className="whitespace-pre-wrap break-words pb-2 pl-4 pt-1 text-xs leading-relaxed text-zinc-500">{task.content}</p>
      </details>
    </li>
  );
}

/** 목록 한 줄 */
export default function OfficeStatusItem({ row, view }: { row: OfficeStatusRow; view: "this" | "next" }) {
  const pending = row.status === "missing" || row.status === "overdue";
  const { tasks, none, total, undecided, allUndecided } = rowTasks(row, view);

  return (
    <li className="py-3.5">
      <div className="flex items-baseline justify-between gap-3">
        {/* 작업이 없는 곳은 사업장 이름도 연한 회색으로 (작업 있는 곳이 먼저 눈에 들어오게) */}
        <span className={`min-w-0 text-base font-bold sm:text-lg ${!pending && none ? "text-zinc-400" : "text-zinc-900"}`}>
          {row.officeName}
        </span>
        {pending ? (
          <StatusBadge status={row.status} />
        ) : none ? (
          <span className="text-sm text-zinc-400">작업 없음</span>
        ) : (
          // 작업 있는 곳: 사업장 이름 줄 오른쪽에 "N건 / 금액"
          // 건수·"/"·금액을 고정 폭 칸에 오른쪽 맞춤해, 위아래 줄끼리 세로로 가지런히 맞춘다
          <span className="flex shrink-0 items-baseline gap-1.5 whitespace-nowrap">
            <span className="w-8 text-right text-sm font-medium tabular-nums text-zinc-500">{tasks.length}건</span>
            <span className="text-sm text-zinc-300">/</span>
            <Amount value={total} className="min-w-[5.5rem] text-right text-base font-bold text-zinc-900 sm:min-w-[6.5rem] sm:text-lg" />
          </span>
        )}
      </div>
      {/* 다음 주 예정 작업 중 일부만 금액 미정이면, 정해진 금액만 더했다고 알려 준다 */}
      {!pending && !none && undecided > 0 && !allUndecided && (
        <p className="text-right text-xs text-zinc-400">금액 미정 {undecided}건 제외</p>
      )}
      {!pending && !none && (
        <ul className="mt-1.5 space-y-0.5">
          {tasks.map((t, i) => (
            <TaskLine key={i} task={t} showAmount={tasks.length > 1} />
          ))}
        </ul>
      )}
    </li>
  );
}
