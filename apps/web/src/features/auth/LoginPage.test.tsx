import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

/** Render LoginPage with optional ?error= or ?reason= query params */
function renderLogin(search = '') {
  return render(
    <MemoryRouter initialEntries={[`/login${search}`]}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location.href before each test
    Object.defineProperty(window, 'location', {
      writable: true,
      value: { href: 'http://localhost:5173/login' },
    });
  });

  // ── Rendering ──────────────────────────────────────────────────────────────

  it('renders the LinkedIn sign-in button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /Continue with LinkedIn/i })).toBeInTheDocument();
  });

  it('renders the Google sign-in button', () => {
    renderLogin();
    expect(screen.getByRole('button', { name: /Continue with Google/i })).toBeInTheDocument();
  });

  it('renders the "Welcome back" heading', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument();
  });

  // ── No banners by default ──────────────────────────────────────────────────

  it('shows no error or reason banner when no query params are present', () => {
    renderLogin();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // ── Session expired banner ─────────────────────────────────────────────────

  it('shows amber session-expired banner for ?reason=session_expired', () => {
    renderLogin('?reason=session_expired');

    const banner = screen.getByRole('status');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/session has expired/i);
  });

  it('does NOT show a red error banner for session_expired reason', () => {
    renderLogin('?reason=session_expired');

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  // ── Auth error banner ──────────────────────────────────────────────────────

  it('shows a red error banner for ?error=google_failed', () => {
    renderLogin('?error=google_failed');

    const banner = screen.getByRole('alert');
    expect(banner).toBeInTheDocument();
    expect(banner).toHaveTextContent(/Google authentication failed/i);
  });

  it('shows a red error banner for ?error=linkedin_failed', () => {
    renderLogin('?error=linkedin_failed');

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/LinkedIn authentication failed/i);
  });

  it('shows a default error message for an unknown error code', () => {
    renderLogin('?error=unknown_code');

    const banner = screen.getByRole('alert');
    expect(banner).toHaveTextContent(/unexpected error/i);
  });

  it('does NOT show an amber session banner for error params', () => {
    renderLogin('?error=auth_failed');

    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  // ── OAuth button navigation ────────────────────────────────────────────────

  it('clicking the LinkedIn button sets window.location.href to /auth/linkedin', () => {
    renderLogin();

    screen.getByRole('button', { name: /Continue with LinkedIn/i }).click();

    expect(window.location.href).toContain('/auth/linkedin');
  });

  it('clicking the Google button sets window.location.href to /auth/google', () => {
    renderLogin();

    screen.getByRole('button', { name: /Continue with Google/i }).click();

    expect(window.location.href).toContain('/auth/google');
  });
});
