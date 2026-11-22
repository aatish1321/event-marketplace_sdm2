// Poster colour for an event without a cover photo. Picked from the event id,
// so a given event always keeps the same colour. Full class names so Tailwind finds them.
const TILES = ['bg-accent', 'bg-poster-teal', 'bg-poster-plum', 'bg-poster-cobalt']

export function tileColor(key = '') {
  let sum = 0
  for (const char of String(key)) sum += char.charCodeAt(0)
  return TILES[sum % TILES.length]
}

// Day, month and weekday for the big date on a poster tile; null when unscheduled.
export function dateParts(iso) {
  const date = iso ? new Date(iso) : null
  if (!date || Number.isNaN(date.getTime())) return null
  return {
    day: date.toLocaleDateString('en-GB', { day: 'numeric' }),
    month: date.toLocaleDateString('en-GB', { month: 'short' }),
    weekday: date.toLocaleDateString('en-GB', { weekday: 'short' }),
  }
}
