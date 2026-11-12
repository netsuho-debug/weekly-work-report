"use client";

// Design Ref: §1-1 입장 화면 — 접속 코드를 입력하고 [입장]
// Plan SC: 작업 13 "사업장 코드면 내 청사 입력 화면으로, 부서용 코드면 현황판으로"

import { useState } from "react";

type AuthResponse =
  | { ok: true; redirectTo: string }
  | { ok: false; code: string; message: string };

export default function CodeForm() {
  const [code, setCode] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    if (code.trim() === "") {
      setError("접속 코드를 입력해 주세요.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = (await res.json()) as AuthResponse;
      if (data.ok) {
        // 쿠키가 심겼으므로 페이지를 새로 불러서 들어간다 (서버가 새 쿠키로 화면을 만든다)
        window.location.assign(data.redirectTo);
        return;
      }
      setError(data.message);
    } catch {
      setError("서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="access-code" className="mb-1 block text-sm font-medium">
          접속 코드
        </label>
        <input
          id="access-code"
          name="code"
          type={show ? "text" : "password"}
          autoComplete="off"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "access-code-error" : undefined}
          className="w-full rounded-md border border-zinc-300 bg-white px-3 py-3 text-base text-zinc-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          placeholder="받은 코드를 입력하세요"
        />
        <label className="mt-2 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          코드 보이기
        </label>
      </div>

      {error && (
        <p id="access-code-error" role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "확인하는 중..." : "입장"}
      </button>
    </form>
  );
}
