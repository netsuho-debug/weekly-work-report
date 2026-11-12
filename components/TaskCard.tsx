// Design Ref: §1-2 보고 입력 화면 — 작업 1건 카드 (작업명 · 내용 · 금액 + 삭제 버튼)
// 3번: 삭제 버튼 / 4번: 입력 검사 오류·글자 수·금액 미리보기 (값은 위쪽 ReportForm 이 들고 있다)

import { AMOUNT_UNDECIDED, amountTextToNumber, formatWon } from "@/lib/amount";
import {
  CONTENT_MAX,
  TITLE_MAX,
  validateTask,
  type TaskField,
  type TaskInput,
} from "@/lib/schema";

type TaskCardProps = {
  /** 카드 제목에 보일 순서 번호 (1부터, 삭제하면 다시 매겨진다) */
  index: number;
  /** 입력 칸 id 용 고정 번호. 순서가 바뀌어도 변하지 않는다 */
  rowId: number;
  /** 입력 칸 id 가 겹치지 않게 구역을 구분하는 값 */
  sectionKey: "this" | "next";
  /** 금액을 반드시 적어야 하는지 (이번 주: true / 다음 주: false → 비우면 "미정") */
  amountRequired: boolean;
  /** 지금 입력된 값 */
  values: TaskInput;
  /** 입력 칸을 한 번이라도 떠난 적이 있는지 (그래야 오류를 보여 준다) */
  touched: Partial<Record<TaskField, boolean>>;
  /** 제출 버튼을 눌렀는지 (눌렀으면 모든 오류를 보여 준다) */
  showAllErrors: boolean;
  /** 삭제할 수 있는지 (구역에 작업이 1건뿐이면 false) */
  canRemove: boolean;
  onChange: (field: TaskField, value: string) => void;
  onBlur: (field: TaskField) => void;
  onRemove: () => void;
};

const inputBase =
  "w-full rounded-md border bg-white px-3 py-2 text-base text-zinc-900 " +
  "placeholder:text-zinc-400 focus:outline-none focus:ring-2 dark:bg-zinc-900 dark:text-zinc-100";
const inputOk =
  " border-zinc-300 focus:border-brand focus:ring-brand/30 dark:border-zinc-700";
const inputError = " border-red-500 focus:border-red-600 focus:ring-red-600/30";

export default function TaskCard({
  index,
  rowId,
  sectionKey,
  amountRequired,
  values,
  touched,
  showAllErrors,
  canRemove,
  onChange,
  onBlur,
  onRemove,
}: TaskCardProps) {
  const id = `${sectionKey}-${rowId}`;
  const validation = validateTask(values, amountRequired);
  const errors = validation.ok ? {} : validation.errors;

  // 칸을 떠났거나 제출을 눌렀을 때만 오류를 보여 준다 (타이핑 도중에 빨갛게 되지 않도록)
  const shown = (field: TaskField) =>
    touched[field] || showAllErrors ? errors[field] : undefined;

  const titleError = shown("title");
  const contentError = shown("content");
  const amountError = shown("amount");

  const titleLen = values.title.trim().length;
  const contentLen = values.content.trim().length;

  // 금액 미리보기: 올바른 숫자면 "1,500,000원", 다음 주 구역에서 비어 있으면 "미정"
  const amountNumber = amountTextToNumber(values.amount);
  const amountEmpty = values.amount.replace(/[,\s]/g, "") === "";
  const amountPreview =
    amountNumber !== null
      ? formatWon(amountNumber)
      : amountEmpty && !amountRequired
        ? `${AMOUNT_UNDECIDED}으로 표시됩니다`
        : null;

  return (
    <div className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-700 dark:text-zinc-300">작업 {index}</p>
        <button
          type="button"
          onClick={onRemove}
          disabled={!canRemove}
          aria-label={`작업 ${index} 삭제`}
          title={canRemove ? undefined : "작업은 최소 1건이 있어야 합니다"}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          삭제
        </button>
      </div>

      <div className="space-y-3">
        {/* 작업명 */}
        <div>
          <label htmlFor={`${id}-title`} className="mb-1 block text-sm font-medium">
            작업명 <span className="text-red-600">*</span>
          </label>
          <input
            id={`${id}-title`}
            type="text"
            value={values.title}
            onChange={(e) => onChange("title", e.target.value)}
            onBlur={() => onBlur("title")}
            aria-invalid={titleError ? true : undefined}
            aria-describedby={titleError ? `${id}-title-error` : undefined}
            className={inputBase + (titleError ? inputError : inputOk)}
            placeholder="예) 승강기 로프 교체 공사"
          />
          <div className="mt-1 flex justify-between gap-2 text-xs">
            <p id={`${id}-title-error`} className="text-red-600">
              {titleError}
            </p>
            <p className={titleLen > TITLE_MAX ? "text-red-600" : "text-zinc-500"}>
              {titleLen}/{TITLE_MAX}
            </p>
          </div>
        </div>

        {/* 내용 */}
        <div>
          <label htmlFor={`${id}-content`} className="mb-1 block text-sm font-medium">
            내용 <span className="text-red-600">*</span>
          </label>
          <textarea
            id={`${id}-content`}
            rows={4}
            value={values.content}
            onChange={(e) => onChange("content", e.target.value)}
            onBlur={() => onBlur("content")}
            aria-invalid={contentError ? true : undefined}
            aria-describedby={contentError ? `${id}-content-error` : undefined}
            className={inputBase + (contentError ? inputError : inputOk)}
            placeholder={
              sectionKey === "next"
                ? "아래 순서로 적어 주세요.\n1. 일시(작업예정일): 00년 00월 00일\n2. 장소: 예) 본관 3호기\n3. 내용: 예) 로프 교체 작업 예정"
                : "아래 순서로 적어 주세요.\n1. 일시(작업일): 00년 00월 00일\n2. 장소: 예) 본관 3호기\n3. 내용: 예) 로프 교체 작업 중, 점검 후 시운전 예정"
            }
          />
          <div className="mt-1 flex justify-between gap-2 text-xs">
            <p id={`${id}-content-error`} className="text-red-600">
              {contentError}
            </p>
            <p className={contentLen > CONTENT_MAX ? "text-red-600" : "text-zinc-500"}>
              {contentLen}/{CONTENT_MAX}
            </p>
          </div>
        </div>

        {/* 금액 */}
        <div>
          <label htmlFor={`${id}-amount`} className="mb-1 block text-sm font-medium">
            금액(원){" "}
            {amountRequired ? (
              <span className="text-red-600">*</span>
            ) : (
              <span className="font-normal text-zinc-500">— 비워 두면 &quot;미정&quot;으로 표시됩니다</span>
            )}
          </label>
          <input
            id={`${id}-amount`}
            type="text"
            inputMode="numeric"
            value={values.amount}
            onChange={(e) => onChange("amount", e.target.value)}
            onBlur={() => onBlur("amount")}
            aria-invalid={amountError ? true : undefined}
            aria-describedby={`${id}-amount-note`}
            className={inputBase + (amountError ? inputError : inputOk)}
            placeholder="예) 1,500,000"
          />
          <div id={`${id}-amount-note`} className="mt-1 flex justify-between gap-2 text-xs">
            <p className="text-red-600">{amountError}</p>
            <p className="text-zinc-500">
              {amountError ? null : (amountPreview ?? "계약(공사) 금액 전체를 적어 주세요.")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
