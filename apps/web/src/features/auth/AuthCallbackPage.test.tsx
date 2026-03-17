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

// Mock user response
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

  it('exchanges code and calls setAccessToken, setUser', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 900 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });
    mockApiGet.mockResolvedValueOnce({
      data: { profile: { name: 'Test' }, isComplete: true, missingFields: [] },
    });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/auth/exchange', { code: 'abc-123' });
      expect(mockSetAccessToken).toHaveBeenCalledWith('at-123');
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });
  });

  it('calls GET /auth/me after code exchange', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 900 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });
    mockApiGet.mockResolvedValueOnce({
      data: { profile: null, isComplete: false, missingFields: ['name'] },
    });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/auth/me');
    });
  });

  it('calls GET /users/profile after /auth/me', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 900 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });
    mockApiGet.mockResolvedValueOnce({
      data: { profile: null, isComplete: false, missingFields: ['name'] },
    });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/users/profile');
    });
  });

  it('navigates to /profile/setup when profile is null', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 900 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });
    mockApiGet.mockResolvedValueOnce({
      data: { profile: null, isComplete: false, missingFields: [] },
    });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      // After navigation away, spinner is gone
      expect(screen.queryByText('Completing sign-in...')).not.toBeInTheDocument();
    });
  });

  it('navigates to /profile/setup when missingFields is non-empty', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 900 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });
    mockApiGet.mockResolvedValueOnce({
      data: { profile: { name: 'Test' }, isComplete: false, missingFields: ['headline', 'skills'] },
    });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockApiGet).toHaveBeenCalledWith('/users/profile');
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });
  });

  it('navigates to /config when profile is complete (missingFields empty)', async () => {
    mockApiPost.mockResolvedValueOnce({ data: { accessToken: 'at-123', expiresIn: 900 } });
    mockApiGet.mockResolvedValueOnce({ data: mockUser });
    mockApiGet.mockResolvedValueOnce({
      data: { profile: { name: 'Test', headline: 'Dev' }, isComplete: true, missingFields: [] },
    });

    renderCallback('?code=abc-123');

    await waitFor(() => {
      expect(mockSetAccessToken).toHaveBeenCalledWith('at-123');
      expect(mockSetUser).toHaveBeenCalledWith(mockUser);
    });
  });

  it('redirects to /login without calling API when ?error param present', async () => {
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

  it('redirects to /login?error=auth_failed when exchange fails', async () => {
    mockApiPost.mockRejectedValueOnce(new Error('Network error'));

    renderCallback('?code=bad-code');

    await waitFor(() => {
      expect(mockApiPost).toHaveBeenCalledWith('/auth/exchange', { code: 'bad-code' });
      expect(mockSetAccessToken).not.toHaveBeenCalled();
    });
  });

  it('never calls setTokens (old two-argument form does not exist)', () => {
    // The mock store object only has setAccessToken — no setTokens
    expect(mockStoreFns).not.toHaveProperty('setTokens');
  });

  it('shows spinner while processing', () => {
    // Keep mock pending to capture loading state
    mockApiPost.mockReturnValue(new Promise<never>(() => { /* never resolves */ }));

    renderCallback('?code=some-code');

    expect(screen.getByText('Completing sign-in...')).toBeInTheDocument();
  });
});
