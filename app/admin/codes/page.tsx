// Design Ref: §1-4 접속 코드 변경 `/admin/codes` (부서용 코드만)
// Plan SC: 작업 14 "부서용 코드로 들어온 사람이 접속 코드 14개를 바꿀 수 있게 하기"
//
// 화면 틀과 권한 확인만 서버에서 하고, 입력·저장은 CodeChangeForm(브라우저)이 PUT /api/codes 로 한다.
// 현재 코드는 해시로만 저장되어 있어 화면에 보여 줄 수 없다. (새 코드는 저장 직후 한 번만 보인다)
// 현황판과 같은 이유로 connection() 뒤에 쿠키를 읽는다 (Cache Components — Next 문서: 08-caching.md)

import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import CodeChangeForm from "@/components/CodeChangeForm";
import LogoutButton from "@/components/LogoutButton";
import { isDeptSession } from "@/lib/session";

export const metadata: Metadata = {
  title: "접속 코드 변경 | 사업장별 주간 공사·작업 현황",
};

async function CodesScreen() {
  await connection();

  // 부서용 코드로 입장한 사람만 쓸 수 있다. 아니면 입장 화면으로 보낸다.
  if (!(await isDeptSession())) redirect("/");

  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 py-8">
      <header className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          <Link href="/dashboard" className="text-sm text-brand hover:underline dark:text-sky-300">
            ← 주간 업무 보고 현황으로
          </Link>
          <h1 className="text-2xl font-bold">접속 코드 변경</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            바꿀 줄만 고른 뒤 [저장]을 누르세요. 바꾸지 않은 줄의 코드는 그대로 유지됩니다.
          </p>
        </div>
        <LogoutButton />
      </header>

      <ul className="list-disc space-y-1 rounded-md border border-amber-300 bg-amber-50 px-8 py-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
        <li>저장하면 <strong>옛 코드는 즉시 쓸 수 없게</strong> 되고, 그 코드로 들어와 있던 사람도 다시 입장해야 합니다.</li>
        <li>새 코드는 <strong>저장 직후 한 번만</strong> 보여 줍니다. 화면을 닫기 전에 받아 적어 해당 청사에 전달하세요.</li>
        <li>직접 정하는 코드는 영문 대문자·소문자·숫자를 모두 섞어 12자 이상이어야 하며, 다른 줄과 같은 코드는 쓸 수 없습니다.</li>
      </ul>

      <CodeChangeForm />
    </main>
  );
}

export default function CodesPage() {
  return (
    <Suspense fallback={<p className="p-8 text-center text-zinc-500">불러오는 중...</p>}>
      <CodesScreen />
    </Suspense>
  );
}
