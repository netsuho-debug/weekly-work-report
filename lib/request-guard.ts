// 보안 점검 보완: 다른 사이트가 방문자 브라우저를 시켜 우리 API 를 몰래 부르는 것(CSRF)을 막는다.
// 특히 /api/auth 는 틀린 시도를 대신 보내 방문자 IP 를 잠그는 데 쓰일 수 있으므로, 시도를 기록하기 "전에" 확인한다.
//
// 브라우저는 다른 사이트에서 보낸 요청에 Sec-Fetch-Site(또는 Origin) 헤더를 반드시 붙인다.
// 이 헤더가 우리 사이트와 같지 않으면 거절한다. 헤더가 아예 없으면(curl 같은 도구) 브라우저가 아니므로
// CSRF 대상이 아니라서 통과시킨다 (쿠키를 실어 보내는 쪽은 브라우저뿐이다).

/** 같은 사이트에서 온 요청인지 */
export function isSameOrigin(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site !== null) return site === "same-origin";

  const origin = request.headers.get("origin");
  if (origin !== null) {
    const host = request.headers.get("host");
    try {
      return host !== null && new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return true;
}

/** 본문이 JSON 으로 선언되어 있는지 (text/plain 폼으로 몰래 보내는 것을 막는다) */
export function isJsonRequest(request: Request): boolean {
  return (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json");
}

/** 쓰기 요청(POST·PUT·DELETE)이 믿을 만한지. 아니면 403 응답을, 괜찮으면 null 을 돌려준다 */
export function rejectUntrusted(request: Request, options: { json: boolean }): Response | null {
  if (!isSameOrigin(request) || (options.json && !isJsonRequest(request))) {
    return Response.json(
      { ok: false, code: "forbidden", message: "허용되지 않은 요청입니다." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    );
  }
  return null;
}
