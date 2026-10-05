import type { NextConfig } from "next";

// 운영·중개사 웹. API는 NestJS 서버가 처리하고, 브라우저는 같은 도메인의 /api로 부른다.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  experimental: {
    // 추천 동네 다시 계산 등 오래 걸리는 요청이 끊기지 않게
    proxyTimeout: 120_000,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      { source: "/favicon.ico", destination: "/favicon.svg" },
    ];
  },
};

export default nextConfig;
