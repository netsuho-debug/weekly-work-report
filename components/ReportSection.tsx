// Design Ref: §1-2 보고 입력 화면 — "이번 주 진행 사항" / "다음 주 예정 작업" 한 구역
// Plan SC: 작업 3 "구역마다 작업 행을 1~20건" / 작업 4 "입력 검사"
// 값과 상태는 위쪽 ReportForm 이 들고 있고, 여기서는 보여 주기만 한다.
// "작업 없음"을 체크하면 작업 칸을 접고 0건으로 제출한다 (작업 5).

import TaskCard from "./TaskCard";
import { MAX_TASKS_PER_SECTION, type TaskField, type TaskInput } from "@/lib/schema";

/** 작업 행 하나의 화면 상태 */
export type TaskRow = {
  /** 고정 번호. 가운데 카드를 지워도 다른 카드에 적던 글이 그대로 남게 해 준다 */
  id: number;
  values: TaskInput;
  touched: Partial<Record<TaskField, boolean>>;
};

type ReportSectionProps = {
  sectionKey: "this" | "next";
  title: string;
  /** 구역 설명 (예: 어느 주의 내용인지) */
  description: string;
  amountRequired: boolean;
  rows: TaskRow[];
  /** "작업 없음"이 체크됐는지 (체크하면 작업 카드를 숨기고 0건으로 제출한다) */
  none: boolean;
  showAllErrors: boolean;
  onToggleNone: (checked: boolean) => void;
  onAdd: () => void;
  onRemove: (rowId: number) => void;
  onChange: (rowId: number, field: TaskField, value: string) => void;
  onBlur: (rowId: number, field: TaskField) => void;
};

export default function ReportSection({
  sectionKey,
  title,
  description,
  amountRequired,
  rows,
  none,
  showAllErrors,
  onToggleNone,
  onAdd,
  onRemove,
  onChange,
  onBlur,
}: ReportSectionProps) {
  const canAdd = rows.length < MAX_TASKS_PER_SECTION;
  const canRemove = rows.length > 1;

  return (
    <section aria-labelledby={`${sectionKey}-heading`} className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id={`${sectionKey}-heading`} className="text-lg font-bold">
            {title}
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{description}</p>
        </div>
        <label className="flex shrink-0 cursor-pointer items-center gap-2 rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium dark:border-zinc-700">
          <input
            id={`${sectionKey}-none`}
            type="checkbox"
            checked={none}
            onChange={(e) => onToggleNone(e.target.checked)}
            className="h-4 w-4"
          />
          작업 없음
        </label>
      </div>

      {none && (
        <p
          role="status"
          className="rounded-md bg-zinc-100 px-4 py-3 text-sm text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
        >
          이 구역은 &quot;작업 없음&quot;(0건)으로 제출됩니다. 체크를 풀면 적어 둔 내용이 다시 나타납니다.
        </p>
      )}

      {!none && rows.map((row, i) => (
        <TaskCard
          key={row.id}
          index={i + 1}
          rowId={row.id}
          sectionKey={sectionKey}
          amountRequired={amountRequired}
          values={row.values}
          touched={row.touched}
          showAllErrors={showAllErrors}
          canRemove={canRemove}
          onChange={(field, value) => onChange(row.id, field, value)}
          onBlur={(field) => onBlur(row.id, field)}
          onRemove={() => onRemove(row.id)}
        />
      ))}

      {!none && (
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onAdd}
          disabled={!canAdd}
          className="rounded-md border border-brand px-3 py-2 text-sm font-semibold text-brand hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-40 dark:text-sky-300 dark:hover:bg-blue-950"
        >
          + 작업 추가
        </button>
        <p role="status" className="text-xs text-zinc-500">
          {rows.length} / {MAX_TASKS_PER_SECTION}건
          {!canAdd && " (최대)"}
        </p>
      </div>
      )}
    </section>
  );
}
