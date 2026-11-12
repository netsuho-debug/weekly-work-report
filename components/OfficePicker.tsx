// Design Ref: §1-3 현황판 — "청사 선택 목록(전체 / 1청사~13청사)을 두어, 담당자가 고른 청사의 보고를 바로 펼쳐서 볼 수 있다"
// Plan SC: S4 "지난 보고를 주차·청사별로 1분 이내에 찾는다" (PRD 4장 담당자 흐름)
//
// 주차 선택과 같은 방식으로 자바스크립트 없이 동작한다: "보기" 버튼이 있는 일반 폼(GET)이고, 고른 청사는 주소(?office=N)에 남는다.

import { OFFICES } from "@/lib/offices";

type OfficePickerProps = {
  /** 지금 보고 있는 주차 (이번 주면 null — 주소에 넣지 않는다) */
  week: string | null;
  /** 고른 청사 (전체면 null) */
  officeId: number | null;
  /** 보기 방식 (이번 주 진행 사항이면 "this", 기본은 다음 주 예정 작업) */
  view?: "this" | "next";
};

export default function OfficePicker({ week, officeId, view = "next" }: OfficePickerProps) {
  return (
    <form action="/dashboard" method="get" className="flex items-center gap-2">
      {week !== null && <input type="hidden" name="week" value={week} />}
      {view === "this" && <input type="hidden" name="view" value="this" />}
      <label htmlFor="office-select" className="text-sm font-medium">
        사업장
      </label>
      <select
        // key: 주소가 바뀌어 화면만 다시 그려질 때도 목록이 지금 고른 청사를 가리키게 새로 만든다
        key={officeId ?? "all"}
        id="office-select"
        name="office"
        defaultValue={officeId === null ? "" : String(officeId)}
        className="rounded-md border border-zinc-300 bg-white px-2 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="">전체</option>
        {OFFICES.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-3 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        보기
      </button>
    </form>
  );
}
