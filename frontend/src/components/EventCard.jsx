import { Link } from 'react-router-dom';
import { Heart, Globe, MapPin } from 'lucide-react';
import { dateParts, tileColor } from '../lib/tiles';

export default function EventCard({
  imageUrl,
  category,
  date,
  startAt,
  eventKey,
  title,
  venue,
  price,
  eventType = 'physical',
  onSave,
  onTicketsClick,
  href = '#',
}) {
  // Physical events show a map pin, online events a globe.
  const PlaceIcon = eventType === 'online' ? Globe : MapPin;
  const parts = dateParts(startAt);

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface shadow-sm transition-shadow hover:shadow-card">
      {/* Fully clickable card background link */}
      <Link to={href} className="absolute inset-0 z-0" aria-label={`View details for ${title}`} />

      {/* Cover photo, or a poster tile with the date when the organizer added none */}
      <div className={`relative aspect-[4/3] w-full overflow-hidden ${imageUrl ? 'bg-canvas' : tileColor(eventKey ?? title)}`}>
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="absolute inset-x-5 bottom-4 flex items-end gap-3 text-white">
            {parts ? (
              <>
                <span className="text-7xl font-extrabold leading-[0.85] tracking-tight tabular-nums">{parts.day}</span>
                <span className="pb-0.5 text-lg font-bold leading-tight">
                  {parts.month}
                  <span className="block font-medium text-white/80">{parts.weekday}</span>
                </span>
              </>
            ) : (
              <PlaceIcon className="h-12 w-12 text-white/80" strokeWidth={1.5} aria-hidden="true" />
            )}
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between">
          <span className={`rounded-md px-2 py-1 text-xs font-semibold ${imageUrl ? 'bg-surface text-ink' : 'bg-white/20 text-white'}`}>
            {category}
          </span>
          {onSave && <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onSave?.();
            }}
            className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-control bg-surface text-ink transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            aria-label="Save event"
          >
            <Heart className="h-4 w-4" strokeWidth={1.5} />
          </button>}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-xl font-bold leading-snug text-ink line-clamp-2">{title}</h3>

        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-muted">
          <PlaceIcon className="h-4 w-4 shrink-0" strokeWidth={1.5} data-testid={`${eventType}-icon`} aria-hidden="true" />
          <span className="truncate">{venue}</span>
        </div>

        {/* Tear-off stub: the ticket signature. Date and price sit under a dashed perforation. */}
        <div className="mt-auto pt-5">
          <div className="border-t border-dashed border-ink/25 pt-4">
            {date && <p className="text-xs font-semibold tabular-nums text-muted">{date}</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-ink">{price}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTicketsClick?.();
                }}
                className="relative z-10 h-10 shrink-0 rounded-control bg-ink px-4 text-sm font-semibold text-white transition-colors hover:bg-ink/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
              >
                Tickets
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
