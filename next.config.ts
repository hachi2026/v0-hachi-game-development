import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Enable React strict mode for better development experience
  reactStrictMode: true,
  
  // Optimize images
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
  
  // Enable server actions
  serverActions: {
    bodySizeLimit: '2mb',
  },
  
  // Vercel-specific optimizations
  experimental: {
    // Enable Partial Prerendering for better performance
    ppr: false,
  },
}

export default nextConfig
