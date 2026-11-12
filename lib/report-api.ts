// Design Ref: §2-1 보고 제출 — 화면(브라우저)과 서버(API)가 주고받는 모양을 한곳에 둔다.
// 서버 전용 코드가 아니므로 브라우저에서도 불러 쓸 수 있다.

import { z } from "zod";

const taskBodySchema = z.object({
  title: z.string(),
  content: z.string(),
  amount: z.string(),
});

const sectionBodySchema = z.object({
  /** "작업 없음" 체크 여부. true 면 tasks 는 서버가 무시한다 */
  none: z.boolean(),
  /** 글자 수·필수 검사는 validateSection 이 한다. 여기서는 터무니없이 큰 요청만 막는다 */
  tasks: z.array(taskBodySchema).max(100),
});

/** PUT /api/report 로 보내는 내용 */
export const submitBodySchema = z.object({
  /** 화면이 보여 준 주차(월요일 날짜). 서버의 "이번 주"와 다르면 거절한다 */
  weekStart: z.string(),
  this: sectionBodySchema,
  next: sectionBodySchema,
});

export type SubmitBody = z.infer<typeof submitBodySchema>;

/**
 * 이미 낸 이번 주 보고 (보고 입력 화면이 서버에서 읽어 폼의 처음 값으로 쓴다. DESIGN §1-2)
 * 금액은 입력 칸 모양("1,500,000", 미정이면 "")으로 바꿔 둔다.
 */
export type SavedReport = {
  isLate: boolean;
  /** 마지막 제출 시각 (밀리초) */
  submittedAt: number;
  this: { none: boolean; tasks: z.infer<typeof taskBodySchema>[] };
  next: { none: boolean; tasks: z.infer<typeof taskBodySchema>[] };
};

/** PUT /api/report 의 응답 */
export type SubmitResponse =
  | {
      ok: true;
      /** 마감(목 11:00 KST) 이후에 낸 제출인지 */
      isLate: boolean;
      /** 서버가 기록한 제출 시각 (ISO 문자열) */
      submittedAt: string;
    }
  | {
      ok: false;
      code: "unauthorized" | "invalid" | "week_changed" | "server_error";
      message: string;
      /** week_changed 일 때만: 서버가 아는 "지금 이번 주" 월요일 날짜 (화면이 작성 내용을 새 주차 임시 저장으로 옮기는 데 쓴다) */
      currentWeekStart?: string;
    };
