import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from './auth.store';

describe('auth.store', () => {
  beforeEach(() => {
    // Reset store between tests
    useAuthStore.setState({ user: null, accessToken: null, isLoading: false });
  });

  it('has setAccessToken method that stores access token', () => {
    useAuthStore.getState().setAccessToken('test-token-123');
    expect(useAuthStore.getState().accessToken).toBe('test-token-123');
  });

  it('does NOT have refreshToken in initial state', () => {
    const state = useAuthStore.getState();
    expect(state).not.toHaveProperty('refreshToken');
  });

  it('does NOT have setTokens method (old two-arg form removed)', () => {
    const state = useAuthStore.getState() as Record<string, unknown>;
    expect(state['setTokens']).toBeUndefined();
  });

  it('logout clears only accessToken and user', () => {
    useAuthStore.getState().setAccessToken('token-abc');
    useAuthStore.getState().setUser({
      id: '1', email: 'a@b.com', name: 'A',
      providers: { linkedin: true, google: false },
    });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.accessToken).toBeNull();
    expect(state.user).toBeNull();
  });

  it('setUser stores user object', () => {
    const user = {
      id: '1', email: 'a@b.com', name: 'Test',
      providers: { linkedin: false, google: true },
    };
    useAuthStore.getState().setUser(user);
    expect(useAuthStore.getState().user).toEqual(user);
  });
});
