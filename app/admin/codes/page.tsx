// Design Ref: §1-4 접속 코드 변경 `/admin/codes` (부서용 코드만)
// Plan SC: 작업 14 "부서용 코드로 들어온 사람이 접속 코드 14개를 바꿀 수 있게 하기"
//
// 화면 틀과 권한 확인만 서버에서 하고, 입력·저장은 CodeChangeForm(브라우저)이 PUT /api/codes 로 한다.
// 현재 코드는 해시로만 저장되어 있어 화면에 보여 줄 수 없다. (새 코드는 저장 직후 한 번만 보인다)
// 현황판과 같은 이유로 connection() 뒤에 쿠키를 읽는다 (Cache Components — Next 문서: 08-caching.md)
// 2026-11-18 디자인 4차: 다른 화면과 같은 틀(회색 바탕 + 둥근 남색 머리띠 + 흰 판), 남아 있던 "청사" 표현을 "사업장"으로.

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import CodeChangeForm from "@/components/CodeChangeForm";
import LogoutButton from "@/components/LogoutButton";
import { PageBand, PageShell, PANEL } from "@/components/PageShell";
import { isDeptSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "접속 코드 변경 | 청사별 주간 공사·작업 현황",
};

async function CodesScreen() {
  await connection();

  // 부서용 코드로 입장한 사람만 쓸 수 있다. 아니면 입장 화면으로 보낸다.
  if (!(await isDeptSession())) redirect("/");

  return (
    <PageShell>
      <PageBand title="접속 코드 변경" right={<LogoutButton onDark />}>
        <Link href="/dashboard" className="mt-1.5 inline-block text-sm text-sky-200 hover:text-white">
          ← 청사별 주간 작업 현황으로
        </Link>
      </PageBand>

      <ul className={`${PANEL} list-disc space-y-1 px-8 py-3 text-sm text-zinc-700`}>
        <li>바꿀 줄만 고른 뒤 아래 [저장]을 누르세요. 바꾸지 않은 줄은 그대로입니다.</li>
        <li>
          저장하면 <strong>옛 코드는 즉시 쓸 수 없게</strong> 되고, 그 코드로 들어와 있던 사람도 다시 입장해야 합니다.
        </li>
        <li>
          새 코드는 <strong>저장 직후 한 번만</strong> 보여 줍니다. 화면을 닫기 전에 받아 적어 해당 사업장에 전달하세요.
        </li>
        <li>직접 정하는 코드는 숫자 6자리이며, 다른 줄과 같은 코드는 쓸 수 없습니다.</li>
      </ul>

      <CodeChangeForm />
    </PageShell>
  );
}

export default function CodesPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-zinc-500">불러오는 중...</p>}>
      <CodesScreen />
    </Suspense>
  );
}
