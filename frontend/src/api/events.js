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
