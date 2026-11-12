// Design Ref: §2-2 엑셀 / §5 api/export/route.ts
// Plan SC: 작업 12 "엑셀 내려받기 — 작업 1건당 1행, 6개 열, 미제출·작업 없음도 1행씩"
//
// GET /api/export?week=YYYY-MM-DD — 그 주의 현황을 엑셀 파일(.xlsx)로 내려 준다. 부서용 접속만 가능하다.
// 주차는 현황판과 같은 규칙(resolveWeekParam)으로 정리한다: 틀리거나 미래면 이번 주.

import { fetchStatusRows } from "@/lib/dashboard";
import { buildWeeklyWorkbook } from "@/lib/excel";
import { isDeptSession } from "@/lib/session";
import { resolveWeekParam } from "@/lib/week";

const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function GET(request: Request) {
  if (!(await isDeptSession())) {
    return Response.json(
      { ok: false, message: "부서용 접속 코드로 입장해 주세요." },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  }

  const weekStart = resolveWeekParam(new URL(request.url).searchParams.getAll("week"));

  let file: Buffer;
  try {
    file = await buildWeeklyWorkbook(weekStart, await fetchStatusRows(weekStart));
  } catch (error) {
    // 보고 내용은 로그에 남기지 않는다
    console.error("[GET /api/export] 엑셀 만들기 실패:", error instanceof Error ? error.message : "알 수 없는 오류");
    return Response.json(
      { ok: false, message: "엑셀 파일을 만들지 못했습니다. 잠시 후 다시 시도해 주세요." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }

  // 파일 이름: 한글을 안전하게 담기 위해 영문 이름(filename)과 한글 이름(filename*)을 함께 보낸다
  const koreanName = encodeURIComponent(`주간현황_${weekStart}.xlsx`);
  return new Response(new Uint8Array(file), {
    status: 200,
    headers: {
      "Content-Type": XLSX_TYPE,
      "Content-Disposition": `attachment; filename="weekly-report_${weekStart}.xlsx"; filename*=UTF-8''${koreanName}`,
      "Cache-Control": "no-store",
    },
  });
}
