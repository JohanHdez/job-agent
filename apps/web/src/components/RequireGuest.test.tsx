import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireGuest from './RequireGuest';
import { useAuthStore } from '../store/auth.store';

vi.mock('../store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

/** Render RequireGuest wrapping the /login route, with a /config redirect target */
function renderWithGuard(isInitialized: boolean, accessToken: string | null) {
  vi.mocked(useAuthStore).mockReturnValue({
    isInitialized,
    accessToken,
  } as ReturnType<typeof useAuthStore>);

  return render(
    <MemoryRouter initialEntries={['/login']}>
      <Routes>
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<div data-testid="login-page" />} />
        </Route>
        <Route path="/config" element={<div data-testid="config-page" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireGuest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders nothing while auth check is pending (prevents flash of login page)', () => {
    renderWithGuard(false, null);

    // Neither login nor config should be visible while pending
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('config-page')).not.toBeInTheDocument();
  });

  it('renders login page when initialized and no access token (unauthenticated)', () => {
    renderWithGuard(true, null);

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('config-page')).not.toBeInTheDocument();
  });

  it('redirects to /config when initialized and access token is present (already authenticated)', () => {
    renderWithGuard(true, 'valid-access-token');

    expect(screen.getByTestId('config-page')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('does not show login page during pending state even when token is eventually null', () => {
    // This prevents the login form flash while the silent refresh is still in flight
    renderWithGuard(false, null);

    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });
});
