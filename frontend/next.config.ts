import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Для Docker deployment
  async rewrites() {
    // В режиме разработки проксируем запросы на backend
    if (process.env.NEXT_PUBLIC_API_URL) {
      return [
        {
          source: '/api/:path*',
          destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
        },
      ];
    }
    // В продакшене используем относительный путь через Caddy
    return [];
  },
};

export default nextConfig;
