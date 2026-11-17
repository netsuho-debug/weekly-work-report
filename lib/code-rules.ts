// Design Ref: §1-4 접속 코드 변경 화면 — 코드 규칙: 숫자 6자리 (자동 생성도 숫자 6자리)
// Plan SC: 작업 13·14. 브라우저(입력 검사)와 서버(저장 전 검사)가 같은 규칙을 쓰도록 따로 뗐다.
// (해시·난수 같은 서버 전용 도구는 access-code.ts 에 있다. 이 파일은 브라우저에서도 불러 쓸 수 있다)
// 2026-11-13 변경: 외우기 쉽게 숫자 6자리로 줄였다. 대신 짐작 공격을 막는 것은 "시도 제한(IP당 15분 5회)"과
// Vercel Firewall 속도 제한이 맡는다. (이전 규칙: 영문 대·소문자·숫자 12자 이상)

/** 접속 코드 길이 (사람이 정하는 코드도, 자동 생성 코드도 같다) */
export const CODE_LENGTH = 6;

/** 자동 생성 코드 길이 */
export const GENERATED_CODE_LENGTH = CODE_LENGTH;

/** 코드가 규칙에 맞지 않을 때 보여 줄 문구. 맞으면 null */
export function codeRuleMessage(code: string): string | null {
  if (!/^\d+$/.test(code)) return "코드는 숫자만 쓸 수 있습니다.";
  if (code.length !== CODE_LENGTH) return `코드는 숫자 ${CODE_LENGTH}자리여야 합니다.`;
  return null;
}
