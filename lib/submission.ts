// Design Ref: §2-1 보고 제출 (3~5번 단계) — 제출 한 건을 어떻게 저장할지 "정하는" 계산
// Plan SC: 작업 8 "목요일 11:00 이후 제출하거나 고치면 '지각 제출'로 기록하기"
//
// API 라우트에서 계산 부분만 따로 뗀 순수 함수다. 현재 시각(now)을 밖에서 넣어 주므로
// "마감 1초 전 / 마감 정각 / 재제출" 같은 경계를 시계를 돌리지 않고도 그대로 시험할 수 있다.
// (DB·쿠키·서버 전용 코드를 쓰지 않는다)

import type { SubmitBody } from "./report-api";
import { validateSection } from "./schema";
import { getWeekStart, isLate } from "./week";

/** DB 함수 submit_report 에 넘기는 값 (supabase/schema.sql 의 매개변수와 이름이 같다) */
export type SubmissionParams = {
  p_office_id: number;
  p_week_start: string;
  p_submitted_at: string;
  p_is_late: boolean;
  p_this_none: boolean;
  p_next_none: boolean;
  p_items: {
    section: "this" | "next";
    seq: number;
    title: string;
    content: string;
    amount: number | null;
  }[];
};

export type PrepareResult =
  | { ok: true; params: SubmissionParams }
  | {
      ok: false;
      status: 400 | 409;
      code: "invalid" | "week_changed";
      message: string;
      /** week_changed 일 때: 서버가 정한 이번 주 월요일 */
      currentWeekStart?: string;
    };

/**
 * 제출 내용을 검사하고 저장할 값을 만든다.
 * - 주차는 서버 시계(한국 시간)로 정한다. 화면이 보낸 주차가 다르면 거절한다.
 * - 지각 여부는 "이번 제출 시각(now)"으로 매번 새로 정한다. 그래서 마감 전에 낸 뒤 마감 후에 고쳐서
 *   다시 내면 지각 제출로 바뀐다. (덮어쓰기라 마지막 제출 시각이 곧 기록된다)
 */
export function prepareSubmission(officeId: number, body: SubmitBody, now: Date): PrepareResult {
  const weekStart = getWeekStart(now);
  if (body.weekStart !== weekStart) {
    return {
      ok: false,
      status: 409,
      code: "week_changed",
      message: "주차가 바뀌었습니다. 작성 내용은 새 주차로 옮겨 두었으니, 화면이 새로 열리면 확인하고 다시 제출해 주세요.",
      currentWeekStart: weekStart,
    };
  }

  const thisWeek = validateSection(body.this, true);
  const nextWeek = validateSection(body.next, false);
  if (!thisWeek.ok || !nextWeek.ok) {
    return {
      ok: false,
      status: 400,
      code: "invalid",
      message: "입력 내용을 확인해 주세요. 규칙에 맞지 않는 칸이 있습니다.",
    };
  }

  return {
    ok: true,
    params: {
      p_office_id: officeId,
      p_week_start: weekStart,
      p_submitted_at: now.toISOString(),
      p_is_late: isLate(now, weekStart),
      p_this_none: body.this.none,
      p_next_none: body.next.none,
      // 검사를 통과한 작업만 저장한다 ("작업 없음" 구역은 0건)
      p_items: [
        ...thisWeek.tasks.map((t, i) => ({ section: "this" as const, seq: i + 1, ...t })),
        ...nextWeek.tasks.map((t, i) => ({ section: "next" as const, seq: i + 1, ...t })),
      ],
    },
  };
}
