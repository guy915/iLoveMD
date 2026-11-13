import { describe, it, expect, afterEach, vi } from 'vitest'
import { createHmac } from 'node:crypto'
import { createModalToken, getClientIp, getModalTokenSecret, hashIp, MODAL_TOKEN_TTL_SECONDS } from './modalToken'

describe('modalToken', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('creates a token Modal can verify with the shared secret', () => {
    const token = createModalToken('s3cret', '1.2.3.4', 1000)
    const [expiresAt, nonce, ipHash, signature] = token.split('.')

    expect(Number(expiresAt)).toBe(1000 + MODAL_TOKEN_TTL_SECONDS)
    expect(nonce).toMatch(/^[0-9a-f]{32}$/)
    expect(ipHash).toBe(hashIp('1.2.3.4'))
    expect(signature).toBe(
      createHmac('sha256', 's3cret').update(`${expiresAt}.${nonce}.${ipHash}`).digest('base64url')
    )
  })

  it('uses a new nonce for every token', () => {
    expect(createModalToken('s', 'ip', 1)).not.toBe(createModalToken('s', 'ip', 1))
  })

  it('does not put the raw IP in the token', () => {
    expect(createModalToken('s', '203.0.113.9')).not.toContain('203.0.113.9')
  })

  it('reads the client IP from proxy headers', () => {
    expect(getClientIp(new Headers({ 'x-forwarded-for': '9.9.9.9, 10.0.0.1' }))).toBe('9.9.9.9')
    expect(getClientIp(new Headers({ 'x-real-ip': '8.8.8.8' }))).toBe('8.8.8.8')
    expect(getClientIp(new Headers())).toBe('unknown')
  })

  it('treats a missing or blank secret as not configured', () => {
    vi.stubEnv('MODAL_TOKEN_SECRET', '  ')
    expect(getModalTokenSecret()).toBeNull()
    vi.stubEnv('MODAL_TOKEN_SECRET', 'abc')
    expect(getModalTokenSecret()).toBe('abc')
  })
})
