import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { beforeEach, describe, it, expect, vi } from 'vitest';
import Landing from './Landing';

// Mock IntersectionObserver for framer-motion
window.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Landing Page', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [
      { id: 'live-event', title: 'Published community meetup', event_type: 'physical', venue_name: 'Town Hall', country: 'Hungary', ticket_price_minor: 0, currency: 'EUR' },
    ] }));
  });
  it('renders the brand name', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    expect(screen.getAllByText('Eventify').length).toBeGreaterThan(0);
  });

  it('renders the main hero text', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    expect(screen.getByRole('heading', { level: 1, name: /tickets for what’s on this weekend/i })).toBeInTheDocument();
  });

  it('renders call to action elements', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Sign up/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Find an event/i })).toBeInTheDocument();
  });

  it('renders published events instead of fictional listings', async () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Worth leaving the house for')).toBeInTheDocument();
    expect(await screen.findByText('Published community meetup')).toBeInTheDocument();
    expect(screen.queryByText('Solange: Notes From the Deep')).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Published community meetup/ })).toHaveAttribute('href', '/events/live-event');
  });
});
