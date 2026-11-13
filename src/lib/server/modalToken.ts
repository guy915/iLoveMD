import { createHash, createHmac, randomBytes } from 'node:crypto'

/**
 * Short-lived tokens that let a browser use the free Modal converter.
 *
 * The Modal endpoint is public, so without a token anyone could call it directly
 * and use up the GPU credits. Our server signs each token with a secret shared
 * with Modal (MODAL_TOKEN_SECRET). Modal checks the signature and expiry, accepts
 * each token once, and counts conversions per client IP (the IP is stored only as
 * a hash) to enforce rate limits.
 *
 * Token format: "<expiresAtUnix>.<nonce>.<ipHash>.<signature>"
 * The signature is base64url(HMAC-SHA256(secret, "<expiresAtUnix>.<nonce>.<ipHash>")).
 */

/** How long a token is valid. Long enough for a slow upload of a large PDF to start. */
export const MODAL_TOKEN_TTL_SECONDS = 10 * 60

/** The shared secret, or null when free-mode protection is not configured. */
export function getModalTokenSecret(): string | null {
  const secret = process.env.MODAL_TOKEN_SECRET?.trim()
  return secret ? secret : null
}

/** Best-effort client IP. On Vercel, x-forwarded-for is set by the platform. */
export function getClientIp(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || 'unknown'
}

export function hashIp(ip: string): string {
  return createHash('sha256').update(`ilovemd:${ip}`).digest('hex').slice(0, 32)
}

export function createModalToken(
  secret: string,
  ip: string,
  nowSeconds: number = Math.floor(Date.now() / 1000)
): string {
  const expiresAt = nowSeconds + MODAL_TOKEN_TTL_SECONDS
  const nonce = randomBytes(16).toString('hex')
  const payload = `${expiresAt}.${nonce}.${hashIp(ip)}`
  const signature = createHmac('sha256', secret).update(payload).digest('base64url')
  return `${payload}.${signature}`
}
