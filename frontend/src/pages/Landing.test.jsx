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
    expect(screen.getByText('Eventify')).toBeInTheDocument();
  });

  it('renders the main hero text', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    expect(screen.getByText(/The all-in-one platform for your next/i)).toBeInTheDocument();
  });

  it('renders Get Started and Log in buttons', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    const getStartedButtons = screen.getAllByText(/Get Started/i);
    expect(getStartedButtons.length).toBeGreaterThan(0);
    
    const logInLinks = screen.getAllByText(/Log in/i);
    expect(logInLinks.length).toBeGreaterThan(0);
  });

  it('renders feature sections', () => {
    render(
      <BrowserRouter>
        <Landing />
      </BrowserRouter>
    );
    
    expect(screen.getByText('Community First')).toBeInTheDocument();
    expect(screen.getByText('Lightning Fast')).toBeInTheDocument();
    expect(screen.getByText('Secure Platform')).toBeInTheDocument();
  });
});
