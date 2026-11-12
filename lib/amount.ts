// Design Ref: §1-2 금액 칸 / §2-2 엑셀 — 금액 표시 규칙 (PRD 5장)
// - 화면에는 `1,500,000원`처럼 쉼표를 넣어 보여 준다.
// - "다음 주 예정 작업"의 금액을 비우면 "미정"으로 표시한다.

/** 금액이 정해지지 않았을 때 보여 주는 말 (다음 주 예정 작업, 금액 비움) */
export const AMOUNT_UNDECIDED = "미정";

/** 숫자에 세 자리마다 쉼표를 넣는다. 예: 1500000 → "1,500,000" */
export function formatNumberWithComma(n: number): string {
  return n.toLocaleString("en-US");
}

/** 화면 표시용: 1500000 → "1,500,000원", 비어 있으면(null) "미정" */
export function formatWon(amount: number | null): string {
  return amount === null ? AMOUNT_UNDECIDED : `${formatNumberWithComma(amount)}원`;
}

/** 입력 글자가 올바른 금액이면 숫자로, 비었거나 잘못됐으면 null (미리보기용. 오류 판단은 schema.ts 가 한다) */
export function amountTextToNumber(raw: string): number | null {
  const compact = raw.replace(/[,\s]/g, "");
  if (!/^\d+$/.test(compact)) return null;
  const n = Number(compact);
  return Number.isSafeInteger(n) ? n : null;
}

/**
 * 입력 칸에 적힌 글자를 보기 좋게 다듬는다 (입력 칸을 벗어날 때 사용).
 * - 숫자(와 쉼표)뿐이면: 앞의 0을 정리하고 쉼표를 다시 넣는다. "0150000" → "150,000"
 * - 그 밖의 글자가 섞여 있으면: 고치지 않고 그대로 둔다 (검사에서 오류로 알려 준다)
 */
export function formatAmountInput(raw: string): string {
  const compact = raw.replace(/[,\s]/g, "");
  if (compact === "" || !/^\d+$/.test(compact)) return raw.trim();
  const digits = compact.replace(/^0+(?=\d)/, "");
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}
