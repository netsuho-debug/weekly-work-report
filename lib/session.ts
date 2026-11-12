// Design Ref: §6 접근 권한 규칙 — "청사 번호는 요청 내용이 아니라 쿠키에서만 가져온다."
// Plan SC: 작업 13 접속 코드 입장
//
// 접속 코드가 맞으면 "누가 들어왔는지"를 서명된 쿠키(JWT)에 담아 둔다. 로그인(개인 계정)이 아니라 코드 확인표다.
//  - 쿠키 내용: 역할(청사/부서) + 청사 번호 + 코드 버전. HttpOnly(자바스크립트로 못 읽음), 유효 12시간.
//  - 서명(SESSION_SECRET)이 맞아야만 믿는다. 고치거나 만들어 낸 쿠키는 거절된다.
//  - 코드를 바꾸면(version +1) 이미 발급된 쿠키는 즉시 무효가 된다 — 매 요청마다 DB 의 현재 version 과 대조한다.

import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";
import { cache } from "react";
import { z } from "zod";
import { getDb } from "./db";

export const SESSION_COOKIE = "wr_session";
/** 쿠키 유효 시간: 12시간 (DESIGN §2-3) */
const SESSION_HOURS = 12;

export type Role = "office" | "dept";

export type Session = {
  role: Role;
  /** 사업장 코드로 들어왔으면 청사 번호, 부서용이면 null */
  officeId: number | null;
  /** 이 쿠키를 만들 때의 접속 코드 버전 */
  version: number;
};

const payloadSchema = z.object({
  role: z.enum(["office", "dept"]),
  officeId: z.number().int().nullable(),
  v: z.number().int(),
});

function secretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    // 값 자체는 메시지에 넣지 않는다
    throw new Error("SESSION_SECRET 이 .env 에 없거나 너무 짧습니다.");
  }
  return new TextEncoder().encode(secret);
}

/** 쿠키에 넣을 도장 찍힌 값을 만든다 */
export async function signSession(session: Session): Promise<string> {
  return new SignJWT({ role: session.role, officeId: session.officeId, v: session.version })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

/** 입장에 성공했을 때 쿠키를 심는다 (API 라우트에서 부른다) */
export async function createSession(session: Session): Promise<void> {
  const token = await signSession(session);
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true, // 자바스크립트로 읽을 수 없다
    secure: process.env.NODE_ENV === "production", // 배포 환경에서는 https 에서만
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 60 * 60,
  });
}

/** [나가기]: 쿠키를 지운다 */
export async function clearSession(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * 지금 요청의 접속 정보를 읽는다. 쿠키가 없거나, 서명이 틀리거나, 기한이 지났거나,
 * 접속 코드가 그 뒤에 바뀌었으면(버전이 다름) null.
 * 한 요청 안에서 여러 번 불러도 DB 확인은 한 번만 한다(cache).
 */
export const readSession = cache(async (): Promise<Session | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  let session: Session;
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const parsed = payloadSchema.safeParse(payload);
    if (!parsed.success) return null;
    session = { role: parsed.data.role, officeId: parsed.data.officeId, version: parsed.data.v };
  } catch {
    return null; // 서명 불일치·기한 만료·깨진 값
  }

  // 역할과 청사 번호의 짝이 맞는지 (사업장 코드면 번호 필수, 부서용이면 번호 없음)
  if ((session.role === "office") !== (session.officeId !== null)) return null;

  // 코드가 바뀌었는지: 지금 DB 의 버전과 같아야 한다
  let query = getDb().from("access_codes").select("version").eq("role", session.role);
  query = session.officeId === null ? query.is("office_id", null) : query.eq("office_id", session.officeId);
  const { data, error } = await query.maybeSingle();
  if (error || !data || data.version !== session.version) return null;

  return session;
});

/** 부서용 코드로 들어온 사람인지 (현황판·엑셀·접속 코드 변경을 볼 수 있는 사람) */
export async function isDeptSession(): Promise<boolean> {
  return (await readSession())?.role === "dept";
}

/** 사업장 코드로 들어온 사람의 청사 번호. 아니면 null */
export async function getSessionOfficeId(): Promise<number | null> {
  const session = await readSession();
  return session?.role === "office" ? session.officeId : null;
}
