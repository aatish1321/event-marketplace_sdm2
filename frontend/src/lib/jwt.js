import { getRoleHome } from './authRoutes'

/**
 * Decode a JWT payload WITHOUT verifying the signature.
 * Verification is the server's job (see backend/config/decorators.py);
 * the client only reads claims to decide what UI to show.
 * Returns null for malformed or expired tokens.
 */
export function decodeToken(token) {
  if (!token || typeof token !== 'string') return null
  try {
    const segments = token.split('.')
    if (segments.length !== 3 || segments.some((segment) => !segment.trim())) return null
    const [, payload] = segments
    // base64url -> base64, then pad to a multiple of 4
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')
    // Decode as UTF-8 so non-ASCII claims survive
    const bytes = Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))
    const claims = JSON.parse(new TextDecoder().decode(bytes))

    if (!claims || typeof claims !== 'object' || Array.isArray(claims)) return null
    if (typeof claims.user_id !== 'string' || !claims.user_id.trim()) return null
    if (!getRoleHome(claims.role)) return null
    if (typeof claims.exp !== 'number' || !Number.isFinite(claims.exp)
      || claims.exp <= Date.now() / 1000) return null
    return claims
  } catch {
    return null
  }
}
