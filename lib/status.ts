// Design Ref: §1-3 현황판 — "13곳은 제출 여부와 관계없이 항상 전부 표시, 상태는 제출 / 지각 제출 / 미제출"
// Plan SC: 작업 9 (청사별 상태) · 작업 10 (이번 주 작업별 금액과 합계, 다음 주 금액은 합계에서 제외)
//
// 저장된 보고(없을 수도 있음)를 청사 13곳 목록에 붙여서 청사별 줄을 만드는 순수 계산이다.
// DB·서버 전용 코드를 쓰지 않으므로 어디서든(시험 포함) 그대로 부를 수 있다.

import type { Office } from "./offices";
import { isLate } from "./week";

/** 청사 하나의 이번 주 제출 상태 */
export type SubmissionStatus = "submitted" | "late" | "missing" | "overdue";

/**
 * 화면에 보이는 상태 이름 (2026-11-12 변경)
 * - 마감 뒤에 낸 보고도 "제출 완료"로 보여 준다. (기록은 late 로 남아 있어 구분이 필요하면 쓸 수 있다)
 * - 보고가 없는 청사: 제출 마감 전까지는 "미제출", 마감이 지나면 "제출지연"
 */
export const STATUS_LABEL: Record<SubmissionStatus, string> = {
  submitted: "제출 완료",
  late: "제출 완료",
  missing: "미제출",
  overdue: "제출지연",
};

/** DB 에서 읽어 온 작업 한 건 */
export type ReportItemRow = {
  section: "this" | "next";
  seq: number;
  title: string;
  content: string;
  /** 원. 비어 있으면(다음 주만 가능) null → "미정" */
  amount: number | null;
};

/** DB 에서 읽어 온 보고 한 건 (작업 행 포함) */
export type ReportSummary = {
  office_id: number;
  is_late: boolean;
  /** 마지막 제출 시각 (ISO 문자열) */
  submitted_at: string;
  this_week_none: boolean;
  next_week_none: boolean;
  report_items: ReportItemRow[];
};

/** 화면에 보여 줄 작업 한 건 */
export type TaskView = {
  title: string;
  content: string;
  amount: number | null;
};

/** 현황판 한 줄 (청사 하나) */
export type OfficeStatusRow = {
  officeId: number;
  officeName: string;
  status: SubmissionStatus;
  /** 마지막 제출 시각 (ISO 문자열). 미제출이면 null */
  submittedAt: string | null;
  /** 이번 주 진행 사항 작업들 (순서대로). 미제출이면 빈 배열 */
  thisTasks: TaskView[];
  /** 이번 주를 "작업 없음"으로 제출했는지 */
  thisNone: boolean;
  /** 다음 주 예정 작업 작업들 (순서대로) */
  nextTasks: TaskView[];
  /** 다음 주를 "작업 없음"으로 제출했는지 */
  nextNone: boolean;
  /**
   * 이번 주 작업 금액의 합계(원). 다음 주 금액은 넣지 않는다.
   * 미제출이면 null, "작업 없음"이면 0.
   * (각 금액은 안전한 정수로 검사되어 저장된다. 합계가 정수 한계를 넘는 건 수백조 원 이상이라 다루지 않는다)
   */
  thisTotal: number | null;
};

const bySeq = (a: ReportItemRow, b: ReportItemRow) => a.seq - b.seq;
const toView = ({ title, content, amount }: ReportItemRow): TaskView => ({ title, content, amount });

/**
 * 청사 목록(항상 13곳 전체)에 보고를 붙여 줄을 만든다.
 * - 보고가 없는 청사도 빠짐없이 남긴다. 그 주의 제출 마감 전이면 "미제출", 마감이 지났으면 "제출지연"
 *   (지난 주차는 마감이 이미 지났으므로 "제출지연"이다)
 * - 같은 청사 보고가 여러 건이어도(있어서는 안 되지만) 가장 최근 제출을 쓴다.
 * - 청사 목록에 없는 번호의 보고는 무시한다.
 * weekStart: 보고 있는 주차(월요일 날짜), now: 지금 시각 (시험 때 시계를 돌리지 않고 넣을 수 있게 밖에서 받는다)
 */
export function buildStatusRows(
  offices: readonly Office[],
  reports: readonly ReportSummary[],
  weekStart: string,
  now: Date,
): OfficeStatusRow[] {
  const missingStatus: SubmissionStatus = isLate(now, weekStart) ? "overdue" : "missing";
  const latest = new Map<number, ReportSummary>();
  for (const r of reports) {
    const prev = latest.get(r.office_id);
    if (!prev || Date.parse(r.submitted_at) > Date.parse(prev.submitted_at)) {
      latest.set(r.office_id, r);
    }
  }

  return offices.map((office): OfficeStatusRow => {
    const report = latest.get(office.id);
    if (!report) {
      return {
        officeId: office.id,
        officeName: office.name,
        status: missingStatus,
        submittedAt: null,
        thisTasks: [],
        thisNone: false,
        nextTasks: [],
        nextNone: false,
        thisTotal: null,
      };
    }

    const items = [...report.report_items].sort(bySeq);
    const thisTasks = items.filter((i) => i.section === "this").map(toView);
    const nextTasks = items.filter((i) => i.section === "next").map(toView);

    return {
      officeId: office.id,
      officeName: office.name,
      status: report.is_late ? "late" : "submitted",
      submittedAt: report.submitted_at,
      thisTasks,
      thisNone: report.this_week_none,
      nextTasks,
      nextNone: report.next_week_none,
      // 이번 주 금액만 더한다. 다음 주 금액은 합계에 넣지 않는다 (PRD 5장)
      thisTotal: thisTasks.reduce((sum, t) => sum + (t.amount ?? 0), 0),
    };
  });
}

/** 상태별 청사 수 */
export function countStatuses(rows: readonly OfficeStatusRow[]): Record<SubmissionStatus, number> {
  const counts: Record<SubmissionStatus, number> = { submitted: 0, late: 0, missing: 0, overdue: 0 };
  for (const row of rows) counts[row.status] += 1;
  return counts;
}

/** 13곳 이번 주 금액의 총합계 (미제출 청사는 0으로 본다. 다음 주 금액은 제외) */
export function sumThisWeek(rows: readonly OfficeStatusRow[]): number {
  return rows.reduce((sum, row) => sum + (row.thisTotal ?? 0), 0);
}
