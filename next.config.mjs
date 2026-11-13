// Hosts the browser may call directly. Large PDFs are uploaded straight to Modal
// (free mode) or to Datalab's presigned storage URLs (paid mode), because the hosting
// platform rejects request bodies over about 4.5 MB. Datalab doesn't document its
// storage host, so the common object-storage hosts are allowed.
const EXTERNAL_CONNECT_SOURCES = [
  'https://www.datalab.to',
  'https://*.datalab.to',
  'https://*.modal.run',
  'https://generativelanguage.googleapis.com',
  'https://*.r2.cloudflarestorage.com',
  'https://*.amazonaws.com',
  'https://storage.googleapis.com',
  'https://*.blob.core.windows.net',
].join(' ')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Keep React Strict Mode enabled - it helps catch bugs in development
  // Note: Strict Mode intentionally double-mounts components to detect side effects
  // This may cause some duplicate logs in dev, but logs are clean in production
  reactStrictMode: true,

  // Send the old Vercel address to the custom domain (keeps old links and search results working)
  async redirects() {
    return [
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'ilovemd.vercel.app' }],
        destination: 'https://ilovemd.app/:path*',
        permanent: true,
      },
    ]
  },

  // Security headers
  async headers() {
    if (process.env.NODE_ENV === 'development') {
      return []
    }
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline'", // unsafe-inline needed for Next.js inline bootstrap scripts and JSON-LD
              "style-src 'self' 'unsafe-inline'", // unsafe-inline needed for KaTeX and Tailwind
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              process.env.NODE_ENV === 'development'
                ? `connect-src 'self' ws://localhost:* http://localhost:* ${EXTERNAL_CONNECT_SOURCES}`
                : `connect-src 'self' ${EXTERNAL_CONNECT_SOURCES}`,
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              process.env.NODE_ENV === 'production' ? "upgrade-insecure-requests" : ""
            ].filter(Boolean).join('; ')
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
            // The legacy XSS auditor is removed from modern browsers and could itself
            // be abused; '0' is the current recommendation (CSP covers this instead)
            key: 'X-XSS-Protection',
            value: '0'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains'
          },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), microphone=(), camera=(), payment=(), usb=(), magnetometer=(), gyroscope=(), accelerometer=()'
          }
        ]
      }
    ]
  },
}

export default nextConfig
