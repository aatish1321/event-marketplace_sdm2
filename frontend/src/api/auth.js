// Thin wrappers around the backend auth endpoints.
// Contract (see backend/README.md):
//   POST /api/auth/register/ -> 201 { user_id, email, full_name, role }
//                               400 { error, fields? } | 409 { error }
//   POST /api/auth/login/    -> 200 { token, token_type, expires_in }
//                               400 | 401 { error }

export class ApiError extends Error {
  constructor(status, data) {
    super(data?.error || `Request failed with status ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return data
}

export function registerUser(payload) {
  return postJson('/api/auth/register/', payload)
}

export function loginUser(email, password) {
  return postJson('/api/auth/login/', { email, password })
}
