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

/** LinkedIn brand SVG icon */
const LinkedInIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

/** Google brand SVG icon */
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

/** JobAgent logo mark SVG */
const LogoIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      stroke="white"
      fill="none"
      d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"
    />
  </svg>
);

/* ── Page component ─────────────────────────────────────────────────────── */

/**
 * Dark SaaS login page with LinkedIn and Google OAuth buttons.
 * Reads an optional ?error= query param and shows a human-readable message.
 * Uses Tailwind CSS for all layout and spacing; inline styles only for hex
 * colors that Tailwind cannot express natively.
 */
const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const errorMessage = resolveErrorMessage(searchParams.get('error'));

  /** Redirect to LinkedIn OAuth endpoint (external URL — not React Router) */
  const handleLinkedInSignIn = () => {
    window.location.href = 'http://localhost:3001/auth/linkedin';
  };

  /** Redirect to Google OAuth endpoint (external URL — not React Router) */
  const handleGoogleSignIn = () => {
    window.location.href = 'http://localhost:3001/auth/google';
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-6 py-10 font-sans relative"
      style={{ backgroundColor: '#0f0f14' }}
    >
      {/* Ambient indigo glow — radial gradient cannot be expressed in Tailwind */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(99,102,241,0.15) 0%, transparent 65%)',
        }}
      />

      {/* Login card */}
      <div
        className="relative z-10 w-full max-w-sm rounded-2xl px-9 py-10"
        style={{
          backgroundColor: '#1a1a24',
          border: '1px solid #2a2a38',
          boxShadow:
            '0 0 0 1px rgba(99,102,241,0.08), 0 24px 64px rgba(0,0,0,0.4), 0 0 80px rgba(99,102,241,0.06)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <LogoIcon />
          </div>
          <span
            className="text-xl font-bold tracking-tight"
            style={{ color: '#f0f0f8', letterSpacing: '-0.03em' }}
          >
            Job<span style={{ color: '#6366f1' }}>Agent</span>
          </span>
        </div>

        {/* Headline */}
        <h1
          className="text-center text-2xl font-bold mb-2"
          style={{ color: '#f0f0f8', letterSpacing: '-0.03em' }}
        >
          Sign in to Job Agent
        </h1>

        {/* Sub-headline */}
        <p className="text-center text-sm mb-8" style={{ color: '#9090a8', lineHeight: '1.6' }}>
          Automate your LinkedIn job search
        </p>

        {/* Error banner */}
        {errorMessage !== null && (
          <div
            role="alert"
            className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-5"
            style={{
              backgroundColor: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)',
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
              className="flex-shrink-0 mt-px"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" x2="12" y1="8" y2="12" />
              <line x1="12" x2="12.01" y1="16" y2="16" />
            </svg>
            <span className="text-sm leading-relaxed" style={{ color: '#fca5a5' }}>
              {errorMessage}
            </span>
          </div>
        )}

        {/* LinkedIn OAuth button */}
        <button
          type="button"
          onClick={handleLinkedInSignIn}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold text-white mb-3 transition-all duration-150 hover:-translate-y-px cursor-pointer"
          style={{ backgroundColor: '#0a66c2' }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0958a8';
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 4px 16px rgba(10,102,194,0.35)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0a66c2';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
          }}
        >
          <LinkedInIcon />
          Continue with LinkedIn
        </button>

        {/* Google OAuth button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold mb-7 transition-all duration-150 hover:-translate-y-px cursor-pointer"
          style={{
            backgroundColor: '#ffffff',
            color: '#1f1f1f',
            border: '1px solid #2a2a38',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#f5f5f5';
            (e.currentTarget as HTMLButtonElement).style.boxShadow =
              '0 4px 16px rgba(0,0,0,0.15)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#ffffff';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
          }}
        >
          <GoogleIcon />
          Continue with Google
        </button>

        {/* Footer legal note */}
        <p className="text-center text-xs leading-relaxed" style={{ color: '#6b7280' }}>
          By signing in you agree to our{' '}
          <span
            className="underline cursor-pointer"
            style={{ color: '#9090a8' }}
          >
            Terms of Service
          </span>
          .
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
