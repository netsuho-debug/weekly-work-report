// Design Ref: §2-3 접속 코드 / §5 api/auth/route.ts
// Plan SC: 작업 13 "사업장 코드면 내 청사 입력 화면으로, 부서용 코드면 현황판으로 보내기"
//
// POST   /api/auth  { code }  — 코드를 해시해서 DB 의 14개와 대조하고, 맞으면 쿠키를 심는다
// DELETE /api/auth            — [나가기]: 쿠키를 지운다
//
// 코드 원문은 저장도 기록도 하지 않는다. 틀리면 IP 별로 세어서 5번 틀리면 15분 동안 잠근다.

import { z } from "zod";
import { hashCode } from "@/lib/access-code";
import { getDb } from "@/lib/db";
import { beginAttempt, getClientIp, purgeOldAttempts } from "@/lib/login-guard";
import { rejectUntrusted } from "@/lib/request-guard";
import { clearSession, createSession, type Role } from "@/lib/session";

type AuthResponse =
  | { ok: true; redirectTo: "/report" | "/dashboard" }
  | { ok: false; code: "invalid" | "locked" | "server_error"; message: string };

function reply(body: AuthResponse, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

// 코드는 짧은 영문·숫자지만, 터무니없이 긴 값은 읽지도 않는다
const bodySchema = z.object({ code: z.string().trim().min(1).max(64) });

export async function POST(request: Request) {
  // 다른 사이트가 시킨 요청이면 시도로 세기 전에 거절한다 (남의 IP 를 잠그는 데 쓰이지 못하게)
  const untrusted = rejectUntrusted(request, { json: true });
  if (untrusted) return untrusted;

  const ip = getClientIp(request);

  // 시도를 먼저 기록(예약)하고 나서 잠금을 판단한다. 동시에 보낸 요청이 모두 확인을 통과하지 못하게 한다.
  // 틀리면 이 기록이 그대로 실패 기록이 되고, 맞거나 서버 문제면 지운다.
  const attempt = await beginAttempt(ip);
  if (attempt.state === "locked") {
    return reply(
      { ok: false, code: "locked", message: "잠시 후 다시 시도해 주세요. (코드를 여러 번 틀렸습니다)" },
      429,
    );
  }
  if (attempt.state === "error") {
    return reply({ ok: false, code: "server_error", message: "확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
  // 하루 지난 기록 정리는 응답을 늦추지 않게 기다리지 않는다
  void purgeOldAttempts().catch(() => {});

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    json = null;
  }
  const body = bodySchema.safeParse(json);
  if (!body.success) {
    // 빈 값·잘못된 모양도 "틀린 코드"와 똑같이 취급하고 실패로 센다 (기록은 이미 남아 있다)
    return reply({ ok: false, code: "invalid", message: "코드를 확인해 주세요." }, 401);
  }

  const { data, error } = await getDb()
    .from("access_codes")
    .select("role, office_id, version")
    .eq("code_hash", hashCode(body.data.code))
    .maybeSingle();

  if (error) {
    console.error("[POST /api/auth] 코드 대조 실패:", error.code);
    await attempt.release(); // 사용자가 틀린 것이 아니므로 실패로 세지 않는다
    return reply({ ok: false, code: "server_error", message: "확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
  if (!data) {
    // 틀린 코드: 예약해 둔 기록이 그대로 실패 기록이 된다
    return reply({ ok: false, code: "invalid", message: "코드를 확인해 주세요." }, 401);
  }

  await attempt.release(); // 맞는 코드: 이번 시도는 실패가 아니다 (앞선 실패 기록은 그대로 둔다)
  const role = data.role as Role;
  await createSession({ role, officeId: role === "office" ? data.office_id : null, version: data.version });
  return reply({ ok: true, redirectTo: role === "dept" ? "/dashboard" : "/report" }, 200);
}

export async function DELETE(request: Request) {
  const untrusted = rejectUntrusted(request, { json: false });
  if (untrusted) return untrusted;
  await clearSession();
  return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
