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

  const saveButton = (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onSave?.();
      }}
      className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-control border border-border bg-surface text-ink transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
      aria-label="Save event"
    >
      <Heart className="h-4 w-4" strokeWidth={1.5} />
    </button>
  );

  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-card border border-border bg-surface transition-colors hover:border-ink/25">
      {/* Fully clickable card background link */}
      <Link to={href} className="absolute inset-0 z-0" aria-label={`View details for ${title}`} />

      {imageUrl ? (
        <div className="relative aspect-[4/3] w-full overflow-hidden bg-canvas">
          <img src={imageUrl} alt={title} className="h-full w-full object-cover" />
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between">
            <span className="rounded-md bg-surface px-2 py-1 text-xs font-semibold text-ink">{category}</span>
            {saveButton}
          </div>
        </div>
      ) : (
        // Events without a photo get a compact header instead of an empty picture box.
        <div className="pointer-events-none relative z-10 flex items-start justify-between px-5 pt-5">
          <span className="rounded-md bg-ink px-2 py-1 text-xs font-semibold text-white">{category}</span>
          {saveButton}
        </div>
      )}

      {/* Content */}
      <div className={`flex flex-1 flex-col px-5 pb-5 ${imageUrl ? 'pt-5' : 'pt-4'}`}>
        <h3 className="text-xl font-bold leading-snug text-ink line-clamp-2">{title}</h3>

        <div className="mt-2 flex items-center gap-2 text-sm font-medium text-muted">
          <PlaceIcon className="h-4 w-4 shrink-0" strokeWidth={1.5} data-testid={`${eventType}-icon`} aria-hidden="true" />
          <span className="truncate">{venue}</span>
        </div>

        {/* Tear-off stub: the ticket signature. Date and price sit under a dashed perforation. */}
        <div className="mt-auto pt-5">
          <div className="border-t border-dashed border-ink/25 pt-4">
            {date && <p className="font-mono text-xs font-semibold tabular-nums text-muted">{date}</p>}
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
