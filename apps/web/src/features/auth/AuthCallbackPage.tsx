import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore, type AuthUser } from '../../store/auth.store';
import { api } from '../../lib/api';

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

interface ProfileResponse {
  profile: unknown;
  isComplete: boolean;
  missingFields: string[];
}

/**
 * Handles the OAuth redirect from the API server.
 * Reads ?code= from the URL, calls POST /auth/exchange to obtain tokens
 * (refresh token is set as httpOnly cookie, never exposed to JS),
 * fetches user identity, checks profile completeness, then redirects:
 * - First-time users (no profile or missing fields) -> /profile/setup
 * - Returning users with complete profile -> /config
 */
const AuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setAccessToken, setUser, setLoading } = useAuthStore();

  useEffect(() => {
    const errorParam = searchParams.get('error');
    if (errorParam !== null) {
      void navigate(`/login?error=${encodeURIComponent(errorParam)}`);
      return;
    }

    const code = searchParams.get('code');
    if (!code) {
      void navigate('/login?error=missing_code');
      return;
    }

    setLoading(true);

    (async () => {
      try {
        // Exchange one-time code for tokens (refresh token set as httpOnly cookie)
        const exchangeResponse = await api.post<{ accessToken: string; expiresIn: number }>(
          '/auth/exchange',
          { code }
        );
        const { accessToken } = exchangeResponse.data;
        setAccessToken(accessToken);

        // Fetch user identity
        const meResponse = await api.get<unknown>('/auth/me');
        const data = meResponse.data;

        if (!isAuthUser(data)) {
          throw new Error('Unexpected shape returned from /auth/me');
        }

        setUser(data);

        // Check profile status to determine redirect target (locked decision)
        // If profile is null or any critical fields missing -> /profile/setup
        // Otherwise -> /config (returning user with complete profile)
        const profileResponse = await api.get<ProfileResponse>('/users/profile');
        const { profile, missingFields } = profileResponse.data;

        if (profile === null || missingFields.length > 0) {
          void navigate('/profile/setup');
        } else {
          void navigate('/config');
        }
      } catch (_err) {
        void navigate('/login?error=auth_failed');
      } finally {
        setLoading(false);
      }
    })();
  }, [searchParams, navigate, setAccessToken, setUser, setLoading]);

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
          Completing sign-in...
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
