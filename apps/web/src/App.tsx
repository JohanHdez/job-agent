import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore, type AuthUser } from './store/auth.store';
import { initApiAuth, api } from './lib/api';

const App: React.FC = () => {
  const { accessToken, setAccessToken, setUser } = useAuthStore();

  // Wire auth store into API interceptor (runs once, avoids circular import)
  useEffect(() => {
    initApiAuth(
      () => useAuthStore.getState().accessToken,
      (t: string) => useAuthStore.getState().setAccessToken(t),
      () => useAuthStore.getState().logout()
    );
  }, []);

  // Silent refresh on page load — recover session via httpOnly cookie
  useEffect(() => {
    if (accessToken) return; // already authenticated
    api
      .post<{ accessToken: string }>('/auth/refresh', {})
      .then(({ data }) => {
        setAccessToken(data.accessToken);
        return api.get<unknown>('/auth/me');
      })
      .then(({ data }) => {
        const obj = data as Record<string, unknown>;
        if (typeof obj['id'] === 'string' && typeof obj['email'] === 'string') {
          setUser(data as AuthUser);
        }
      })
      .catch(() => {
        /* unauthenticated, do nothing */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Outlet />;
};

export default App;
