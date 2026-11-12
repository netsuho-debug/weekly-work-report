// Design Ref: §4-2 임시 저장은 브라우저 기본 저장 공간(localStorage)을 쓴다. 청사·주차별로 따로 저장하고 제출하면 삭제한다.
// Plan SC: 작업 6 "작성 중 내용을 브라우저에 저장하고, 제출하면 지운다" (PRD 5장)
//
// 이 파일은 "저장 칸"만 다룬다(리액트 없음). 브라우저 밖(서버 렌더링 중)에서 불러도 죽지 않는다.
// 저장 공간은 시크릿 창·용량 초과·차단 설정 등으로 막힐 수 있으므로, 모든 접근을 실패해도 조용히 넘어가게 감쌌다.

import { z } from "zod";
import { MAX_TASKS_PER_SECTION, type TaskInput } from "./schema";

/** 임시 저장 구역 하나 (화면의 "이번 주" 또는 "다음 주") */
export type DraftSection = {
  rows: { id: number; values: TaskInput }[];
  none: boolean;
};

/** 임시 저장 내용 전체 */
export type Draft = {
  this: DraftSection;
  next: DraftSection;
  /** 저장한 시각 (밀리초) */
  savedAt: number;
};

/** 저장 형식이 바뀌면 숫자를 올린다. 옛 형식은 읽지 않고 무시한다 */
const DRAFT_VERSION = 1;

/** 청사·주차마다 따로 쓰는 저장 이름 */
export function draftKey(officeId: number, weekStart: string): string {
  return `weekly-report-draft:v${DRAFT_VERSION}:${officeId}:${weekStart}`;
}

// 저장소에 들어 있던 값은 믿지 않고 모양을 다시 검사한다 (손으로 고쳤거나 옛 형식일 수 있음)
const sectionSchema = z.object({
  rows: z
    .array(
      z.object({
        id: z.number().int().nonnegative(),
        values: z.object({ title: z.string(), content: z.string(), amount: z.string() }),
      }),
    )
    .min(1)
    .max(MAX_TASKS_PER_SECTION)
    .refine((rows) => new Set(rows.map((r) => r.id)).size === rows.length, "행 번호가 겹칩니다"),
  none: z.boolean(),
});

const draftSchema = z.object({
  v: z.literal(DRAFT_VERSION),
  savedAt: z.number(),
  this: sectionSchema,
  next: sectionSchema,
});

/** 아무것도 안 적은 새 화면과 같은지 (같다면 굳이 저장하지 않는다) */
export function isPristine(draft: Pick<Draft, "this" | "next">): boolean {
  return (["this", "next"] as const).every((key) => {
    const s = draft[key];
    return (
      !s.none &&
      s.rows.length === 1 &&
      s.rows[0].values.title === "" &&
      s.rows[0].values.content === "" &&
      s.rows[0].values.amount === ""
    );
  });
}

/** 저장한다. 성공하면 true, 저장소를 못 쓰면 false */
export function saveDraft(key: string, draft: Draft): boolean {
  try {
    const payload = { v: DRAFT_VERSION, savedAt: draft.savedAt, this: draft.this, next: draft.next };
    window.localStorage.setItem(key, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/** 불러온다. 저장본이 없거나 모양이 올바르지 않으면 null */
export function loadDraft(key: string): Draft | null {
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed = draftSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return null;
    const { this: thisSection, next: nextSection, savedAt } = parsed.data;
    return { this: thisSection, next: nextSection, savedAt };
  } catch {
    return null;
  }
}

/** 지운다 (제출에 성공하면 ReportForm 이 부른다) */
export function clearDraft(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // 저장소를 못 쓰면 지울 것도 없다
  }
}
