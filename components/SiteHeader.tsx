// 모든 화면 위에 붙는 머리글: 흰 바탕 + 가는 회색 아래 선 + 남색 포인트 (한국자산관리공사 누리집 느낌)
// 로고는 소속 기관이 제공한 CI 파일(ci02_01.gif)을 그대로 쓴다. 사용자가 직접 넣어 준 공식 파일이며, 모양을 바꾸지 않는다.
// 원본 GIF 는 가장자리에 흰 여백이 넓어서, 머리글에서는 로고 부분만 잘라 보이도록 위치를 맞췄다 (그림 자체는 그대로).

import Image from "next/image";
import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
      <div className="mx-auto flex h-16 w-full max-w-3xl items-center px-4">
        <Link href="/" className="flex items-center gap-3">
          {/* 원본 500x318 을 높이 0.2배로 줄이고, 로고가 있는 가운데 부분만 보이게 자른다 */}
          <span aria-hidden="true" className="relative block h-12 w-14 shrink-0 overflow-hidden">
            <Image
              src="/ci/ci02_01.gif"
              alt=""
              width={100}
              height={64}
              unoptimized
              className="absolute max-w-none"
              style={{ left: "-22px", top: "-9px", width: "100px", height: "64px" }}
            />
          </span>
          <span className="text-base font-bold text-brand">중부개발처 자산관리팀</span>
        </Link>
      </div>
    </header>
  );
}
