import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { describe, it, expect } from 'vitest';
import Landing from './Landing';

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
    // Updated test strings to match consumer-focused copy
    expect(screen.getByText(/Don't let/i)).toBeInTheDocument();
    expect(screen.getByText(/the weekend/i)).toBeInTheDocument();
    expect(screen.getByText(/slip away/i)).toBeInTheDocument();
  });

  it('renders call to action elements', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    expect(screen.getByText(/Sign up/i)).toBeInTheDocument();
    expect(screen.getByText(/Explore/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search events, artists, venues.../i)).toBeInTheDocument();
  });

  it('renders trending events section', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Trending Now')).toBeInTheDocument();
    expect(screen.getByText('Midnight Warehouse Project')).toBeInTheDocument();
    expect(screen.getByText('Independent Zine & Art Fair')).toBeInTheDocument();
    expect(screen.getByText('Rooftop Jazz Collective')).toBeInTheDocument();
  });
});
