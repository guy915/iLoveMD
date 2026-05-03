import { describe, it, expect } from 'vitest'
import { isLikelyApiKey, MIN_API_KEY_LENGTH } from './apiKeyUtils'

describe('isLikelyApiKey', () => {
  it('returns false for empty or nullish values', () => {
    expect(isLikelyApiKey('')).toBe(false)
    expect(isLikelyApiKey('   ')).toBe(false)
    expect(isLikelyApiKey(null)).toBe(false)
    expect(isLikelyApiKey(undefined)).toBe(false)
  })

  it('returns false for strings shorter than the minimum length', () => {
    const shortKey = 'a'.repeat(MIN_API_KEY_LENGTH - 1)
    expect(isLikelyApiKey(shortKey)).toBe(false)
  })

  it('returns false for strings containing disallowed characters', () => {
    const base = 'a'.repeat(MIN_API_KEY_LENGTH)
    // Whitespace inside the string (not just trimmed edges) is not allowed
    expect(isLikelyApiKey('a'.repeat(10) + ' ' + 'b'.repeat(10))).toBe(false)
    expect(isLikelyApiKey(base + '!')).toBe(false)
    expect(isLikelyApiKey(base + '/')).toBe(false)
    expect(isLikelyApiKey('你好' + base)).toBe(false)
  })

  it('returns true for plausible API-key-shaped strings', () => {
    expect(isLikelyApiKey('a'.repeat(MIN_API_KEY_LENGTH))).toBe(true)
    expect(isLikelyApiKey('AIzaSyA-abcdefghijklmnopqrstuvwxyz0123456')).toBe(true)
    expect(isLikelyApiKey('sk_live_0123456789ABCDEF-_')).toBe(true)
  })

  it('trims whitespace before validating', () => {
    const key = '  ' + 'a'.repeat(MIN_API_KEY_LENGTH) + '  '
    expect(isLikelyApiKey(key)).toBe(true)
  })
})
