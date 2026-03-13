import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '../../store/auth.store';

/** Type guard for the /auth/me response */
function isAuthUser(value: unknown): value is AuthUser {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj['id'] === 'string' &&
    typeof obj['email'] === 'string' &&
    typeof obj['name'] === 'string' &&
    typeof obj['providers'] === 'object' &&
    obj['providers'] !== null
  );
}

/**
 * Handles the OAuth redirect from the API server.
 * Reads accessToken + refreshToken from the URL search params,
 * fetches the user profile, then redirects to /config.
 */
const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setTokens, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam !== null) {
      void navigate(`/login?error=${encodeURIComponent(errorParam)}`);
      return;
    }

    const accessToken = searchParams.get('accessToken');
    const refreshToken = searchParams.get('refreshToken');

    if (!accessToken || !refreshToken) {
      void navigate('/login?error=missing_tokens');
      return;
    }

    setTokens(accessToken, refreshToken);
    setLoading(true);

    (async () => {
      try {
        const response = await fetch('http://localhost:3001/auth/me', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          throw new Error(`Auth check failed with status ${response.status}`);
        }

        const data: unknown = await response.json();

        if (!isAuthUser(data)) {
          throw new Error('Unexpected shape returned from /auth/me');
        }

        setUser(data);
        void navigate('/config');
      } catch (_err) {
        void navigate('/login?error=auth_failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams, navigate, setTokens, setUser, setLoading]);

  return (
    <div
      style={{
        backgroundColor: '#0f0f14',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Spinner */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        <div
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            border: '3px solid rgba(99,102,241,0.2)',
            borderTopColor: '#6366f1',
            animation: 'spin 0.75s linear infinite',
          }}
        />
        <p style={{ color: '#9090a8', fontSize: '14px', margin: 0 }}>
          Completing sign-in…
        </p>
      </div>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AuthCallbackPage;
