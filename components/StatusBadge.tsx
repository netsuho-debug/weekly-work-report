// Design Ref: §1-3 현황판 — 상태 배지: 제출 완료(초록, 마감 뒤 제출 포함) / 미제출(회색, 마감 전) / 제출지연(주황, 마감 뒤에도 안 냄)
// 색만으로 구분하지 않도록 글자(제출 완료·미제출·제출지연)를 항상 함께 보여 준다.

import { STATUS_LABEL, type SubmissionStatus } from "@/lib/status";

const STYLE: Record<SubmissionStatus, string> = {
  submitted:
    "bg-green-100 text-green-800 ring-green-600/30 dark:bg-green-950 dark:text-green-300 dark:ring-green-500/40",
  // 마감 뒤에 낸 보고도 "제출 완료"이므로 같은 초록색으로 보여 준다
  late: "bg-green-100 text-green-800 ring-green-600/30 dark:bg-green-950 dark:text-green-300 dark:ring-green-500/40",
  // 마감 전에 아직 내지 않은 청사는 회색
  missing:
    "bg-zinc-100 text-zinc-700 ring-zinc-500/30 dark:bg-zinc-800 dark:text-zinc-300 dark:ring-zinc-500/40",
  // 마감이 지났는데 내지 않은 청사는 눈에 띄도록 주황색
  overdue:
    "bg-orange-100 text-orange-800 ring-orange-600/30 dark:bg-orange-950 dark:text-orange-300 dark:ring-orange-500/40",
};

export default function StatusBadge({ status }: { status: SubmissionStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${STYLE[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
