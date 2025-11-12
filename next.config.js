/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep React Strict Mode enabled - it helps catch bugs in development
  // Note: Strict Mode intentionally double-mounts components to detect side effects
  // This may cause some duplicate logs in dev, but logs are clean in production
  reactStrictMode: true
}

module.exports = nextConfig
