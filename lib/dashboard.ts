// Design Ref: §2-2 현황판 — GET /api/dashboard 와 같은 일을 서버 화면이 직접 한다 (별도 API 없이 서버에서 바로 읽음)
// Plan SC: 작업 9 (청사별 상태) · 작업 10 (작업별 금액·합계) · 작업 11 (주차 선택)
// 보고 입력 화면도 "내 청사의 이번 주 보고"를 여기서 읽는다 (DESIGN §1-2 "이미 낸 보고를 불러와 고치기")

import "server-only";
import { getDb } from "./db";
import { getOfficeById, OFFICES } from "./offices";
import { buildStatusRows, type OfficeStatusRow, type ReportSummary } from "./status";

const REPORT_COLUMNS =
  "office_id, is_late, submitted_at, this_week_none, next_week_none, " +
  "report_items(section, seq, title, content, amount)";

/** 그 주(월요일 날짜)의 보고를 읽는다. officeId 를 주면 그 청사 것만 읽는다 */
async function fetchReports(weekStart: string, officeId?: number): Promise<ReportSummary[]> {
  let query = getDb().from("reports").select(REPORT_COLUMNS).eq("week_start", weekStart);
  if (officeId !== undefined) query = query.eq("office_id", officeId);
  const { data, error } = await query.returns<ReportSummary[]>();

  if (error) {
    // 보고 내용은 읽지도 않고, 로그에도 남기지 않는다
    console.error("[보고 조회] 보고 읽기 실패:", error.code);
    throw new Error("보고 데이터를 읽지 못했습니다.");
  }
  return data ?? [];
}

/** 그 주(월요일 날짜)의 청사 13곳 제출 상태를 읽어 온다. 보고가 없는 청사도 "미제출"(마감 뒤에는 "제출지연")로 포함된다 */
export async function fetchStatusRows(weekStart: string): Promise<OfficeStatusRow[]> {
  return buildStatusRows(OFFICES, await fetchReports(weekStart), weekStart, new Date());
}

/** 청사 한 곳의 그 주 보고 (없으면 상태가 "미제출"인 줄) */
export async function fetchOfficeStatus(officeId: number, weekStart: string): Promise<OfficeStatusRow> {
  const office = getOfficeById(officeId);
  if (!office) throw new Error("없는 청사 번호입니다.");
  return buildStatusRows([office], await fetchReports(weekStart, officeId), weekStart, new Date())[0];
}
