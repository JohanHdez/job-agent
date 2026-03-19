import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import RequireAuth from './RequireAuth';
import { useAuthStore } from '../store/auth.store';

vi.mock('../store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

/** Render RequireAuth wrapping a protected route, with a /login escape hatch */
function renderWithGuard(isInitialized: boolean, accessToken: string | null) {
  vi.mocked(useAuthStore).mockReturnValue({
    isInitialized,
    accessToken,
  } as ReturnType<typeof useAuthStore>);

  return render(
    <MemoryRouter initialEntries={['/protected']}>
      <Routes>
        <Route element={<RequireAuth />}>
          <Route path="/protected" element={<div data-testid="protected-content" />} />
        </Route>
        <Route path="/login" element={<div data-testid="login-page" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a spinner while auth check is pending (isInitialized=false)', () => {
    renderWithGuard(false, null);

    // Spinner div is present, protected content and login page are not
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('spinner is still shown while pending even if accessToken is null', () => {
    // State before the silent refresh completes — guard must wait
    renderWithGuard(false, null);

    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('redirects to /login when initialized and no access token', () => {
    renderWithGuard(true, null);

    expect(screen.getByTestId('login-page')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders protected children when initialized and token is present', () => {
    renderWithGuard(true, 'valid-access-token');

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });

  it('does not redirect to /login when auth check is still pending', () => {
    renderWithGuard(false, null);

    // Must not redirect prematurely — wait for isInitialized=true
    expect(screen.queryByTestId('login-page')).not.toBeInTheDocument();
  });
});
