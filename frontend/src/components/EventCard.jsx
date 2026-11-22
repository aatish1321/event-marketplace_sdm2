import { Link } from 'react-router-dom';
import { Heart, Globe, MapPin } from 'lucide-react';

export default function EventCard({
  imageUrl,
  category,
  date,
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

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-ink/25">
      {/* Fully clickable card background link */}
      <Link to={href} className="absolute inset-0 z-0" aria-label={`View details for ${title}`} />

      {/* Image & top badges */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-canvas">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-canvas">
            <PlaceIcon className="h-8 w-8 text-muted" strokeWidth={1.5} aria-hidden="true" />
          </div>
        )}

        <span className="absolute left-3 top-3 z-10 rounded-md bg-surface px-2 py-1 text-xs font-medium text-ink">
          {category}
        </span>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSave?.();
          }}
          className="absolute right-3 top-3 z-10 flex h-10 w-10 items-center justify-center rounded-control bg-surface text-ink transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="Save event"
        >
          <Heart className="h-4 w-4" strokeWidth={1.5} />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-lg font-medium leading-snug text-ink line-clamp-2">{title}</h3>

        <div className="mt-2 flex items-center gap-2 text-sm text-muted">
          <PlaceIcon className="h-4 w-4 shrink-0" strokeWidth={1.5} data-testid={`${eventType}-icon`} aria-hidden="true" />
          <span className="truncate">{venue}</span>
        </div>

        {/* Tear-off stub: the ticket signature. Date and price sit under a dashed perforation. */}
        <div className="mt-auto pt-5">
          <div className="border-t border-dashed border-ink/25 pt-4">
            {date && <p className="font-mono text-xs tabular-nums text-muted">{date}</p>}
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="text-sm text-ink">{price}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onTicketsClick?.();
                }}
                className="relative z-10 h-10 shrink-0 rounded-control border border-border px-4 text-sm font-medium text-ink transition-colors hover:border-ink hover:bg-ink hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
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
