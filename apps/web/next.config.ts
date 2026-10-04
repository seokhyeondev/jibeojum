import type { NextConfig } from "next";

// API는 NestJS 서버가 처리한다. 브라우저는 같은 도메인의 /api로 부르고 Next가 넘겨준다.
const API_URL = process.env.API_URL ?? "http://localhost:4000";

const nextConfig: NextConfig = {
  experimental: {
    // /api 프록시 대기 시간. 기본 30초면 추천 동네 계산(TMAP 약 30회, 1초 간격)이 끊긴다
    proxyTimeout: 120_000,
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${API_URL}/api/:path*` },
      // 브라우저가 기본으로 찾는 /favicon.ico를 SVG 아이콘으로 돌린다.
      { source: "/favicon.ico", destination: "/favicon.svg" },
    ];
  },
};

export default nextConfig;
