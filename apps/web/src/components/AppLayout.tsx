import React, { useCallback } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth.store';
import { api } from '../lib/api';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#0f0f14',
  sidebar: '#13131c',
  border: '#1e1e2e',
  accent: '#6366f1',
  accentBg: 'rgba(99,102,241,0.12)',
  text: '#e4e4f0',
  textMuted: '#5a5a78',
  hover: '#1a1a2e',
} as const;

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icon = {
  Logo: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path d="M12 2L2 7l10 5 10-5-10-5z" fill={C.accent} />
      <path d="M2 17l10 5 10-5" stroke={C.accent} strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M2 12l10 5 10-5" stroke={C.accent} strokeWidth="2" strokeLinecap="round" fill="none" opacity="0.6" />
    </svg>
  ),
  Config: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  Profile: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
    </svg>
  ),
  History: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Report: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  ),
  Applications: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="20" height="16" x="2" y="4" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  ),
  Logout: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  ),
} as const;

// ─── Nav items ────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { to: '/config',       label: 'Search Config', Icon: Icon.Config       },
  { to: '/profile',      label: 'Profile',       Icon: Icon.Profile      },
  { to: '/applications', label: 'Applications',  Icon: Icon.Applications },
  { to: '/history',      label: 'History',       Icon: Icon.History      },
  { to: '/report',       label: 'Last Report',   Icon: Icon.Report       },
] as const;

// ─── NavItem ──────────────────────────────────────────────────────────────────
interface NavItemProps {
  to: string;
  label: string;
  IconComponent: () => React.ReactElement;
  badge?: number;
}

const NavItem: React.FC<NavItemProps> = ({ to, label, IconComponent, badge }) => (
  <NavLink
    to={to}
    style={({ isActive }) => ({
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '8px 12px',
      borderRadius: 8,
      textDecoration: 'none',
      fontSize: 13,
      fontWeight: isActive ? 500 : 400,
      color: isActive ? C.text : C.textMuted,
      background: isActive ? C.accentBg : 'transparent',
      transition: 'background 0.15s, color 0.15s',
    })}
    onMouseEnter={(e) => {
      const el = e.currentTarget as HTMLAnchorElement;
      if (!el.getAttribute('aria-current')) {
        el.style.background = C.hover;
        el.style.color = C.text;
      }
    }}
    onMouseLeave={(e) => {
      const el = e.currentTarget as HTMLAnchorElement;
      if (!el.getAttribute('aria-current')) {
        el.style.background = 'transparent';
        el.style.color = C.textMuted;
      }
    }}
    aria-label={label}
  >
    <IconComponent />
    {label}
    {badge != null && badge > 0 && (
      <span
        style={{
          marginLeft: 'auto',
          fontSize: 11,
          fontWeight: 600,
          color: '#818cf8',
          background: 'rgba(99,102,241,0.12)',
          padding: '1px 7px',
          borderRadius: 999,
          lineHeight: 1.5,
        }}
      >
        {badge}
      </span>
    )}
  </NavLink>
);

// ─── AppLayout ────────────────────────────────────────────────────────────────
const AppLayout: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const { data: pendingData } = useQuery<{ count: number }>({
    queryKey: ['applications-pending-count'],
    queryFn: async () => {
      const res = await api.get<{ count: number }>('/applications/pending-count');
      return res.data;
    },
    refetchInterval: 60_000, // poll every minute
    retry: false,
  });

  const pendingCount = pendingData?.count ?? 0;

  const handleLogout = useCallback(async () => {
    try {
      await api.post('/auth/logout', {});
    } catch {
      // Logout best-effort — clear local state regardless
    } finally {
      logout();
      navigate('/login');
    }
  }, [logout, navigate]);

  const initials = user?.name
    ? user.name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  return (
    <div style={{ display: 'flex', height: '100vh', background: C.bg, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {/* ── Sidebar ── */}
      <aside style={{
        width: 220,
        minWidth: 220,
        display: 'flex',
        flexDirection: 'column',
        background: C.sidebar,
        borderRight: `1px solid ${C.border}`,
        padding: '16px 12px',
        gap: 4,
      }}>
        {/* Logo */}
        <NavLink
          to="/config"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            marginBottom: 16,
            textDecoration: 'none',
          }}
          aria-label="Go to home"
        >
          <Icon.Logo />
          <span style={{ fontSize: 15, fontWeight: 600, color: C.text, letterSpacing: '-0.02em' }}>
            Job Agent
          </span>
        </NavLink>

        {/* Nav section label */}
        <span style={{ fontSize: 10, fontWeight: 600, color: C.textMuted, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '0 12px', marginBottom: 4 }}>
          Navigation
        </span>

        {/* Nav items */}
        {NAV_ITEMS.map(({ to, label, Icon: IconComponent }) => (
          <NavItem
            key={to}
            to={to}
            label={label}
            IconComponent={IconComponent}
            badge={to === '/applications' ? pendingCount : undefined}
          />
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* User + logout */}
        <div style={{
          borderTop: `1px solid ${C.border}`,
          paddingTop: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}>
          {/* User info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px' }}>
            {/* Avatar */}
            {user?.photo ? (
              <img
                src={user.photo}
                alt={user.name}
                width={32}
                height={32}
                loading="lazy"
                style={{ borderRadius: '50%', flexShrink: 0, objectFit: 'cover' }}
              />
            ) : (
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: C.accentBg,
                border: `1px solid ${C.accent}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 11,
                fontWeight: 600,
                color: C.accent,
                flexShrink: 0,
              }}>
                {initials}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.name ?? 'User'}
              </div>
              <div style={{ fontSize: 11, color: C.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user?.email ?? ''}
              </div>
            </div>
          </div>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            aria-label="Sign out"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '7px 12px',
              background: 'transparent',
              border: 'none',
              borderRadius: 8,
              color: C.textMuted,
              fontSize: 13,
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'background 0.15s, color 0.15s',
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = 'rgba(239,68,68,0.1)';
              el.style.color = '#ef4444';
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget as HTMLButtonElement;
              el.style.background = 'transparent';
              el.style.color = C.textMuted;
            }}
          >
            <Icon.Logout />
            Sign out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <main style={{ flex: 1, overflowY: 'auto', background: C.bg }}>
        <Outlet />
      </main>
    </div>
  );
};

export default AppLayout;
