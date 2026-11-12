// Design Ref: §4-2 ExcelJS — 현황 데이터를 진짜 엑셀(.xlsx) 파일로 만든다.
// Plan SC: 작업 12. 행을 어떻게 펼칠지는 export-rows.ts 가 정하고, 여기서는 파일 모양만 만든다.

import "server-only";
import ExcelJS from "exceljs";
import { EXPORT_HEADERS, buildExportRows } from "./export-rows";
import type { OfficeStatusRow } from "./status";

/** 금액 칸 표시 모양: 1500000 → 1,500,000원 (칸에는 숫자가 들어 있어 엑셀에서 합계 계산도 된다) */
const WON_FORMAT = '#,##0"원"';

/** 그 주의 현황을 엑셀 파일(.xlsx) 내용으로 만든다 */
export async function buildWeeklyWorkbook(
  weekStart: string,
  rows: readonly OfficeStatusRow[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(`주간현황 ${weekStart}`, {
    views: [{ state: "frozen", ySplit: 1 }], // 첫 줄(열 이름) 고정
  });

  sheet.columns = [
    { header: EXPORT_HEADERS[0], key: "office", width: 10 },
    { header: EXPORT_HEADERS[1], key: "section", width: 10 },
    { header: EXPORT_HEADERS[2], key: "title", width: 28 },
    { header: EXPORT_HEADERS[3], key: "content", width: 60 },
    { header: EXPORT_HEADERS[4], key: "amount", width: 18 },
    { header: EXPORT_HEADERS[5], key: "status", width: 12 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFEFEFEF" } };

  for (const r of buildExportRows(rows)) {
    const added = sheet.addRow(r);
    added.getCell("content").alignment = { wrapText: true, vertical: "top" };
    const amountCell = added.getCell("amount");
    if (typeof r.amount === "number") amountCell.numFmt = WON_FORMAT;
    amountCell.alignment = { horizontal: "right", vertical: "top" };
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
