// Design Ref: §4-3 환경 변수 / §3 — 서버에서만 Supabase 에 접속한다.
// 서비스 열쇠(SUPABASE_SERVICE_ROLE_KEY)는 모든 보안 규칙을 건너뛰는 열쇠라서,
// 'server-only' 로 이 파일이 브라우저 코드에 섞여 들어가면 빌드가 실패하게 막아 둔다.
// (NEXT_PUBLIC_ 변수에는 절대 넣지 않는다. CLAUDE.md 5장)

import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

/** 서버 전용 Supabase 연결을 돌려준다 (처음 부를 때 한 번만 만든다) */
export function getDb(): SupabaseClient {
  if (client) return client;

  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    // 값 자체는 절대 메시지에 넣지 않는다
    throw new Error("SUPABASE_URL 또는 SUPABASE_SERVICE_ROLE_KEY 가 .env 에 없습니다.");
  }

  client = createClient(url, serviceKey, {
    // 사용자 로그인을 쓰지 않으므로 세션을 저장·갱신하지 않는다
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
