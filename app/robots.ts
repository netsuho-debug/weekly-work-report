// 내부 업무용 앱이라 검색엔진의 수집을 모두 막는다 (보안 점검 보완)
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
