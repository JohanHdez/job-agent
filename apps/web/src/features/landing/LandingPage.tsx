import { useNavigate } from 'react-router-dom';

/* ── SVG icon components ──────────────────────────────────────────────────── */
const IconBrain: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/>
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/>
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/>
    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/>
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/>
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396"/>
    <path d="M19.938 10.5a4 4 0 0 1 .585.396"/>
    <path d="M6 18a4 4 0 0 1-1.967-.516"/>
    <path d="M19.967 17.484A4 4 0 0 1 18 18"/>
  </svg>
);

const IconZap: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/>
  </svg>
);

const IconShield: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
  </svg>
);

const IconBarChart: React.FC = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" x2="12" y1="20" y2="10"/>
    <line x1="18" x2="18" y1="20" y2="4"/>
    <line x1="6" x2="6" y1="20" y2="16"/>
  </svg>
);

const IconUpload: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
    <polyline points="17 8 12 3 7 8"/>
    <line x1="12" x2="12" y1="3" y2="15"/>
  </svg>
);

const IconSettings: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const IconRocket: React.FC = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
    <path d="m12 15-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
    <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
    <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
  </svg>
);

/* ── Data ─────────────────────────────────────────────────────────────────── */
interface Feature {
  icon: React.FC;
  title: string;
  description: string;
}

const FEATURES: Feature[] = [
  {
    icon: IconBrain,
    title: 'AI-Powered Matching',
    description: 'Claude scores every job 0–100 against your CV so you only apply where you truly fit.',
  },
  {
    icon: IconZap,
    title: 'Auto Apply',
    description: 'LinkedIn Easy Apply automated and rate-limited to keep your account safe.',
  },
  {
    icon: IconShield,
    title: 'Secure by Default',
    description: 'OAuth tokens encrypted at rest with AES-256-GCM. Your data stays yours.',
  },
  {
    icon: IconBarChart,
    title: 'Session Reports',
    description: 'Every run generates a detailed report with scores, statuses and next steps.',
  },
];

interface Step {
  icon: React.FC;
  title: string;
  description: string;
}

const STEPS: Step[] = [
  { icon: IconUpload, title: 'Upload your CV', description: 'Drop a PDF and Claude extracts your full professional profile — skills, experience, languages — automatically.' },
  { icon: IconSettings, title: 'Configure your search', description: 'Set keywords, location, seniority, modality and the minimum compatibility score to apply.' },
  { icon: IconRocket, title: 'Sit back', description: "The agent searches, scores and applies while you focus on what matters. Check the report when it's done." },
];

/* ── Component ────────────────────────────────────────────────────────────── */
const LandingPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div style={{ backgroundColor: '#0f0f14', color: '#e2e2e8', minHeight: '100vh', fontFamily: "'Inter', system-ui, sans-serif" }}>

      {/* ── Ambient glow ── */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.12) 0%, transparent 70%)',
      }} />

      {/* ── Nav ─────────────────────────────────────────────────────── */}
      <nav style={{ position: 'relative', zIndex: 10, borderBottom: '1px solid #2a2a38', backdropFilter: 'blur(12px)', backgroundColor: 'rgba(15,15,20,0.8)' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '0 24px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            </div>
            <span style={{ fontWeight: 700, fontSize: '15px', letterSpacing: '-0.02em', color: '#f0f0f8' }}>
              Job<span style={{ color: '#6366f1' }}>Agent</span>
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <a
              href="https://github.com/JohanHdez/job-agent"
              target="_blank"
              rel="noreferrer"
              style={{ fontSize: '13px', color: '#9090a8', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#f0f0f8')}
              onMouseLeave={e => (e.currentTarget.style.color = '#9090a8')}
            >
              GitHub
            </a>
            <button
              onClick={() => navigate('/login')}
              style={{ fontSize: '13px', fontWeight: 500, padding: '7px 16px', borderRadius: '8px', border: '1px solid #3a3a52', backgroundColor: '#1a1a24', color: '#e2e2e8', cursor: 'pointer', transition: 'all 0.15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#6366f1'; e.currentTarget.style.color = '#f0f0f8'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#3a3a52'; e.currentTarget.style.color = '#e2e2e8'; }}
            >
              Sign in
            </button>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '1152px', margin: '0 auto', padding: '96px 24px 80px', textAlign: 'center' }}>

        {/* Badge pill */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '5px 14px', borderRadius: '999px', marginBottom: '32px',
          backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.25)', fontSize: '12px', fontWeight: 500, color: '#a5b4fc',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#6366f1', display: 'inline-block', boxShadow: '0 0 6px #6366f1' }} />
          Powered by Claude AI · LinkedIn · Playwright
        </div>

        {/* Headline */}
        <h1 style={{ fontSize: 'clamp(40px, 6vw, 64px)', fontWeight: 800, letterSpacing: '-0.04em', lineHeight: 1.1, marginBottom: '24px', color: '#f0f0f8' }}>
          Your job search,<br />
          <span style={{ background: 'linear-gradient(135deg, #6366f1 0%, #a78bfa 50%, #38bdf8 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
            fully automated.
          </span>
        </h1>

        {/* Subheadline */}
        <p style={{ fontSize: '17px', lineHeight: 1.7, color: '#9090a8', maxWidth: '520px', margin: '0 auto 40px' }}>
          Upload your CV, set your filters, and let the agent find, score and apply to jobs
          while you focus on what actually matters.
        </p>

        {/* CTAs */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '12px 28px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: '#fff',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 24px rgba(99,102,241,0.25)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(99,102,241,0.6), 0 8px 32px rgba(99,102,241,0.35)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(99,102,241,0.4), 0 4px 24px rgba(99,102,241,0.25)'; }}
          >
            Get started — it&apos;s free
          </button>
          <a
            href="https://github.com/JohanHdez/job-agent"
            target="_blank"
            rel="noreferrer"
            style={{
              padding: '12px 28px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', cursor: 'pointer',
              backgroundColor: '#1a1a24', color: '#e2e2e8', border: '1px solid #2a2a38',
              display: 'inline-flex', alignItems: 'center', gap: '8px', transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = '#3a3a52'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a38'; e.currentTarget.style.transform = ''; }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            View on GitHub
          </a>
        </div>

        {/* Social proof strip */}
        <div style={{ marginTop: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '32px', flexWrap: 'wrap' }}>
          {['Open Source', 'AES-256-GCM Encrypted', 'LinkedIn OIDC', 'Claude AI'].map(item => (
            <span key={item} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6b7280' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              {item}
            </span>
          ))}
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '1152px', margin: '0 auto', padding: '0 24px 96px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: '12px' }}>Features</p>
          <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', color: '#f0f0f8' }}>Everything you need to land the role</h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
          {FEATURES.map(f => {
            const Icon = f.icon;
            return (
              <div
                key={f.title}
                style={{ borderRadius: '14px', padding: '28px', backgroundColor: '#1a1a24', border: '1px solid #2a2a38', transition: 'all 0.2s', cursor: 'default' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(99,102,241,0.5)'; e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(99,102,241,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#2a2a38'; e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; }}
              >
                <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', marginBottom: '20px' }}>
                  <Icon />
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f8', marginBottom: '8px' }}>{f.title}</h3>
                <p style={{ fontSize: '13px', lineHeight: 1.6, color: '#6b7280' }}>{f.description}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, borderTop: '1px solid #2a2a38', borderBottom: '1px solid #2a2a38', backgroundColor: 'rgba(26,26,36,0.4)' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '80px 24px' }}>
          <div style={{ textAlign: 'center', marginBottom: '60px' }}>
            <p style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#6366f1', marginBottom: '12px' }}>How it works</p>
            <h2 style={{ fontSize: '28px', fontWeight: 700, letterSpacing: '-0.03em', color: '#f0f0f8' }}>Up and running in minutes</h2>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '0', position: 'relative' }}>
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '0 32px', position: 'relative' }}>
                  {/* Connector line */}
                  {i < STEPS.length - 1 && (
                    <div style={{ position: 'absolute', top: '28px', left: '50%', width: '100%', height: '1px', background: 'linear-gradient(90deg, rgba(99,102,241,0.4), rgba(99,102,241,0.1))', zIndex: 0 }} />
                  )}

                  {/* Step circle */}
                  <div style={{ position: 'relative', zIndex: 1, width: '56px', height: '56px', borderRadius: '16px', background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(99,102,241,0.05))', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6366f1', marginBottom: '24px' }}>
                    <Icon />
                    <span style={{ position: 'absolute', top: '-8px', right: '-8px', width: '20px', height: '20px', borderRadius: '50%', backgroundColor: '#6366f1', color: '#fff', fontSize: '10px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {i + 1}
                    </span>
                  </div>

                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#f0f0f8', marginBottom: '10px' }}>{s.title}</h3>
                  <p style={{ fontSize: '13px', lineHeight: 1.65, color: '#6b7280', maxWidth: '260px' }}>{s.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA card ────────────────────────────────────────────────── */}
      <section style={{ position: 'relative', zIndex: 1, maxWidth: '1152px', margin: '0 auto', padding: '80px 24px' }}>
        <div style={{
          borderRadius: '20px', padding: '64px 48px', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.06) 50%, rgba(56,189,248,0.06) 100%)',
          border: '1px solid rgba(99,102,241,0.25)',
          boxShadow: '0 0 80px rgba(99,102,241,0.06)',
        }}>
          <h2 style={{ fontSize: '32px', fontWeight: 800, letterSpacing: '-0.04em', color: '#f0f0f8', marginBottom: '16px' }}>
            Ready to automate your search?
          </h2>
          <p style={{ fontSize: '15px', color: '#9090a8', marginBottom: '36px', maxWidth: '400px', margin: '0 auto 36px', lineHeight: 1.6 }}>
            Sign in with LinkedIn or Google and start your first automated session in under two minutes.
          </p>
          <button
            onClick={() => navigate('/login')}
            style={{
              padding: '13px 32px', borderRadius: '10px', fontWeight: 600, fontSize: '14px', border: 'none', cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)', color: '#fff',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.5), 0 4px 24px rgba(99,102,241,0.3)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(99,102,241,0.7), 0 8px 36px rgba(99,102,241,0.4)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(99,102,241,0.5), 0 4px 24px rgba(99,102,241,0.3)'; }}
          >
            Get started for free
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────── */}
      <footer style={{ position: 'relative', zIndex: 1, borderTop: '1px solid #2a2a38' }}>
        <div style={{ maxWidth: '1152px', margin: '0 auto', padding: '0 24px', height: '56px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: '13px', fontWeight: 600, color: '#f0f0f8' }}>
            Job<span style={{ color: '#6366f1' }}>Agent</span>
            <span style={{ fontWeight: 400, color: '#6b7280', marginLeft: '8px' }}>— open source</span>
          </span>
          <a
            href="https://github.com/JohanHdez/job-agent"
            target="_blank"
            rel="noreferrer"
            style={{ fontSize: '12px', color: '#6b7280', display: 'flex', alignItems: 'center', gap: '6px', transition: 'color 0.15s' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e2e2e8')}
            onMouseLeave={e => (e.currentTarget.style.color = '#6b7280')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
            GitHub
          </a>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
