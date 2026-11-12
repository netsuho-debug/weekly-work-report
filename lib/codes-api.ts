// Design Ref: §1-4 접속 코드 변경 화면 / §5 api/codes — 화면과 서버가 주고받는 모양
// 서버 전용 코드가 아니므로 브라우저에서도 불러 쓸 수 있다. (해시·난수는 access-code.ts, 서버에만 있다)

import { z } from "zod";
import { OFFICES } from "./offices";

/** 코드가 필요한 14곳: 부서용 + 청사 1~13 */
export type CodeSlot = "dept" | number;

/** 화면·응답에 보이는 이름 ("부서용", "1청사" ...) */
export function slotLabel(slot: CodeSlot): string {
  return slot === "dept" ? "부서용" : `${slot}청사`;
}

/** 화면에 줄 세우는 순서: 부서용 먼저, 그다음 1청사~13청사 */
export const ALL_SLOTS: readonly CodeSlot[] = ["dept", ...OFFICES.map((o) => o.id)];

const slotSchema = z.union([z.literal("dept"), z.number().int().min(1).max(13)]);

const changeSchema = z.discriminatedUnion("mode", [
  /** 서버가 난수로 새 코드를 만든다 */
  z.object({ slot: slotSchema, mode: z.literal("auto") }),
  /** 사람이 직접 정한 코드 (길이·글자 검사는 서버가 code-rules.ts 로 한다) */
  z.object({ slot: slotSchema, mode: z.literal("manual"), code: z.string().max(64) }),
]);

/** PUT /api/codes 로 보내는 내용: 바꿀 칸만 담는다 */
export const changeBodySchema = z.object({
  changes: z.array(changeSchema).min(1).max(14),
});

export type ChangeBody = z.infer<typeof changeBodySchema>;

/** 새로 정해진 코드 한 줄 (저장 직후 한 번만 보여 준다) */
export type IssuedCode = { slot: CodeSlot; label: string; code: string };

/** PUT /api/codes 의 응답 */
export type ChangeResponse =
  | { ok: true; issued: IssuedCode[] }
  | {
      ok: false;
      code: "unauthorized" | "invalid" | "duplicate" | "server_error";
      message: string;
      /** 문제가 된 칸(알 수 있을 때) */
      slot?: CodeSlot;
    };
