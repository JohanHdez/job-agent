import { useSearchParams } from 'react-router-dom';

/** Maps raw error codes from the query string to human-readable messages */
const ERROR_MESSAGES: Record<string, string> = {
  linkedin_failed: 'LinkedIn authentication failed. Please try again.',
  google_failed: 'Google authentication failed. Please try again.',
  auth_failed: 'Authentication failed. Please try again.',
  missing_tokens: 'Sign-in could not be completed. Please try again.',
  default: 'An unexpected error occurred. Please try again.',
};

/** Resolve a query-string error code to a display message */
function resolveErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES['default'] ?? 'An unexpected error occurred.';
}

/* ── Icon components ────────────────────────────────────────────────────── */

const LinkedInIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

/* ── Page component ─────────────────────────────────────────────────────── */

/**
 * Dark SaaS login page with LinkedIn and Google OAuth buttons.
 * Reads an optional ?error= query param and shows a human-readable message.
 */
const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const errorMessage = resolveErrorMessage(searchParams.get('error'));

  const handleLinkedInSignIn = () => {
    window.location.href = 'http://localhost:3001/auth/linkedin';
  };

  const handleGoogleSignIn = () => {
    window.location.href = 'http://localhost:3001/auth/google';
  };

  return (
    <div
      style={{
        backgroundColor: '#0f0f14',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Inter', system-ui, sans-serif",
        padding: '24px',
        position: 'relative',
      }}
    >
      {/* Ambient indigo glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 65%)',
          zIndex: 0,
        }}
      />

      {/* Login card */}
      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: '400px',
          backgroundColor: '#1a1a24',
          border: '1px solid #2a2a38',
          borderRadius: '20px',
          padding: '40px 36px 36px',
          boxShadow:
            '0 0 0 1px rgba(99,102,241,0.08), 0 24px 64px rgba(0,0,0,0.4), 0 0 80px rgba(99,102,241,0.06)',
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            marginBottom: '32px',
          }}
        >
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
            </svg>
          </div>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 700,
              letterSpacing: '-0.03em',
              color: '#f0f0f8',
            }}
          >
            Job<span style={{ color: '#6366f1' }}>Agent</span>
          </span>
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: '22px',
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: '#f0f0f8',
            margin: '0 0 8px',
            textAlign: 'center',
          }}
        >
          Welcome back
        </h1>

        {/* Sub-headline */}
        <p
          style={{
            fontSize: '13px',
            color: '#9090a8',
            margin: '0 0 32px',
            textAlign: 'center',
            lineHeight: 1.6,
          }}
        >
          Sign in to automate your job search
        </p>

        {/* Error banner */}
        {errorMessage !== null && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
              borderRadius: '10px',
              padding: '12px 14px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#ef4444"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0, marginTop: '1px' }}
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <span style={{ fontSize: '13px', color: '#fca5a5', lineHeight: 1.5 }}>
              {errorMessage}
            </span>
          </div>
        )}

        {/* LinkedIn button */}
        <button
          type="button"
          onClick={handleLinkedInSignIn}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '12px 20px',
            borderRadius: '10px',
            border: 'none',
            backgroundColor: '#0077b5',
            color: '#fff',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '12px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#006097';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,119,181,0.35)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#0077b5';
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <LinkedInIcon />
          Continue with LinkedIn
        </button>

        {/* Divider */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            margin: '20px 0',
          }}
        >
          <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a38' }} />
          <span style={{ fontSize: '12px', color: '#6b7280', flexShrink: 0 }}>or</span>
          <div style={{ flex: 1, height: '1px', backgroundColor: '#2a2a38' }} />
        </div>

        {/* Google button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '10px',
            padding: '12px 20px',
            borderRadius: '10px',
            border: '1px solid #2a2a38',
            backgroundColor: '#ffffff',
            color: '#1f1f1f',
            fontSize: '14px',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.15s',
            marginBottom: '28px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#f5f5f5';
            e.currentTarget.style.transform = 'translateY(-1px)';
            e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = '#ffffff';
            e.currentTarget.style.transform = '';
            e.currentTarget.style.boxShadow = '';
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Footer legal */}
        <p
          style={{
            fontSize: '11px',
            color: '#6b7280',
            textAlign: 'center',
            margin: 0,
            lineHeight: 1.6,
          }}
        >
          By signing in you agree to our{' '}
          <span
            style={{ color: '#9090a8', textDecoration: 'underline', cursor: 'pointer' }}
          >
            terms of service
          </span>
          .
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
