import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect, vi } from 'vitest';
import Landing from './Landing';

// Mock IntersectionObserver for framer-motion
window.IntersectionObserver = class IntersectionObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

describe('Landing Page', () => {
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
    expect(screen.getByText(/Don't let/i)).toBeInTheDocument();
    expect(screen.getByText(/slip away/i)).toBeInTheDocument();
  });

  it('renders call to action elements', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Create event/i)).toBeInTheDocument();
    expect(screen.getByText(/Find an event/i)).toBeInTheDocument();
  });

  it('renders events section', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Worth leaving the house for.')).toBeInTheDocument();
    expect(screen.getByText('Solange: Notes From the Deep')).toBeInTheDocument();
    expect(screen.getByText('The New City Food Festival')).toBeInTheDocument();
    expect(screen.getByText('Designing Tomorrow: Live')).toBeInTheDocument();
  });
});
