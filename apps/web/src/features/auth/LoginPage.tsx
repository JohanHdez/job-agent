import { useSearchParams } from 'react-router-dom';

/** Maps raw error codes from the query string to human-readable messages */
const ERROR_MESSAGES: Record<string, string> = {
  linkedin_failed: 'LinkedIn authentication failed. Please try again.',
  google_failed: 'Google authentication failed. Please try again.',
  auth_failed: 'Authentication failed. Please try again.',
  missing_tokens: 'Sign-in could not be completed. Please try again.',
  default: 'An unexpected error occurred. Please try again.',
};

/** Maps reason codes (informational, not errors) to messages */
const REASON_MESSAGES: Record<string, string> = {
  session_expired: 'Your session has expired. Please sign in again to continue.',
};

function resolveErrorMessage(code: string | null): string | null {
  if (code === null) return null;
  return ERROR_MESSAGES[code] ?? ERROR_MESSAGES['default'] ?? 'An unexpected error occurred.';
}

function resolveReasonMessage(code: string | null): string | null {
  if (code === null) return null;
  return REASON_MESSAGES[code] ?? null;
}

/* ── Icons ──────────────────────────────────────────────────────────────── */

const LinkedInIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
    <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.32 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.79M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
  </svg>
);

const GoogleIcon: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

const LogoIcon: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
  </svg>
);

/* Feature bullet icons */
const SearchIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
  </svg>
);

const StarIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

const ZapIcon: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
);

/* ── Feature data ───────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: <SearchIcon />,
    title: 'Automated LinkedIn search',
    description: 'Finds and filters jobs matching your profile across multiple pages.',
  },
  {
    icon: <StarIcon />,
    title: 'AI job scoring',
    description: 'Scores each posting 0–100 against your CV and minimum threshold.',
  },
  {
    icon: <ZapIcon />,
    title: 'One-click Easy Apply',
    description: 'Fills forms and submits applications automatically while you sleep.',
  },
];

/* ── Page component ─────────────────────────────────────────────────────── */

/**
 * Split-panel login page.
 * Left panel: product value props (hidden on mobile).
 * Right panel: OAuth sign-in card.
 * Reads an optional ?error= query param and renders a human-readable banner.
 */
const LoginPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const errorMessage = resolveErrorMessage(searchParams.get('error'));
  const reasonMessage = resolveReasonMessage(searchParams.get('reason'));

  const handleLinkedInSignIn = () => {
    window.location.href = 'http://localhost:3001/auth/linkedin';
  };

  const handleGoogleSignIn = () => {
    window.location.href = 'http://localhost:3001/auth/google';
  };

  return (
    <div className="min-h-screen flex font-sans" style={{ backgroundColor: '#0f0f14' }}>
      {/* ── Animated background ── */}
      <style>{`
        @keyframes drift {
          0%   { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(30px, -20px) scale(1.05); }
          66%  { transform: translate(-20px, 15px) scale(0.97); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @keyframes driftB {
          0%   { transform: translate(0, 0) scale(1); }
          33%  { transform: translate(-25px, 20px) scale(1.04); }
          66%  { transform: translate(15px, -10px) scale(0.98); }
          100% { transform: translate(0, 0) scale(1); }
        }
        @media (prefers-reduced-motion: reduce) {
          .orb { animation: none !important; }
        }
        .auth-btn { transition: background-color 150ms ease, box-shadow 150ms ease, transform 150ms ease; }
        .auth-btn:hover { transform: translateY(-1px); }
        .auth-btn:active { transform: translateY(0); }
        .feature-item { transition: background-color 150ms ease; }
        .feature-item:hover { background-color: rgba(99,102,241,0.06); }
      `}</style>

      {/* Orb 1 */}
      <div
        className="orb fixed pointer-events-none z-0"
        style={{
          top: '-10%', left: '-5%',
          width: '55vw', height: '55vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.13) 0%, transparent 70%)',
          animation: 'drift 18s ease-in-out infinite',
        }}
      />
      {/* Orb 2 */}
      <div
        className="orb fixed pointer-events-none z-0"
        style={{
          bottom: '-15%', right: '-5%',
          width: '50vw', height: '50vw',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
          animation: 'driftB 22s ease-in-out infinite',
        }}
      />

      {/* ── Left panel (desktop only) ── */}
      <div className="hidden lg:flex flex-col justify-center px-16 xl:px-24 w-1/2 relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-16">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <LogoIcon />
          </div>
          <span className="text-xl font-bold tracking-tight" style={{ color: '#f0f0f8', letterSpacing: '-0.03em' }}>
            Job<span style={{ color: '#6366f1' }}>Agent</span>
          </span>
        </div>

        {/* Headline */}
        <h1 className="text-4xl xl:text-5xl font-bold mb-4 leading-tight" style={{ color: '#f0f0f8', letterSpacing: '-0.04em' }}>
          Your job search,<br />
          <span style={{ color: '#6366f1' }}>fully automated.</span>
        </h1>
        <p className="text-base mb-12" style={{ color: '#9090a8', lineHeight: '1.7', maxWidth: '380px' }}>
          Connect your LinkedIn account and let JobAgent find, score, and apply to jobs that match your profile — while you focus on what matters.
        </p>

        {/* Feature bullets */}
        <div className="flex flex-col gap-2">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="feature-item flex items-start gap-3.5 rounded-xl px-4 py-3.5 cursor-default"
            >
              <div
                className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mt-0.5"
                style={{ backgroundColor: 'rgba(99,102,241,0.15)', color: '#818cf8' }}
              >
                {f.icon}
              </div>
              <div>
                <p className="text-sm font-semibold mb-0.5" style={{ color: '#e0e0f0' }}>{f.title}</p>
                <p className="text-xs leading-relaxed" style={{ color: '#6b7280' }}>{f.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Bottom badge */}
        <div className="mt-12 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-xs" style={{ color: '#6b7280' }}>Actively maintained · Open source</span>
        </div>
      </div>

      {/* ── Right panel: login card ── */}
      <div className="flex flex-1 items-center justify-center px-6 py-10 relative z-10">
        {/* Mobile logo (shown only < lg) */}
        <div className="absolute top-6 left-6 flex items-center gap-2 lg:hidden">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
          >
            <LogoIcon />
          </div>
          <span className="text-lg font-bold tracking-tight" style={{ color: '#f0f0f8', letterSpacing: '-0.03em' }}>
            Job<span style={{ color: '#6366f1' }}>Agent</span>
          </span>
        </div>

        {/* Card */}
        <div
          className="w-full max-w-sm rounded-2xl px-8 py-9"
          style={{
            backgroundColor: '#1a1a24',
            border: '1px solid rgba(255,255,255,0.06)',
            boxShadow: '0 0 0 1px rgba(99,102,241,0.08), 0 24px 64px rgba(0,0,0,0.5), 0 0 80px rgba(99,102,241,0.05)',
          }}
        >
          {/* Headline */}
          <h2
            className="text-2xl font-bold mb-1.5"
            style={{ color: '#f0f0f8', letterSpacing: '-0.03em' }}
          >
            Welcome back
          </h2>
          <p className="text-sm mb-7" style={{ color: '#6b7280', lineHeight: '1.6' }}>
            Sign in to continue to your dashboard
          </p>

          {/* Session expired banner (amber — informational) */}
          {reasonMessage !== null && (
            <div
              role="status"
              className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-5"
              style={{
                backgroundColor: 'rgba(245,158,11,0.08)',
                border: '1px solid rgba(245,158,11,0.25)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <span className="text-xs leading-relaxed" style={{ color: '#fcd34d' }}>{reasonMessage}</span>
            </div>
          )}

          {/* Error banner (red — auth failures) */}
          {errorMessage !== null && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 mb-5"
              style={{
                backgroundColor: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.25)',
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                <circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" />
              </svg>
              <span className="text-xs leading-relaxed" style={{ color: '#fca5a5' }}>{errorMessage}</span>
            </div>
          )}

          {/* LinkedIn button */}
          <button
            type="button"
            onClick={handleLinkedInSignIn}
            className="auth-btn w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold text-white mb-3 cursor-pointer"
            style={{ backgroundColor: '#0a66c2' }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0958a8';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 20px rgba(10,102,194,0.4)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = '#0a66c2';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '';
            }}
          >
            <LinkedInIcon />
            Continue with LinkedIn
          </button>

          {/* Divider */}
          <div className="flex items-center gap-3 my-4">
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
            <span className="text-xs" style={{ color: '#4b5563' }}>or</span>
            <div className="flex-1 h-px" style={{ backgroundColor: 'rgba(255,255,255,0.06)' }} />
          </div>

          {/* Google button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            className="auth-btn w-full flex items-center justify-center gap-2.5 px-5 py-3 rounded-xl text-sm font-semibold mb-7 cursor-pointer"
            style={{
              backgroundColor: 'rgba(255,255,255,0.04)',
              color: '#e0e0f0',
              border: '1px solid rgba(255,255,255,0.08)',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.08)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.14)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'rgba(255,255,255,0.04)';
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(255,255,255,0.08)';
            }}
          >
            <GoogleIcon />
            Continue with Google
          </button>

          {/* Footer */}
          <p className="text-center text-xs leading-relaxed" style={{ color: '#4b5563' }}>
            By signing in you agree to our{' '}
            <span className="underline cursor-pointer" style={{ color: '#6b7280' }}>
              Terms of Service
            </span>
            .
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
