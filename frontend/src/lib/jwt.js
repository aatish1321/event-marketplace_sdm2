/**
 * Decode a JWT payload WITHOUT verifying the signature.
 * Verification is the server's job (see backend/config/decorators.py);
 * the client only reads claims to decide what UI to show.
 * Returns null for malformed or expired tokens.
 */
export function decodeToken(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const [, payload] = token.split('.')
    if (!payload) return null
    // base64url -> base64, then pad to a multiple of 4
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    // Decode as UTF-8 so non-ASCII claims survive
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes))

    if (typeof claims.exp === 'number' && claims.exp * 1000 <= Date.now()) return null
    return claims
  } catch {
    return null
  }
}
