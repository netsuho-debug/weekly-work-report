// 2026-11-18 디자인 4차: 모든 화면(입장·보고 입력·현황·코드 변경)이 같은 틀을 쓰도록 공통 부품으로 뗐다.
//   연한 회색 바탕 + 둥근 남색 머리띠(PageBand) + 흰 판(PANEL)
// 디자인 규칙 (모든 화면 공통)
//   색: 남색(brand / brand-dark) · 회색(zinc) · 주황(예외·알림) · 빨강(오류) 네 가지만
//   글자: 제목(머리띠 text-lg~2xl 굵게) · 본문(text-sm~base) · 보조(text-xs 회색) 세 단계
//   모서리: 큰 판 rounded-2xl, 버튼·입력 칸 rounded-lg / 여백: 판 안쪽 px-4 sm:px-6

import type { ReactNode } from "react";

/** 흰 판 공통 모양 */
export const PANEL = "rounded-2xl border border-zinc-200 bg-white";

/** 머리띠 안 작은 보조 버튼 (흰 테두리) */
export const BAND_BUTTON =
  "whitespace-nowrap rounded-md border border-white/40 px-2.5 py-1 text-xs font-medium text-white hover:bg-white/10";

/** 화면 바탕: 연한 회색 + 가운데 정렬된 본문 폭 */
export function PageShell({ children, width = "md" }: { children: ReactNode; width?: "sm" | "md" | "lg" }) {
  const max = width === "sm" ? "max-w-sm" : width === "lg" ? "max-w-3xl" : "max-w-2xl";
  return (
    <div className="flex-1 bg-zinc-100">
      <main className={`mx-auto w-full ${max} space-y-3 px-4 py-5 sm:space-y-4 sm:py-8`}>{children}</main>
    </div>
  );
}

/** 둥근 남색 머리띠: 제목 + 오른쪽 버튼, 아래에 자유 내용 */
export function PageBand({ title, right, children }: { title: ReactNode; right?: ReactNode; children?: ReactNode }) {
  return (
    <header className="rounded-2xl bg-brand-dark px-4 py-4 text-white sm:px-6 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <h1 className="min-w-0 text-lg font-bold sm:text-2xl">{title}</h1>
        {right}
      </div>
      {children}
    </header>
  );
}
