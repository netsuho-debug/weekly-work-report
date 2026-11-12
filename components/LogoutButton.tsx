"use client";

// Design Ref: §2-3 "[나가기] 버튼 → DELETE /api/auth 로 쿠키 삭제 후 입장 화면"
// 공용 컴퓨터에서 쓴 뒤 다음 사람이 이어서 들어오지 못하게 한다.

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      await fetch("/api/auth", { method: "DELETE" });
    } finally {
      // 쿠키 삭제에 실패했더라도 입장 화면으로 보낸다 (남아 있는 쿠키는 12시간 뒤 저절로 만료된다)
      router.replace("/");
      // 쿠키가 바뀌었으니, 이전 화면에 대한 브라우저의 기억(캐시)을 버리고 서버에서 새로 받는다
      router.refresh();
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-xs font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-800"
    >
      나가기
    </button>
  );
}
