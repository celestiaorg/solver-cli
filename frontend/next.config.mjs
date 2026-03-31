/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  swcMinify: false,
  images: {
    unoptimized: true,
  },
  webpack: config => {
    config.experiments = {
      layers: true,
    };
    return config;
  },
};

// Rewrites only work in dev (ignored when output: 'export' builds static files)
if (process.env.NODE_ENV !== 'production') {
  nextConfig.rewrites = async () => [
    {
      source: '/api/:path*',
      destination: 'http://localhost:3001/api/:path*',
    },
    {
      source: '/eden-rpc',
      destination: 'https://ev-reth-eden-testnet.binarybuilders.services:8545/',
    },
  ];
}

export default nextConfig;
