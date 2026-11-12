// Design Ref: §2-3 "코드 변경 ─▶ PUT /api/codes(부서 쿠키만) ─▶ 새 코드를 해시해 저장 ─▶ 옛 코드는 즉시 무효"
// Plan SC: 작업 14 "부서용 코드로 들어온 사람이 접속 코드 14개를 바꿀 수 있게 하기"
//
// PUT /api/codes { changes: [{ slot, mode: "auto" } | { slot, mode: "manual", code }] }
//  - 부서용 코드로 입장한 사람만 쓸 수 있다.
//  - 바꿀 칸만 보낸다. auto 는 서버가 난수 12자를 만들고, manual 은 직접 정한 코드(영문 대·소문자·숫자 섞어 12자 이상)다.
//  - 14칸 안에서 코드가 겹치면 거절한다(바뀌지 않는 칸의 현재 코드와 겹쳐도 마찬가지).
//  - 여러 칸을 한 번에 바꾸되, 하나라도 실패하면 아무것도 바뀌지 않는다(DB 함수 change_codes).
//  - 새 코드는 응답에 한 번만 담아 돌려주고, 어디에도 원문을 저장하지 않는다. (해시만 저장)
//  - 바뀐 칸은 version 이 +1 되어 옛 코드와 그 코드로 입장한 쿠키가 즉시 무효가 된다.
//    부서용 코드를 바꾼 사람 본인은 쫓겨나지 않게, 새 버전의 쿠키를 바로 다시 심어 준다.

import { generateCode, hashCode } from "@/lib/access-code";
import { codeRuleMessage, GENERATED_CODE_LENGTH } from "@/lib/code-rules";
import { changeBodySchema, slotLabel, type ChangeResponse, type CodeSlot, type IssuedCode } from "@/lib/codes-api";
import { getDb } from "@/lib/db";
import { rejectUntrusted } from "@/lib/request-guard";
import { createSession, isDeptSession } from "@/lib/session";

function reply(body: ChangeResponse, status: number) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** DB 칸 구분: 부서용은 office_id 가 없다 */
const toRow = (slot: CodeSlot) => ({ role: slot === "dept" ? "dept" : "office", office_id: slot === "dept" ? null : slot });

export async function PUT(request: Request) {
  const untrusted = rejectUntrusted(request, { json: true });
  if (untrusted) return untrusted;

  if (!(await isDeptSession())) {
    return reply({ ok: false, code: "unauthorized", message: "부서용 접속 코드로 입장해 주세요." }, 401);
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return reply({ ok: false, code: "invalid", message: "보낸 내용을 읽을 수 없습니다." }, 400);
  }
  const body = changeBodySchema.safeParse(json);
  if (!body.success) {
    return reply({ ok: false, code: "invalid", message: "보낸 내용의 모양이 올바르지 않습니다." }, 400);
  }
  const { changes } = body.data;

  // 같은 칸을 두 번 바꾸려는 요청은 거절한다
  const slots = changes.map((c) => c.slot);
  if (new Set(slots).size !== slots.length) {
    return reply({ ok: false, code: "invalid", message: "같은 칸이 두 번 들어 있습니다." }, 400);
  }

  // 1) 새 코드를 정하고 해시한다. 직접 정한 코드는 규칙(영문 대·소문자·숫자 섞어 12자 이상)을 검사한다.
  const db = getDb();
  const { data: current, error: readError } = await db.from("access_codes").select("role, office_id, code_hash");
  if (readError || !current) {
    console.error("[PUT /api/codes] 현재 코드 읽기 실패:", readError?.code);
    return reply({ ok: false, code: "server_error", message: "확인하지 못했습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }
  const changingKeys = new Set(slots.map((s) => String(s)));
  // 바뀌지 않는 칸들의 현재 해시: 새 코드가 이들과 같으면 안 된다
  const keptHashes = new Set(
    current
      .filter((r) => !changingKeys.has(r.role === "dept" ? "dept" : String(r.office_id)))
      .map((r) => r.code_hash as string),
  );

  const issued: IssuedCode[] = [];
  const rows: { role: string; office_id: number | null; code_hash: string }[] = [];
  const newHashes = new Set<string>();

  for (const change of changes) {
    let code: string;
    if (change.mode === "manual") {
      code = change.code.trim();
      const problem = codeRuleMessage(code);
      if (problem) return reply({ ok: false, code: "invalid", message: `${slotLabel(change.slot)}: ${problem}`, slot: change.slot }, 400);
    } else {
      // 자동 생성: 겹치면 다시 뽑는다 (사실상 일어나지 않는다)
      do code = generateCode(GENERATED_CODE_LENGTH);
      while (keptHashes.has(hashCode(code)) || newHashes.has(hashCode(code)));
    }
    const hash = hashCode(code);
    if (newHashes.has(hash) || keptHashes.has(hash)) {
      return reply(
        { ok: false, code: "duplicate", message: `${slotLabel(change.slot)}: 다른 칸에서 이미 쓰는 코드입니다. 다른 코드를 입력해 주세요.`, slot: change.slot },
        409,
      );
    }
    newHashes.add(hash);
    rows.push({ ...toRow(change.slot), code_hash: hash });
    issued.push({ slot: change.slot, label: slotLabel(change.slot), code });
  }

  // 2) 한 트랜잭션으로 저장한다. 하나라도 실패하면 전부 되돌려진다.
  const { error } = await db.rpc("change_codes", { p_changes: rows });
  if (error) {
    if (error.code === "23505") {
      return reply({ ok: false, code: "duplicate", message: "다른 칸에서 이미 쓰는 코드가 있습니다. 코드를 바꿔 다시 시도해 주세요." }, 409);
    }
    // 코드 원문·해시는 로그에 남기지 않는다
    console.error("[PUT /api/codes] 저장 실패:", error.code);
    return reply({ ok: false, code: "server_error", message: "저장하지 못했습니다. 아무 코드도 바뀌지 않았습니다. 잠시 후 다시 시도해 주세요." }, 500);
  }

  // 3) 부서용 코드를 바꿨다면, 지금 쓰는 사람의 쿠키도 옛 버전이 되어 버렸으므로 새 버전으로 다시 심는다
  if (slots.includes("dept")) {
    const { data: dept } = await db.from("access_codes").select("version").eq("role", "dept").maybeSingle();
    if (dept) await createSession({ role: "dept", officeId: null, version: dept.version });
  }

  return reply({ ok: true, issued }, 200);
}
