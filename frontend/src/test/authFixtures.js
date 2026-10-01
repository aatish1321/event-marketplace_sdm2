export function makeToken(overrides = {}) {
  const claims = {
    user_id: 'user-123',
    role: 'attendee',
    exp: Math.floor(Date.now() / 1000) + 3600,
    ...overrides,
  }
  return `header.${btoa(JSON.stringify(claims)).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '')}.signature`
}
