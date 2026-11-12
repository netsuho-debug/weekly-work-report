// Design Ref: §5 lib/offices.ts, §3 offices 표 — 청사 13곳은 고정 목록이다.
// 실제 청사 이름이 정해지면 이 파일의 NAME 만 바꾸면 된다. (PRD 6장: 임시 이름 1청사~13청사)

/** 청사 한 곳 */
export type Office = {
  /** 청사 번호 (1~13). 접속 코드와 보고 데이터가 이 번호로 연결된다 */
  readonly id: number;
  /** 화면·엑셀에 보이는 이름 */
  readonly name: string;
};

/** 관할 청사 수 (고정) */
export const OFFICE_COUNT = 13;

/** 청사 13곳 목록 (1청사 ~ 13청사). 순서는 항상 번호 순서다 */
export const OFFICES: readonly Office[] = Object.freeze(
  Array.from({ length: OFFICE_COUNT }, (_, i) =>
    Object.freeze({ id: i + 1, name: `${i + 1}청사` }),
  ),
);

/** 번호가 1~13 사이 정수인지 확인한다 */
export function isValidOfficeId(id: unknown): id is number {
  return Number.isInteger(id) && (id as number) >= 1 && (id as number) <= OFFICE_COUNT;
}

/** 번호로 청사를 찾는다. 없는 번호면 undefined */
export function getOfficeById(id: number): Office | undefined {
  return isValidOfficeId(id) ? OFFICES[id - 1] : undefined;
}
