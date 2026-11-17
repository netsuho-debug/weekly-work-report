// Design Ref: §1-3 현황판 — "청사 선택 목록(전체 / 1청사~13청사)을 두어, 담당자가 고른 청사의 보고를 바로 펼쳐서 볼 수 있다"
// Plan SC: S4 "지난 보고를 주차·청사별로 1분 이내에 찾는다" (PRD 4장 담당자 흐름)
//
// 주차 목록과 같은 방식: 일반 폼(GET)이고 고르면 바로 이동한다. 고른 사업장은 주소(?office=N)에 남는다.
// 자바스크립트가 꺼졌을 때만 [보기] 버튼이 보인다.

import { OFFICES } from "@/lib/offices";
import AutoSubmitSelect from "./AutoSubmitSelect";
import { noscriptButtonClass, selectClass } from "./WeekPicker";

type OfficePickerProps = {
  /** 지금 보고 있는 주차 (이번 주면 null — 주소에 넣지 않는다) */
  week: string | null;
  /** 고른 사업장 (전체면 null) */
  officeId: number | null;
  /** 보기 방식 (기본은 이번 주 작업 내용, 다음 주 예정 작업이면 "next") */
  view?: "this" | "next";
};

export default function OfficePicker({ week, officeId, view = "this" }: OfficePickerProps) {
  return (
    <form action="/dashboard" method="get" className="flex min-w-0 items-center gap-2">
      {week !== null && <input type="hidden" name="week" value={week} />}
      {view === "next" && <input type="hidden" name="view" value="next" />}
      <label htmlFor="office-select" className="sr-only">
        사업장 고르기
      </label>
      <AutoSubmitSelect
        // key: 주소가 바뀌어 화면만 다시 그려질 때도 목록이 지금 고른 사업장을 가리키게 새로 만든다
        key={officeId ?? "all"}
        id="office-select"
        name="office"
        defaultValue={officeId === null ? "" : String(officeId)}
        className={selectClass}
      >
        <option value="">전체 목록</option>
        {OFFICES.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </AutoSubmitSelect>
      <noscript>
        <button type="submit" className={noscriptButtonClass}>
          보기
        </button>
      </noscript>
    </form>
  );
}
