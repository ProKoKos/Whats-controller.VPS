import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone', // Для Docker deployment
  async rewrites() {
    // В режиме разработки проксируем запросы на backend
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
      // apiUrl уже содержит полный путь http://localhost:3000/api
      // Поэтому destination должен быть просто apiUrl + путь
      return [
        {
          source: '/api/:path*',
          destination: `${apiUrl}/:path*`,
        },
      ];
    }
    // В продакшене используем относительный путь через Caddy
    return [];
  },
};

export default nextConfig;
