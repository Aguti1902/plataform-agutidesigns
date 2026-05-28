import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@agutidesigns/ui', '@agutidesigns/shared', '@agutidesigns/database'],
  experimental: {
    typedRoutes: false,
  },
};

export default nextConfig;
