/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep React Strict Mode enabled - it helps catch bugs in development
  // Note: Strict Mode intentionally double-mounts components to detect side effects
  // This may cause some duplicate logs in dev, but logs are clean in production
  reactStrictMode: true,

  // Security headers
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline'", // unsafe-eval needed by Next.js, unsafe-inline needed for ReactMarkdown
              "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for KaTeX and Tailwind
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https://www.datalab.to https://*.modal.run https://generativelanguage.googleapis.com",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
          }
        ]
      }
    ]
  },

  // Configure webpack to properly handle client-side only libraries
  webpack: (config, { isServer }) => {
    // Exclude jszip from server bundle (client-side only library)
    if (isServer) {
      config.externals = [...(config.externals || []), 'jszip']
    }

    return config
  }
}

export default nextConfig
