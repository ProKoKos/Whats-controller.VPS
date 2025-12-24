import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Для Docker deployment
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: process.env.NEXT_PUBLIC_API_URL 
          ? `${process.env.NEXT_PUBLIC_API_URL}/:path*`
          : '/api/:path*', // В продакшене используем относительный путь через Caddy
      },
    ];
  },
};

export default nextConfig;
