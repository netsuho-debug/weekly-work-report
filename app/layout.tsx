import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";
import SiteHeader from "@/components/SiteHeader";
import "./globals.css";

// 한국자산관리공사 누리집과 같은 계열의 한글 글꼴(Noto Sans KR)
const notoSansKr = Noto_Sans_KR({
  variable: "--font-noto-sans-kr",
  weight: ["400", "500", "700"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "사업장별 주간 공사·작업 현황",
  description: "중부개발처 자산관리팀이 담당하는 사업장 13곳의 주간 작업 보고를 한곳에서 받고 취합합니다.",
  // 내부 업무용 화면이라 검색엔진에 노출하지 않는다
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
