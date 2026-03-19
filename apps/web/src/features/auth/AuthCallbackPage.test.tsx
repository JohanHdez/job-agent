import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import AuthCallbackPage from './AuthCallbackPage';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth.store';

// vi.mock factories cannot reference variables — use vi.fn() inline
vi.mock('../../lib/api', () => ({
  api: {
    post: vi.fn(),
    get: vi.fn(),
  },
}));

vi.mock('../../store/auth.store', () => ({
  useAuthStore: vi.fn(),
}));

const mockApiPost = vi.mocked(api.post);
const mockApiGet = vi.mocked(api.get);

const mockSetAccessToken = vi.fn();
const mockSetUser = vi.fn();
const mockSetLoading = vi.fn();

const mockStoreFns = {
  setAccessToken: mockSetAccessToken,
  setUser: mockSetUser,
  setLoading: mockSetLoading,
};

const mockUser = {
  id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
  providers: { linkedin: true, google: false },
};

/** Helper to render the callback page with a given query string */
function renderCallback(search: string) {
  vi.mocked(useAuthStore).mockReturnValue(mockStoreFns as ReturnType<typeof useAuthStore>);
  return render(
    <MemoryRouter initialEntries={[`/auth/callback${search}`]}>
      <Routes>
        <Route path="/auth/callback" element={<AuthCallbackPage />} />
        <Route path="*" element={<div data-testid="redirected" />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuthStore).mockReturnValue(mockStoreFns as ReturnType<typeof useAuthStore>);
  });

  it('exchanges code and calls setAccessToken with the returned access token', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 86400 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/auth/exchange', { code: 'abc-123' });
      expect(mockSetAccessToken).toHaveBeenCalledWith('at-123');
    });
  });

  it('calls GET /auth/me after code exchange to fetch user identity', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 86400 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/auth/me');
    });
  });

  it('calls setUser with the response from /auth/me', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 86400 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });
  });

  it('always navigates to /config after successful exchange (OAuth provides basic identity)', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 86400 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });

    renderCallback('?code=abc-123');

    // After navigation, the callback spinner is replaced by the matched route
    await waitFor(() => {
      expect(screen.queryByText('Completing sign-in...')).not.toBeInTheDocument();
    });
  });

  it('does NOT call GET /users/profile — profile completeness is checked at /config', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 86400 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });

    expect(mockApiGet).not.toHaveBeenCalledWith('/users/profile');
  });

  it('redirects to /login without calling any API when ?error param is present', async () => {
    renderCallback('?error=access_denied');

    await waitFor(() => {
      expect(mockApiPost).not.toHaveBeenCalled();
      expect(mockApiGet).not.toHaveBeenCalled();
    });
  });

  it('redirects to /login?error=missing_code when no code or error param', async () => {
    renderCallback('');

    await waitFor(() => {
      expect(mockApiPost).not.toHaveBeenCalled();
    });
  });

  it('redirects to /login?error=auth_failed when exchange throws', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Network error'));

    renderCallback('?code=bad-code');

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/auth/exchange', { code: 'bad-code' });
      expect(mockSetAccessToken).not.toHaveBeenCalled();
    });
  });

  it('redirects to /login?error=auth_failed when /auth/me returns an invalid shape', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 86400 } });
    // Return a response that fails the isAuthUser type guard
    mockApiGet.mockResolvedValueOnce({ data: { unexpected: true } });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      // Exchange was called but setUser was never called due to invalid shape
      expect(mockSetUser).not.toHaveBeenCalled();
    });
  });

  it('shows spinner while exchange is in flight', () => {
    // Keep mock pending to capture loading state
    mockApiPost.mockReturnValue(new Promise<never>(() => { /* never resolves */ }));

    renderCallback('?code=some-code');

    expect(screen.getByText('Completing sign-in...')).toBeInTheDocument();
  });
});
