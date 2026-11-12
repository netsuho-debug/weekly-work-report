// Design Ref: §2-1 보고 제출 / §5 api/report/route.ts
// Plan SC: 작업 7 "한 청사·한 주에 1건만 남기고, 다시 제출하면 덮어쓴다" · 작업 8 "지각 판정"
//
// PUT /api/report — 내 청사의 이번 주 보고를 저장한다 (같은 주에 다시 보내면 덮어쓴다)
//  1) 청사는 요청 내용이 아니라 서버가 아는 접속 정보에서만 가져온다
//  2) 검사·주차·지각 판정은 lib/submission.ts 의 prepareSubmission 이 한다 (화면과 같은 규칙)
//  3) Postgres 함수 submit_report 로 한 트랜잭션에 저장한다

import { getDb } from "@/lib/db";
import { submitBodySchema, type SubmitResponse } from "@/lib/report-api";
import { rejectUntrusted } from "@/lib/request-guard";
import { getSessionOfficeId } from "@/lib/session";
import { prepareSubmission } from "@/lib/submission";

function reply(body: SubmitResponse, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request) {
  const untrusted = rejectUntrusted(request, { json: true });
  if (untrusted) return untrusted;

  const officeId = await getSessionOfficeId();
  if (officeId === null) {
    return reply({ ok: false, code: "unauthorized", message: "접속 코드로 다시 입장해 주세요." }, 401);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return reply({ ok: false, code: "invalid", message: "보낸 내용을 읽을 수 없습니다." }, 400);
  }
  const body = submitBodySchema.safeParse(json);
  if (!body.success) {
    return reply({ ok: false, code: "invalid", message: "보낸 내용의 모양이 올바르지 않습니다." }, 400);
  }

  // 지금 시각은 서버 시계로만 정한다 (화면이 보낸 시각은 믿지 않는다)
  const prepared = prepareSubmission(officeId, body.data, new Date());
  if (!prepared.ok) {
    return reply(
      { ok: false, code: prepared.code, message: prepared.message, currentWeekStart: prepared.currentWeekStart },
      prepared.status,
    );
  }

  const { error } = await getDb().rpc("submit_report", prepared.params);
  if (error) {
    // 보고 내용(작업명·내용·금액)은 로그에 남기지 않는다
    console.error("[PUT /api/report] 저장 실패:", error.code);
    return reply(
      { ok: false, code: "server_error", message: "저장하지 못했습니다. 잠시 후 다시 제출해 주세요." },
      500,
    );
  }

  return reply(
    { ok: true, isLate: prepared.params.p_is_late, submittedAt: prepared.params.p_submitted_at },
    200,
  );
}
