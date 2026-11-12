"use client";

// Design Ref: §1-4 접속 코드 변경 — 14줄, 줄마다 [새 코드 입력] 또는 [자동 생성] 후 한 번에 [저장]
// Plan SC: 작업 14. 저장은 PUT /api/codes (하나라도 실패하면 아무것도 바뀌지 않는다)
// 새 코드는 저장 직후 이 화면의 상태(state)에만 잠깐 담아 보여 주고, 어디에도 저장하지 않는다.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { codeRuleMessage, GENERATED_CODE_LENGTH } from "@/lib/code-rules";
import { ALL_SLOTS, slotLabel, type ChangeBody, type ChangeResponse, type CodeSlot, type IssuedCode } from "@/lib/codes-api";

/** 줄마다 고르는 방법: 그대로 / 직접 입력 / 자동 생성 */
type Mode = "keep" | "manual" | "auto";
type RowState = { mode: Mode; code: string };

const slotKey = (slot: CodeSlot) => String(slot);

const initialRows = (): Record<string, RowState> =>
  Object.fromEntries(ALL_SLOTS.map((s) => [slotKey(s), { mode: "keep", code: "" }]));

export default function CodeChangeForm() {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowState>>(initialRows);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [issued, setIssued] = useState<IssuedCode[] | null>(null);
  const [show, setShow] = useState(false);

  const changingCount = ALL_SLOTS.filter((s) => rows[slotKey(s)].mode !== "keep").length;

  function updateRow(slot: CodeSlot, patch: Partial<RowState>) {
    setRows((prev) => ({ ...prev, [slotKey(slot)]: { ...prev[slotKey(slot)], ...patch } }));
    setErrors((prev) => {
      const next = { ...prev };
      delete next[slotKey(slot)];
      return next;
    });
  }

  /** 화면에서 먼저 검사한다 (서버도 같은 규칙으로 다시 검사한다) */
  function validate(): Record<string, string> {
    const found: Record<string, string> = {};
    const seen = new Map<string, string>(); // 코드 → 처음 쓴 줄
    for (const slot of ALL_SLOTS) {
      const row = rows[slotKey(slot)];
      if (row.mode !== "manual") continue;
      const code = row.code.trim();
      const problem = code === "" ? "새 코드를 입력해 주세요." : codeRuleMessage(code);
      if (problem) {
        found[slotKey(slot)] = problem;
        continue;
      }
      const first = seen.get(code);
      if (first) found[slotKey(slot)] = `${first}과(와) 같은 코드입니다. 다른 코드를 입력해 주세요.`;
      else seen.set(code, slotLabel(slot));
    }
    return found;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    setFormError(null);
    if (changingCount === 0) {
      setFormError("바꿀 줄을 하나 이상 골라 주세요.");
      return;
    }
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) {
      setFormError("빨간 글씨로 표시된 줄을 고쳐 주세요.");
      return;
    }
    if (!window.confirm(`접속 코드 ${changingCount}개를 바꿉니다. 옛 코드는 즉시 쓸 수 없게 됩니다. 계속할까요?`)) return;

    const body: ChangeBody = {
      changes: ALL_SLOTS.flatMap((slot): ChangeBody["changes"] => {
        const row = rows[slotKey(slot)];
        if (row.mode === "auto") return [{ slot, mode: "auto" as const }];
        if (row.mode === "manual") return [{ slot, mode: "manual" as const, code: row.code.trim() }];
        return [];
      }),
    };

    setBusy(true);
    try {
      const res = await fetch("/api/codes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as ChangeResponse;
      if (data.ok) {
        setIssued(data.issued);
        setRows(initialRows());
        setShow(false);
      } else if (data.code === "unauthorized") {
        // 쿠키가 만료됐거나 다른 곳에서 부서용 코드가 바뀌었다
        router.replace("/");
        router.refresh();
        return;
      } else {
        setFormError(data.message);
        if (data.slot !== undefined) setErrors({ [slotKey(data.slot)]: data.message });
      }
    } catch {
      setFormError("서버에 연결하지 못했습니다. 아무 코드도 바뀌지 않았을 수 있으니, 잠시 후 다시 시도해 주세요.");
    }
    setBusy(false);
  }

  // 저장 직후: 새 코드를 한 번만 보여 준다. [확인]을 누르거나 화면을 떠나면 다시 볼 수 없다.
  if (issued) {
    return (
      <section aria-labelledby="issued-title" className="space-y-4">
        <div role="status" className="rounded-md border border-green-300 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950 dark:text-green-200">
          <p id="issued-title" className="font-semibold">접속 코드 {issued.length}개를 바꿨습니다.</p>
          <p>아래 새 코드는 지금 한 번만 보입니다. 받아 적은 뒤 [확인]을 누르세요.</p>
        </div>
        <table className="w-full overflow-hidden rounded-lg border border-zinc-200 text-sm dark:border-zinc-800">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2">구분</th>
              <th className="px-4 py-2">새 접속 코드</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {issued.map((item) => (
              <tr key={slotKey(item.slot)}>
                <td className="px-4 py-2 font-medium">{item.label}</td>
                <td className="px-4 py-2 font-mono text-base tracking-wider select-all">{item.code}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <button
          type="button"
          onClick={() => setIssued(null)}
          className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark"
        >
          확인 (코드 가리기)
        </button>
      </section>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <div className="flex items-center justify-between text-sm">
        <span>
          바꿀 줄 <strong>{changingCount}</strong>개 / 전체 {ALL_SLOTS.length}개
        </span>
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />
          입력한 코드 보이기
        </label>
      </div>

      <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        {ALL_SLOTS.map((slot) => {
          const key = slotKey(slot);
          const row = rows[key];
          const error = errors[key];
          const label = slotLabel(slot);
          return (
            <li key={key} className={`space-y-2 px-4 py-3 ${slot === "dept" ? "bg-zinc-50 dark:bg-zinc-900" : ""}`}>
              <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <legend className="sr-only">{label} 코드</legend>
                <span className="w-16 shrink-0 font-semibold">{label}</span>
                {(
                  [
                    ["keep", "그대로"],
                    ["manual", "새 코드 입력"],
                    ["auto", "자동 생성"],
                  ] as const
                ).map(([mode, text]) => (
                  <label key={mode} className="flex items-center gap-1.5 text-sm">
                    <input
                      type="radio"
                      name={`mode-${key}`}
                      checked={row.mode === mode}
                      onChange={() => updateRow(slot, { mode })}
                    />
                    {text}
                  </label>
                ))}
              </fieldset>

              {row.mode === "manual" && (
                <div className="pl-0 sm:pl-20">
                  <input
                    type={show ? "text" : "password"}
                    aria-label={`${label} 새 코드`}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    maxLength={64}
                    value={row.code}
                    onChange={(e) => updateRow(slot, { code: e.target.value })}
                    aria-invalid={error ? true : undefined}
                    aria-describedby={error ? `code-error-${key}` : undefined}
                    placeholder="대·소문자·숫자 섞어 12자 이상"
                    className="w-full rounded-md border border-zinc-300 bg-white px-3 py-2 font-mono text-sm text-zinc-900 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                  />
                </div>
              )}
              {row.mode === "auto" && (
                <p className="text-xs text-zinc-500 sm:pl-20">저장할 때 서버가 {GENERATED_CODE_LENGTH}자 코드를 무작위로 만듭니다.</p>
              )}
              {slot === "dept" && row.mode !== "keep" && (
                <p className="text-xs text-amber-700 sm:pl-20 dark:text-amber-400">
                  부서용 코드를 바꾸면 서무직원·담당자 모두에게 새 코드를 알려야 합니다. (지금 쓰는 화면은 그대로 유지됩니다)
                </p>
              )}
              {error && (
                <p id={`code-error-${key}`} role="alert" className="text-sm font-medium text-red-600 sm:pl-20">
                  {error}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {formError && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {formError}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-brand px-4 py-3 text-base font-semibold text-white hover:bg-brand-dark disabled:cursor-wait disabled:opacity-60"
      >
        {busy ? "저장하는 중..." : `저장 (${changingCount}개 변경)`}
      </button>
    </form>
  );
}
