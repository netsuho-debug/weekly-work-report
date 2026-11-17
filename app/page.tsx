// Design Ref: §1-1 입장 화면 `/`
// Plan SC: 작업 13 접속 코드 입장
//
// 이미 입장한 사람(유효한 쿠키)이 열면 자기 화면으로 바로 보낸다: 사업장 → /report, 부서 → /dashboard.
// 쿠키를 읽는 일은 요청 때마다 해야 하므로 Suspense 안에서 하고(Next 문서: 08-caching.md),
// 기다리는 동안에도 같은 입력 칸을 보여 줘서 화면이 깜빡이지 않게 한다.
// 2026-11-18 디자인 4차: 다른 화면과 같은 틀(회색 바탕 + 둥근 남색 머리띠 + 흰 판)로 맞췄다.

import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import CodeForm from "@/components/CodeForm";
import { PageBand, PageShell, PANEL } from "@/components/PageShell";
import { readSession } from "@/lib/session";

function EntryShell() {
  return (
    <PageShell width="sm">
      <PageBand title="청사별 주간 공사·작업 현황">
        <ul className="mt-3 space-y-1 text-sm text-sky-100">
          <li>
            <strong className="font-semibold text-white">사업장 코드</strong> → 우리 사업장 보고 작성
          </li>
          <li>
            <strong className="font-semibold text-white">부서용 코드</strong> → 전체 사업장 현황 확인
          </li>
        </ul>
      </PageBand>
      <div className={`${PANEL} space-y-4 px-4 py-5 sm:px-6`}>
        <CodeForm />
        <p className="text-xs text-zinc-500">
          코드를 잊었거나 다른 사람에게 알려졌다면 중부개발처 자산관리팀에 문의해 코드를 다시 받으세요.
        </p>
      </div>
    </PageShell>
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
