import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

// 보안 헤더 (보안 점검 보완). 나중에 화면에 스크립트 문제가 생겨도 피해를 줄이는 안전장치다.
// - script-src 의 'unsafe-inline': Next 가 화면을 살리려고 넣는 인라인 스크립트 때문에 필요하다.
//   개발 중에는 React 도구가 쓰는 'unsafe-eval' 과 웹소켓(핫 리로드)도 허용한다.
// - frame-ancestors 'none': 다른 사이트가 이 앱을 iframe 에 넣지 못하게 한다(클릭재킹 방지).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? " ws: wss:" : ""}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Robots-Tag", value: "noindex, nofollow" },
  // HTTPS 로만 접속하게 한다. 개발 서버(http)에서는 보내지 않는다
  ...(isDev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]),
];

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
