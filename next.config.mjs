/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep React Strict Mode enabled - it helps catch bugs in development
  // Note: Strict Mode intentionally double-mounts components to detect side effects
  // This may cause some duplicate logs in dev, but logs are clean in production
  reactStrictMode: true,

  // Configure webpack to properly handle jszip
  webpack: (config, { isServer }) => {
    // Don't resolve jszip on the server side
    if (isServer) {
      config.externals = [...(config.externals || []), 'jszip']
    }

    return config
  }
}

export default nextConfig
