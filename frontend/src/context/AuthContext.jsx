import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { decodeToken } from '../lib/jwt'
import { ROLES } from '../lib/authRoutes'

// localStorage key for the JWT returned by POST /api/auth/login/
const TOKEN_KEY = 'access_token'

// Role values exactly as the backend stores them (backend/config/models.py)
export { ROLES }

const AuthContext = createContext(null)

function readStoredToken() {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    if (token && decodeToken(token)) return token
    localStorage.removeItem(TOKEN_KEY) // drop expired or corrupt tokens
  } catch {
    // localStorage unavailable (private mode, blocked storage)
  }
  return null
}

export function AuthProvider({ children }) {
  // Lazy initializer: read localStorage once on first render
  const [token, setToken] = useState(readStoredToken)

  // Backend token claims: { user_id, role, iat, exp }
  const user = useMemo(() => decodeToken(token), [token])
  const userRole = user?.role ?? null

  const login = useCallback((newToken) => {
    if (!decodeToken(newToken)) throw new Error('Received an invalid or expired token')
    try {
      localStorage.setItem(TOKEN_KEY, newToken)
    } catch {
      // Storage blocked: keep the session in memory for this tab only
    }
    setToken(newToken)
  }, [])

  const logout = useCallback(() => {
    try {
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
    setToken(null)
  }, [])

  // Keep tabs in sync when another tab logs in or out
  useEffect(() => {
    const onStorage = (e) => {
      if (e.key === TOKEN_KEY) setToken(readStoredToken())
    }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  // Log out automatically when the token expires (backend lifetime: 1 hour)
  useEffect(() => {
    if (!user?.exp) return
    const id = setTimeout(logout, Math.max(user.exp * 1000 - Date.now(), 0))
    return () => clearTimeout(id)
  }, [user, logout])

  const value = useMemo(
    () => ({
      token,
      user,
      userRole,
      isAuthenticated: Boolean(user),
      isAttendee: userRole === ROLES.ATTENDEE,
      isOrganizer: userRole === ROLES.ORGANIZER,
      login,
      logout,
    }),
    [token, user, userRole, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>')
  return ctx
}
