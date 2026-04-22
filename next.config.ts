import type { NextConfig } from 'next'

const BASE_PATH = '/stock'

const nextConfig: NextConfig = {
  basePath: BASE_PATH,
  output: 'standalone',
  env: {
    NEXT_PUBLIC_BASE_PATH: BASE_PATH,
  },
}

export default nextConfig
