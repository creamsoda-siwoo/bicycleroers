import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 실시간 채널이 개발 모드에서 두 번 연결되지 않도록 끕니다.
  reactStrictMode: false,
};

export default nextConfig;
