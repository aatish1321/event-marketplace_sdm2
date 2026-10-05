import { useState } from 'react';
import { Search, MapPin, Calendar } from 'lucide-react';

export default function SearchFilters() {
  const [selectedCategory, setSelectedCategory] = useState('All');
  const categories = ['All', 'Music', 'Food', 'Arts', 'Sports', 'Networking', 'Comedy'];

  return (
    <div className="w-full space-y-4">
      {/* Search and Filters Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        {/* Search Field */}
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
            <Search className="h-5 w-5 text-muted" />
          </div>
          <input
            type="text"
            className="h-12 w-full rounded-pill border border-border bg-surface pl-11 pr-4 text-sm text-ink placeholder:text-muted focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
            placeholder="Search events, artists, or venues"
          />
        </div>

        {/* Filters (Desktop inline, Mobile stacked) */}
        <div className="flex gap-4">
          <div className="relative flex-1 md:w-48">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <MapPin className="h-4 w-4 text-muted" />
            </div>
            <select
              className="h-12 w-full appearance-none rounded-pill border border-border bg-surface pl-10 pr-4 text-sm text-ink focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              aria-label="Location filter"
            >
              <option>Any Location</option>
              <option>San Francisco</option>
              <option>New York</option>
              <option>London</option>
            </select>
          </div>

          <div className="relative flex-1 md:w-48">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
              <Calendar className="h-4 w-4 text-muted" />
            </div>
            <select
              className="h-12 w-full appearance-none rounded-pill border border-border bg-surface pl-10 pr-4 text-sm text-ink focus:border-focus focus:outline-none focus:ring-2 focus:ring-focus/20"
              aria-label="Date filter"
            >
              <option>Any Date</option>
              <option>Today</option>
              <option>This Weekend</option>
              <option>Next Week</option>
            </select>
          </div>
        </div>
      </div>

      {/* Category Chips */}
      <div className="relative -mx-4 px-4 md:mx-0 md:px-0">
        <div className="flex snap-x snap-mandatory overflow-x-auto pb-2 scrollbar-hide md:flex-wrap md:pb-0 gap-2">
          {categories.map((category) => {
            const isSelected = selectedCategory === category;
            return (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`flex h-9 shrink-0 snap-start items-center justify-center rounded-pill px-4 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus ${
                  isSelected
                    ? 'bg-surface-dark text-white'
                    : 'bg-surface border border-border text-ink hover:bg-canvas'
                }`}
              >
                {category}
              </button>
            );
          })}
        </div>
        {/* Mobile hint for scrollability (fade) */}
        <div className="pointer-events-none absolute bottom-0 right-0 top-0 w-12 bg-gradient-to-l from-canvas to-transparent md:hidden" />
      </div>
    </div>
  );
}
