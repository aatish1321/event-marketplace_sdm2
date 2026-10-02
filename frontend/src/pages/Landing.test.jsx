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
    // Brand name appears in header and footer
    expect(screen.getAllByText('Eventify').length).toBeGreaterThan(0);
  });

  it('renders the main hero text', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    expect(screen.getByText(/Curate your scene./i)).toBeInTheDocument();
    expect(screen.getByText(/Own your audience./i)).toBeInTheDocument();
  });

  it('renders call to action buttons', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    // There are multiple Get Started/Create account/Start Building equivalents
    expect(screen.getByText(/Get Started/i)).toBeInTheDocument();
    expect(screen.getByText(/Start Building/i)).toBeInTheDocument();
    
    const logInLinks = screen.getAllByText(/Log in/i);
    expect(logInLinks.length).toBeGreaterThan(0);
  });

  it('renders feature sections', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Frictionless Ticketing')).toBeInTheDocument();
    expect(screen.getByText('Real-time Analytics')).toBeInTheDocument();
    expect(screen.getByText('Global Reach')).toBeInTheDocument();
  });
});
