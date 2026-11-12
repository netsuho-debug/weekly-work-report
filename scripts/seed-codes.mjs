// Design Ref: §5 scripts/seed-codes — 처음 접속 코드 14개(청사 13 + 부서용 1)를 만든다.
// (DESIGN.md 에는 seed-codes.ts 로 적혀 있지만, 실행하기 쉽게 .mjs 로 만들었다)
//
// 실행:   node --env-file=.env scripts/seed-codes.mjs
// 다시 만들기(기존 코드를 모두 새 코드로 바꿈): node --env-file=.env scripts/seed-codes.mjs --force
//
// - 코드는 암호학적 난수 12자. DB 에는 해시값만 저장하고, 코드 원문은 `.env.codes.local` 에만 적는다.
//   (이 파일은 .gitignore 의 `.env*` 규칙에 걸려 커밋되지 않는다.)
// - 화면(터미널)에는 코드를 출력하지 않는다. 코드는 .env.codes.local 파일을 열어서 확인한다.
// - --force 로 바꾸면 version 이 +1 되어, 이미 발급된 쿠키(입장 상태)가 모두 무효가 된다.

import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { generateCode, hashCode } from "../lib/access-code.ts";

const OUTPUT_FILE = ".env.codes.local";
const force = process.argv.includes("--force");

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key || !process.env.CODE_PEPPER) {
  console.error(".env 에 SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, CODE_PEPPER 가 모두 있어야 합니다.");
  console.error("실행 방법: node --env-file=.env scripts/seed-codes.mjs");
  process.exit(1);
}
const db = createClient(url, key, { auth: { persistSession: false } });

// 코드가 필요한 14곳: 부서용 1 + 사업장 1~13 (이름·순서는 lib/offices.ts 의 OFFICE_NAMES 와 같게 유지한다)
const OFFICE_NAMES = [
  "광주남구청", "광주동구복합청사", "광주통합청사", "다목적교육관", "대전센터", "대전통합청사", "무안다산마을",
  "세종국책단지", "세종다산마을", "원주통합청사", "익산통합청사", "캐피탈타워", "태안정책연수원",
];
const slots = [
  { label: "부서용", role: "dept", office_id: null },
  ...OFFICE_NAMES.map((name, i) => ({ label: `${i + 1}번 ${name}`, role: "office", office_id: i + 1 })),
];

const { data: existing, error: readError } = await db.from("access_codes").select("id, role, office_id, version");
if (readError) {
  console.error("기존 코드를 읽지 못했습니다:", readError.code);
  process.exit(1);
}
if (existing.length > 0 && !force) {
  console.error(`이미 접속 코드 ${existing.length}개가 있습니다. 모두 새 코드로 바꾸려면 --force 를 붙여 다시 실행하세요.`);
  process.exit(1);
}

// 코드 14개를 만든다 (해시가 겹치면 다시 뽑는다. 사실상 일어나지 않는다)
const issued = [];
const usedHashes = new Set();
for (const slot of slots) {
  let code;
  let hash;
  do {
    code = generateCode();
    hash = hashCode(code);
  } while (usedHashes.has(hash));
  usedHashes.add(hash);
  issued.push({ ...slot, code, hash });
}

// 저장: 이미 있는 칸은 해시를 바꾸고 version +1, 없는 칸은 새로 넣는다
for (const item of issued) {
  const prev = existing.find((e) => e.role === item.role && (e.office_id ?? null) === item.office_id);
  const result = prev
    ? await db.from("access_codes").update({ code_hash: item.hash, version: prev.version + 1 }).eq("id", prev.id)
    : await db.from("access_codes").insert({ role: item.role, office_id: item.office_id, code_hash: item.hash, version: 1 });
  if (result.error) {
    console.error(`${item.label} 코드 저장 실패:`, result.error.code);
    process.exit(1);
  }
}

// 코드 원문은 이 파일에만 적는다
const lines = [
  "# 접속 코드 (원문). 이 파일은 git 에 올라가지 않습니다. 관리소장·담당자에게 전달한 뒤 안전하게 보관하세요.",
  `# 만든 시각: ${new Date().toISOString()}`,
  ...issued.map((i) => `${i.label}=${i.code}`),
  "",
];
writeFileSync(OUTPUT_FILE, lines.join("\n"), { encoding: "utf8" });

console.log(`접속 코드 ${issued.length}개를 만들었습니다 (${force ? "기존 코드를 모두 교체" : "새로 생성"}).`);
console.log(`코드 원문은 ${OUTPUT_FILE} 파일에서 확인하세요. (화면에는 출력하지 않습니다)`);
