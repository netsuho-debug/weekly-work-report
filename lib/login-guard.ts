// Design Ref: §2-3 "5회 틀리면 15분 잠금" / DESIGN 11번 보완: IP 는 x-forwarded-for 첫 값, 잠금은 IP 단위
// Plan SC: 작업 13 — 코드를 무차별로 넣어 보는 것을 막는다

import "server-only";
import { getDb } from "./db";

/** 이 횟수만큼 틀리면 잠근다 */
export const MAX_FAILURES = 5;
/** 잠금 시간. 5번째로 틀린 때(가장 최근 실패)부터 센다 */
export const LOCK_MINUTES = 15;

/**
 * 요청에서 접속한 곳의 IP 를 읽는다. Vercel 이 넣어 주는 x-forwarded-for 의 "첫 값"이 실제 접속자다.
 * 값이 없으면 "unknown" 으로 묶는다 (그 경우 모두가 같은 칸을 쓰게 된다).
 */
export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  // 기록 칸이 터무니없이 커지지 않게 길이를 제한한다
  return first ? first.slice(0, 64) : "unknown";
}

const LOCK_MS = LOCK_MINUTES * 60_000;

/**
 * 입장 시도를 "먼저" 기록하고(예약), 그 시도 앞에 실패가 몇 건 쌓여 있는지로 잠금을 판단한다.
 * 확인과 기록을 따로 하면, 동시에 보낸 요청이 모두 확인을 통과해 버린다 (DESIGN §2-3).
 * 기록 번호(id)는 DB 가 순서대로 매기므로, "내 앞의 5건"은 동시 요청에서도 서로 다르게 보인다.
 *
 * 결과
 * - locked : 이미 잠겨 있음. 이 시도의 기록은 지웠다(잠금을 늘리지 않는다). 코드를 대조하지 않는다.
 * - allowed: 대조해도 된다. 틀리면 이 기록이 그대로 실패 기록이 되고, 맞으면 release() 로 지운다.
 * - error  : 확인 실패. 모르는 채로 시도를 허용하지 않는다(잠그는 쪽으로 판단).
 *
 * "15분 안에 5번 틀리면, 5번째로 틀린 때부터 15분 동안 잠금" 규칙은 그대로다.
 * 맞는 코드로 들어와도 앞선 실패 기록은 지우지 않는다 ("4번 틀리고 1번 맞히기"로 제한을 피하지 못하게).
 */
export type Attempt =
  | { state: "allowed"; release: () => Promise<void> }
  | { state: "locked" }
  | { state: "error" };

export async function beginAttempt(ip: string): Promise<Attempt> {
  const db = getDb();
  const { data: mine, error: insertError } = await db
    .from("login_attempts")
    .insert({ ip })
    .select("id")
    .single();
  if (insertError || !mine) {
    console.error("[접속] 시도 기록 실패:", insertError?.code);
    return { state: "error" };
  }
  const myId = mine.id as number;
  const remove = async () => {
    const { error } = await db.from("login_attempts").delete().eq("id", myId);
    if (error) console.error("[접속] 시도 기록 삭제 실패:", error.code);
  };

  const { data, error } = await db
    .from("login_attempts")
    .select("tried_at")
    .eq("ip", ip)
    .lt("id", myId)
    .order("id", { ascending: false })
    .limit(MAX_FAILURES);
  if (error || !data) {
    console.error("[접속] 시도 횟수 확인 실패:", error?.code);
    await remove();
    return { state: "error" };
  }

  if (data.length >= MAX_FAILURES) {
    const newest = Date.parse(data[0].tried_at as string);
    const oldestOfFive = Date.parse(data[MAX_FAILURES - 1].tried_at as string);
    if (newest - oldestOfFive <= LOCK_MS && Date.now() - newest < LOCK_MS) {
      await remove();
      return { state: "locked" };
    }
  }
  return { state: "allowed", release: remove };
}

/** 하루 지난 기록을 지운다 (입장 시도가 끝날 때 가끔 부른다) */
export async function purgeOldAttempts(): Promise<void> {
  await getDb()
    .from("login_attempts")
    .delete()
    .lt("tried_at", new Date(Date.now() - 24 * 60 * 60_000).toISOString());
}
