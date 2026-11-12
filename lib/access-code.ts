// Design Ref: §3 access_codes / §2-3 접속 코드 — 코드를 해시하고 새로 만드는 도구
// Plan SC: 작업 13 (14번 "접속 코드 변경"도 이 파일을 쓴다)
//
// 코드 원문은 어디에도 저장하지 않는다. HMAC-SHA256(코드, CODE_PEPPER) 해시값만 DB 에 둔다.
//  - 해시는 되돌릴 수 없다. 같은 코드는 항상 같은 해시가 되므로 "입장 때 대조"와 "중복 코드 검사"가 가능하다.
//  - CODE_PEPPER 는 .env(서버 전용)에만 있는 비밀값이라, DB 가 통째로 새도 코드를 알아낼 수 없다.
// 서버와 초기 코드 생성 스크립트(scripts/seed-codes.mjs)가 함께 쓰므로 'server-only' 는 붙이지 않았다.
// (브라우저 코드에서 불러 쓰지 않는다. node:crypto 를 쓰기 때문에 브라우저 번들에는 들어갈 수 없다)

import { createHmac, randomInt } from "node:crypto";
// 코드 규칙(길이·글자 종류)은 브라우저에서도 쓰므로 code-rules.ts 에 있다.
// (이 파일은 Node 가 직접 실행하는 스크립트(scripts/seed-codes.mjs)도 불러 쓰기 때문에, 확장자 없는 상대 경로 import 를 쓰지 않는다)

/** 자동 생성에 쓰는 글자: 영문 대소문자+숫자. 읽을 때 헷갈리는 글자(0 O 1 l I)는 뺐다 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";

function getPepper(): string {
  const pepper = process.env.CODE_PEPPER;
  if (!pepper || pepper.length < 16) {
    // 값 자체는 메시지에 넣지 않는다
    throw new Error("CODE_PEPPER 가 .env 에 없거나 너무 짧습니다.");
  }
  return pepper;
}

/** 코드를 해시한다. 앞뒤 공백은 무시하고, 대소문자는 구분한다 */
export function hashCode(code: string): string {
  return createHmac("sha256", getPepper()).update(code.trim()).digest("hex");
}

/**
 * 암호학적 난수로 접속 코드를 만든다 (치우침 없이 글자를 고른다).
 * length 기본값 12 는 code-rules.ts 의 GENERATED_CODE_LENGTH 와 같다.
 */
export function generateCode(length: number = 12): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return out;
}

