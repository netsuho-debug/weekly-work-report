// Design Ref: §1-1 입장 화면 `/`
// Plan SC: 작업 13 접속 코드 입장
//
// 이미 입장한 사람(유효한 쿠키)이 열면 자기 화면으로 바로 보낸다: 청사 → /report, 부서 → /dashboard.
// 쿠키를 읽는 일은 요청 때마다 해야 하므로 Suspense 안에서 하고(Next 문서: 08-caching.md),
// 기다리는 동안에도 같은 입력 칸을 보여 줘서 화면이 깜빡이지 않게 한다.

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import CodeForm from "@/components/CodeForm";
import { readSession } from "@/lib/session";

function EntryShell() {
  return (
    <main className="flex w-full flex-1 flex-col">
      {/* 남색 안내 띠: 한국자산관리공사 누리집의 "서비스 바로가기" 구역처럼 진한 남색 바탕에 흰 글씨 */}
      <section className="bg-brand-dark text-white">
        <header className="mx-auto w-full max-w-sm space-y-2 px-4 py-10">
          <h1 className="text-2xl font-bold">사업장별 주간 공사·작업 현황</h1>
          <p className="text-sm font-medium text-white">발급받은 접속 코드를 입력해 주세요.</p>
          <ul className="space-y-1 text-sm text-white/80">
            <li>
              <strong className="font-semibold text-white">사업장 코드</strong> → 우리 사업장 보고 작성
            </li>
            <li>
              <strong className="font-semibold text-white">부서용 코드</strong> → 전체 사업장 현황 확인
            </li>
          </ul>
        </header>
      </section>
      <div className="mx-auto w-full max-w-sm space-y-4 px-4 py-8">
        <CodeForm />
        <p className="text-xs text-zinc-500">
          코드를 잊었거나 다른 사람에게 알려졌다면 중부개발처 자산관리팀에 문의해 코드를 다시 받으세요.
        </p>
      </div>
    </main>
  );
}

async function EntryGate() {
  await connection();
  const session = await readSession();
  if (session) redirect(session.role === "dept" ? "/dashboard" : "/report");
  return <EntryShell />;
}

export default function Home() {
  return (
    <Suspense fallback={<EntryShell />}>
      <EntryGate />
    </Suspense>
  );
}
