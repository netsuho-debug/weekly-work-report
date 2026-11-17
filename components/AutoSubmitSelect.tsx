"use client";

// 목록에서 고르기만 하면 바로 그 화면으로 이동하는 선택 상자 (별도의 [보기] 버튼을 없애 화면을 단순하게 한다).
// 자바스크립트가 꺼진 브라우저에서는 바로 이동하지 않으므로, 같은 폼 안에 <noscript> [보기] 버튼을 함께 둔다.

import type { SelectHTMLAttributes } from "react";

export default function AutoSubmitSelect(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} onChange={(e) => e.currentTarget.form?.requestSubmit()} />;
}
