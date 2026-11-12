// Design Ref: §4-2 Zod — 화면과 서버가 같은 규칙을 쓰는 "검문소" (작업 4번, 이후 5·7번에서 재사용)
// Plan SC: S5 / PRD 5장: 작업명(필수, 최대 50자) · 내용(필수, 최대 500자) · 금액(0 이상 숫자)
//          이번 주 금액은 필수, 다음 주 금액은 비워도 된다(비우면 "미정").

import { z } from "zod";

/** 구역마다 넣을 수 있는 작업 최대 건수 (PRD 5장) */
export const MAX_TASKS_PER_SECTION = 20;
/** 작업명 최대 글자 수 */
export const TITLE_MAX = 50;
/** 내용 최대 글자 수 */
export const CONTENT_MAX = 500;

/** 화면 입력 칸에 적힌 값 (전부 글자) */
export type TaskInput = {
  title: string;
  content: string;
  amount: string;
};

export type TaskField = keyof TaskInput;

/** 검사를 통과한 작업 1건. 금액은 숫자(원), 비었으면 null */
export type ValidTask = {
  title: string;
  content: string;
  amount: number | null;
};

/** 칸별 오류 문구 (오류가 없는 칸은 비어 있음) */
export type TaskErrors = Partial<Record<TaskField, string>>;

export type TaskValidation =
  | { ok: true; value: ValidTask }
  | { ok: false; errors: TaskErrors };

const titleSchema = z
  .string()
  .trim()
  .min(1, "작업명을 입력해 주세요.")
  .max(TITLE_MAX, `작업명은 ${TITLE_MAX}자 이내로 입력해 주세요.`);

const contentSchema = z
  .string()
  .trim()
  .min(1, "내용을 입력해 주세요.")
  .max(CONTENT_MAX, `내용은 ${CONTENT_MAX}자 이내로 입력해 주세요.`);

/** 금액 글자를 숫자로 바꾼다. 쉼표는 무시한다. required 가 false 면 빈 칸은 null("미정") */
function makeAmountSchema(required: boolean) {
  return z.string().transform((raw, ctx): number | null => {
    const text = raw.replace(/[,\s]/g, "");

    if (text === "") {
      if (required) {
        ctx.addIssue({ code: "custom", message: "금액을 입력해 주세요." });
        return z.NEVER;
      }
      return null;
    }
    // 숫자만 허용: 음수(-), 소수점(.), 글자는 모두 여기서 걸러진다
    if (!/^\d+$/.test(text)) {
      ctx.addIssue({ code: "custom", message: "0 이상의 숫자만 입력해 주세요." });
      return z.NEVER;
    }
    const n = Number(text);
    if (!Number.isSafeInteger(n)) {
      ctx.addIssue({ code: "custom", message: "금액이 너무 큽니다." });
      return z.NEVER;
    }
    return n;
  });
}

/** 이번 주 진행 사항의 작업 1건 (금액 필수) */
export const thisWeekTaskSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  amount: makeAmountSchema(true),
});

/** 다음 주 예정 작업의 작업 1건 (금액은 비워도 됨 → "미정") */
export const nextWeekTaskSchema = z.object({
  title: titleSchema,
  content: contentSchema,
  amount: makeAmountSchema(false),
});

/** 한 구역(이번 주 / 다음 주)의 검사 결과 */
export type SectionValidation =
  | {
      ok: true;
      /** 검사를 통과한 작업들. "작업 없음"이면 빈 배열(0건) */
      tasks: ValidTask[];
    }
  | {
      ok: false;
      /** 작업 행마다의 오류 (행 순서와 같음, 오류 없는 행은 빈 객체) */
      rowErrors: TaskErrors[];
      /** 작업 건수 자체의 오류 (0건이거나 20건 초과) */
      countError?: string;
    };

/**
 * 한 구역을 검사한다. (화면과 7번 저장 API 가 함께 쓴다)
 * - "작업 없음"이 체크된 구역(none: true)은 작업 행이 있어도 무시하고 0건으로 통과시킨다. (DESIGN §1-2)
 * - 아니면 작업이 1건 이상 20건 이하여야 하고, 모든 작업이 검사를 통과해야 한다.
 * @param amountRequired 이번 주 구역이면 true, 다음 주 구역이면 false
 */
export function validateSection(
  input: { none: boolean; tasks: TaskInput[] },
  amountRequired: boolean,
): SectionValidation {
  if (input.none) return { ok: true, tasks: [] };

  if (input.tasks.length < 1) {
    return {
      ok: false,
      rowErrors: [],
      countError: "작업을 1건 이상 입력하거나 \"작업 없음\"을 체크해 주세요.",
    };
  }
  if (input.tasks.length > MAX_TASKS_PER_SECTION) {
    return {
      ok: false,
      rowErrors: [],
      countError: `작업은 ${MAX_TASKS_PER_SECTION}건까지 입력할 수 있습니다.`,
    };
  }

  const tasks: ValidTask[] = [];
  const rowErrors: TaskErrors[] = [];
  let hasError = false;
  for (const task of input.tasks) {
    const v = validateTask(task, amountRequired);
    if (v.ok) {
      tasks.push(v.value);
      rowErrors.push({});
    } else {
      hasError = true;
      rowErrors.push(v.errors);
    }
  }
  return hasError ? { ok: false, rowErrors } : { ok: true, tasks };
}

/**
 * 작업 1건을 검사한다.
 * @param amountRequired 이번 주 구역이면 true, 다음 주 구역이면 false
 */
export function validateTask(input: TaskInput, amountRequired: boolean): TaskValidation {
  const schema = amountRequired ? thisWeekTaskSchema : nextWeekTaskSchema;
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, value: result.data };

  const errors: TaskErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    // 한 칸에 오류가 여러 개여도 첫 번째만 보여 준다
    if (typeof field === "string" && !(field in errors)) {
      errors[field as TaskField] = issue.message;
    }
  }
  return { ok: false, errors };
}
