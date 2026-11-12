// Design Ref: §5 lib/offices.ts, §3 offices 표 — 청사 13곳은 고정 목록이다.
// 이름을 바꾸려면 이 파일의 OFFICE_NAMES 만 고치면 된다. (DB 의 offices 표 이름도 함께 맞춘다)

/** 청사 한 곳 */
export type Office = {
  /** 청사 번호 (1~13). 접속 코드와 보고 데이터가 이 번호로 연결된다 */
  readonly id: number;
  /** 화면·엑셀에 보이는 이름 */
  readonly name: string;
};

/** 관할 청사 수 (고정) */
export const OFFICE_COUNT = 13;

/**
 * 사업장 13곳의 이름. 가나다순으로 1번부터 번호를 매긴다. (2026-11-12 확정, 이전 임시 이름은 1청사~13청사)
 * 번호는 접속 코드와 보고 데이터가 연결되는 기준이라, 순서를 바꾸면 코드·보고가 다른 사업장으로 옮겨 간다.
 */
const OFFICE_NAMES: readonly string[] = [
  "광주남구청", // 1
  "광주동구복합청사", // 2
  "광주통합청사", // 3
  "다목적교육관", // 4
  "대전센터", // 5
  "대전통합청사", // 6
  "무안다산마을", // 7
  "세종국책단지", // 8
  "세종다산마을", // 9
  "원주통합청사", // 10
  "익산통합청사", // 11
  "캐피탈타워", // 12
  "태안정책연수원", // 13
];

/** 사업장 13곳 목록. 순서는 항상 번호 순서다 */
export const OFFICES: readonly Office[] = Object.freeze(
  OFFICE_NAMES.map((name, i) => Object.freeze({ id: i + 1, name })),
);

/** 번호가 1~13 사이 정수인지 확인한다 */
export function isValidOfficeId(id: unknown): id is number {
  return Number.isInteger(id) && (id as number) >= 1 && (id as number) <= OFFICE_COUNT;
}

/** 번호로 청사를 찾는다. 없는 번호면 undefined */
export function getOfficeById(id: number): Office | undefined {
  return isValidOfficeId(id) ? OFFICES[id - 1] : undefined;
}
