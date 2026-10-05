import React from 'react';
import { Heart, Calendar, MapPin, Ticket } from 'lucide-react';

export default function EventCard({
  imageUrl,
  category,
  date,
  title,
  venue,
  price,
  onSave,
  onTicketsClick,
  href = '#',
}) {
  return (
    <div className="group relative flex flex-col overflow-hidden rounded-card bg-surface border border-border shadow-card transition-transform hover:-translate-y-1">
      {/* Fully clickable card background link */}
      <a href={href} className="absolute inset-0 z-0" aria-label={`View details for ${title}`} />

      {/* Image & Top Badges */}
      <div className="relative aspect-[4/3] w-full overflow-hidden bg-canvas">
        {imageUrl ? (
          <img src={imageUrl} alt={title} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="h-full w-full bg-canvas flex items-center justify-center">
            <span className="text-muted text-sm">No Image</span>
          </div>
        )}
        
        <div className="absolute left-4 top-4 z-10">
          <span className="inline-block rounded-pill bg-surface/90 px-3 py-1 text-xs font-bold uppercase tracking-wide text-ink backdrop-blur-sm">
            {category}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSave?.();
          }}
          className="absolute right-4 top-4 z-10 flex h-11 w-11 items-center justify-center rounded-pill bg-surface/90 text-ink backdrop-blur-sm transition-colors hover:text-coral focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
          aria-label="Save event"
        >
          <Heart className="h-5 w-5" />
        </button>
      </div>

      {/* Content */}
      <div className="flex flex-1 flex-col p-4 md:p-6">
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-coral">
          <Calendar className="h-4 w-4" />
          <span>{date}</span>
        </div>

        <h3 className="mb-3 text-xl font-bold leading-tight text-ink line-clamp-2">
          {title}
        </h3>

        <div className="mb-4 space-y-1.5 text-sm font-medium text-muted">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4 shrink-0" />
            <span className="truncate">{venue}</span>
          </div>
          <div className="flex items-center gap-2 text-ink">
            <Ticket className="h-4 w-4 shrink-0" />
            <span>{price}</span>
          </div>
        </div>

        <div className="mt-auto pt-4">
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onTicketsClick?.();
            }}
            className="relative z-10 flex h-[44px] w-full items-center justify-center rounded-pill bg-coral-strong px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-coral-strong/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
          >
            Tickets
          </button>
        </div>
      </div>
    </div>
  );
}
