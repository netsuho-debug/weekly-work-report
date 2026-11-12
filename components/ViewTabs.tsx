// 부서용 화면의 보기 방식 전환: [이번 주 진행 사항] / [다음 주 예정 작업]
// 이 앱의 목적은 "다음 주에 어떤 작업이 있는지 파악하는 것"이라서, 다음 주 예정 작업을 한 번에 볼 수 있는 보기를 둔다.
// 자바스크립트 없이 동작하는 링크이고, 고른 보기는 주소(?view=next)에 남는다.

import Link from "next/link";
import { dashboardHref, type DashboardView } from "./WeekPicker";

type ViewTabsProps = {
  weekStart: string;
  currentWeekStart: string;
  officeId: number | null;
  view: DashboardView;
};

const TABS: { view: DashboardView; label: string }[] = [
  { view: "next", label: "다음 주 예정 작업" },
  { view: "this", label: "이번 주 작업 내용" },
];

export default function ViewTabs({ weekStart, currentWeekStart, officeId, view }: ViewTabsProps) {
  return (
    <nav aria-label="보기 방식" className="flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-800">
      {TABS.map((tab) => {
        const active = tab.view === view;
        return (
          <Link
            key={tab.view}
            href={dashboardHref(weekStart, currentWeekStart, officeId, tab.view)}
            aria-current={active ? "page" : undefined}
            className={
              "flex-1 rounded-md px-3 py-2 text-center text-sm font-semibold " +
              (active
                ? "bg-white text-brand shadow-sm dark:bg-zinc-900 dark:text-sky-300"
                : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100")
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
