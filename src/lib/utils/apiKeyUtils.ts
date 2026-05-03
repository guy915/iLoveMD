/**
 * Utility functions for API key validation.
 *
 * These are intentionally generic (not tied to any specific provider's format)
 * so they remain valid if providers change their key formats. The goal is to
 * filter out obvious non-keys (empty, a few characters, whitespace), not to
 * guarantee the key will authenticate successfully — the API call itself is
 * the source of truth for that.
 */

/** Minimum length for a string to be considered a plausible API key. */
export const MIN_API_KEY_LENGTH = 20

/**
 * Return true if the given string looks like a plausible API key.
 *
 * Criteria:
 * - Not empty after trimming.
 * - At least {@link MIN_API_KEY_LENGTH} characters long.
 * - Consists only of characters typically found in API keys: ASCII letters,
 *   digits, underscores, and hyphens.
 *
 * This is deliberately provider-agnostic so it works for Gemini, Marker,
 * OpenAI, etc., and survives future key-format changes.
 */
export function isLikelyApiKey(key: string | null | undefined): boolean {
  if (!key) return false
  const trimmed = key.trim()
  if (trimmed.length < MIN_API_KEY_LENGTH) return false
  return /^[A-Za-z0-9_-]+$/.test(trimmed)
}
