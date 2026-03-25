import type { NextConfig } from 'next';

const API_PROXY_TARGET = process.env.OPR_API_PROXY_TARGET || 'http://localhost:8080';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['recharts'],
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${API_PROXY_TARGET}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
