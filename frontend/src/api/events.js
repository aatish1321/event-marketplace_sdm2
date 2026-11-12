// Public event discovery.
// Contract:
//   GET /api/events/?continent=&country=&type=physical|online
//     -> 200 [{ id, event_type, title, status, continent, country,
//               available_tickets, venue_name?, address?, stream_url? }]
// Empty filters are left out of the query string so the backend only
// applies the filters the user actually chose.
import { ApiError } from './auth'

export const FILTER_KEYS = ['continent', 'country', 'type']

export function buildEventsUrl(filters = {}) {
  const params = new URLSearchParams()
  for (const key of FILTER_KEYS) {
    const value = filters[key]?.trim()
    if (value) params.set(key, value)
  }
  const query = params.toString()
  return query ? `/api/events/?${query}` : '/api/events/'
}

export async function fetchEvents(filters, { signal } = {}) {
  const res = await fetch(buildEventsUrl(filters), { signal })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new ApiError(res.status, data)
  return Array.isArray(data) ? data : []
}

// Organizer requests share the canonical event schema with discovery, but
// explicitly scope the list to the authenticated organizer on the server.
async function requestOrganizerEvents(url, token, options) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.method === 'POST' ? { 'Content-Type': 'application/json' } : {}),
    },
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  return data
}

export async function listEvents(token, signal) {
  const data = await requestOrganizerEvents('/api/events/?mine=1', token, { method: 'GET', signal })
  if (!Array.isArray(data)) throw new Error('Invalid events response')
  return data
}

export async function createEvent(token, payload, signal) {
  const data = await requestOrganizerEvents('/api/events/', token, { method: 'POST', body: JSON.stringify(payload), signal })
  if (!data?.id || typeof data.title !== 'string') throw new Error('Invalid event response')
  return data
}
