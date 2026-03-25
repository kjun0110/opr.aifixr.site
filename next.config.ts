import type { NextConfig } from 'next';

/**
 * 로컬에서 게이트웨이로 API를 프록시하면 브라우저는 localhost:3000/api 만 보게 되어
 * SameSite=Lax 리프레시 쿠키가 정상 저장됩니다.
 *
 * .env.local 예:
 *   OPR_API_PROXY_TARGET=http://127.0.0.1:8080
 *   # NEXT_PUBLIC_API_BASE 는 비우기 (상대 경로 /api 사용)
 */
const OPR_API_PROXY_TARGET = (process.env.OPR_API_PROXY_TARGET || '')
  .trim()
  .replace(/\/$/, '');

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['recharts'],
  async rewrites() {
    if (!OPR_API_PROXY_TARGET) {
      return [];
    }
    return [
      {
        source: '/api/:path*',
        destination: `${OPR_API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
