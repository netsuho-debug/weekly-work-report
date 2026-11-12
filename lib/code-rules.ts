// Design Ref: §1-4 접속 코드 변경 화면 — 코드 규칙: 영문 대문자·소문자·숫자를 모두 섞은 12자 이상, 자동 생성도 12자
// Plan SC: 작업 13·14. 브라우저(입력 검사)와 서버(저장 전 검사)가 같은 규칙을 쓰도록 따로 뗐다.
// (해시·난수 같은 서버 전용 도구는 access-code.ts 에 있다. 이 파일은 브라우저에서도 불러 쓸 수 있다)
// 보안 점검 보완: 짐작하기 쉬운 코드(Office12345 같은 것)로 무차별 대입에 뚫리지 않도록 규칙을 강화했다.

/** 사람이 정하는 코드의 최소 길이 (DESIGN §1-4) */
export const CODE_MIN_LENGTH = 12;

/** 자동 생성 코드 길이 */
export const GENERATED_CODE_LENGTH = 12;

/** 코드가 규칙에 맞지 않을 때 보여 줄 문구. 맞으면 null */
export function codeRuleMessage(code: string): string | null {
  if (code.length < CODE_MIN_LENGTH) return `코드는 ${CODE_MIN_LENGTH}자 이상이어야 합니다.`;
  if (!/^[A-Za-z0-9]+$/.test(code)) return "코드는 영문 대소문자와 숫자만 쓸 수 있습니다.";
  if (!/[A-Z]/.test(code) || !/[a-z]/.test(code) || !/[0-9]/.test(code)) {
    return "코드에 영문 대문자, 소문자, 숫자를 모두 넣어 주세요.";
  }
  return null;
}
