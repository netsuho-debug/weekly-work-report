// Design Ref: §2-2 엑셀 행 규칙 / PRD 5장 must 2
// Plan SC: 작업 12 "작업 1건당 1행, 6개 열, 미제출·작업 없음도 1행씩 남기기"
//
// 현황판 줄(OfficeStatusRow)을 엑셀에 들어갈 행으로 펼치는 순수 계산이다.
// 파일 만들기(excel.ts)와 분리해 두어, 행 규칙만 따로 빠르게 시험할 수 있다.
//
// 행 규칙:
//  - 열 6개: 청사명 · 구분(이번 주/다음 주) · 작업명 · 내용 · 금액 · 상태
//  - 작업 1건 = 1행
//  - 구역을 "작업 없음"으로 제출했으면 작업명에 "작업 없음"을 적은 1행 (내용·금액은 빈칸)
//  - 미제출 청사는 상태 "미제출" 1행 (나머지 칸은 빈칸)
//  - 금액이 비어 있는 작업(다음 주만 가능)은 "미정"

import { AMOUNT_UNDECIDED } from "./amount";
import { STATUS_LABEL, type OfficeStatusRow, type TaskView } from "./status";

/** 엑셀 첫 줄(열 이름). 순서가 곧 열 순서다 */
export const EXPORT_HEADERS = ["사업장명", "구분", "작업명", "내용", "금액", "상태"] as const;

/** 구역 이름 */
const SECTION_LABEL = { this: "이번 주", next: "다음 주" } as const;

/** 엑셀 한 행. 금액은 숫자(원)·"미정"·빈칸 중 하나 */
export type ExportRow = {
  office: string;
  section: "이번 주" | "다음 주" | "";
  title: string;
  content: string;
  amount: number | typeof AMOUNT_UNDECIDED | "";
  status: string;
};

/**
 * 엑셀 수식 주입 방지: = + - @ 탭 줄바꿈으로 시작하는 글은 셀을 고치거나 CSV 로 바꿀 때 수식으로 실행될 수 있다.
 * 앞에 작은따옴표(')를 붙여 글자로만 보이게 한다. (보안 점검 보완)
 */
function neutralizeFormula(text: string): string {
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

/** 한 구역을 행으로 펼친다 */
function sectionRows(
  row: OfficeStatusRow,
  section: "this" | "next",
  tasks: TaskView[],
  none: boolean,
): ExportRow[] {
  const base = {
    office: row.officeName,
    section: SECTION_LABEL[section],
    status: STATUS_LABEL[row.status],
  };

  // "작업 없음"이 체크된 구역. (작업이 0건인데 체크가 없는 경우는 검사에서 막히지만, 만일을 위해 같게 다룬다)
  if (none || tasks.length === 0) {
    return [{ ...base, title: "작업 없음", content: "", amount: "" }];
  }

  return tasks.map((t) => ({
    ...base,
    title: neutralizeFormula(t.title),
    content: neutralizeFormula(t.content),
    amount: t.amount === null ? AMOUNT_UNDECIDED : t.amount,
  }));
}

/** 현황판의 13곳을 엑셀 행으로 펼친다. 청사 번호 순서이고, 청사 안에서는 이번 주 → 다음 주 순서다 */
export function buildExportRows(rows: readonly OfficeStatusRow[]): ExportRow[] {
  return rows.flatMap((row): ExportRow[] => {
    if (row.status === "missing" || row.status === "overdue") {
      return [
        {
          office: row.officeName,
          section: "",
          title: "",
          content: "",
          amount: "",
          status: STATUS_LABEL[row.status], // 마감 전 "미제출", 마감 뒤 "제출지연"
        },
      ];
    }
    return [
      ...sectionRows(row, "this", row.thisTasks, row.thisNone),
      ...sectionRows(row, "next", row.nextTasks, row.nextNone),
    ];
  });
}
