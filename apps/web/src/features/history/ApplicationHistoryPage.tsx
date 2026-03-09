import React from 'react';
import { useQuery } from '@tanstack/react-query';

/* ── Types (mirrored from packages/core/src/types/job.types.ts) ─────────── */

type ApplicationStatus =
  | 'applied'
  | 'easy_apply_not_available'
  | 'already_applied'
  | 'failed'
  | 'skipped_low_score';

type ApplicationMethod =
  | 'linkedin_easy_apply'
  | 'greenhouse_api'
  | 'lever_api'
  | 'email'
  | 'manual';

interface JobListing {
  id: string;
  title: string;
  company: string;
  location: string;
  modality: 'Remote' | 'Hybrid' | 'On-site';
  description: string;
  requiredSkills: string[];
  postedAt: string;
  applyUrl: string;
  hasEasyApply: boolean;
  compatibilityScore: number;
  platform: string;
}

interface ApplicationRecord {
  job: JobListing;
  status: ApplicationStatus;
  appliedAt: string;
  errorMessage?: string;
  applicationMethod?: ApplicationMethod;
  confirmationId?: string;
}

interface ApplicationsApiResponse {
  records: ApplicationRecord[];
  summary: {
    total: number;
    applied: number;
    failed: number;
    skipped: number;
  } | null;
  message?: string;
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const API_BASE_URL = 'http://localhost:3000';

const STATUS_BADGE_STYLES: Record<ApplicationStatus, { background: string; color: string; label: string }> = {
  applied:                 { background: 'rgba(34,197,94,0.12)',  color: '#22c55e', label: 'Applied'           },
  failed:                  { background: 'rgba(239,68,68,0.12)',  color: '#ef4444', label: 'Failed'            },
  skipped_low_score:       { background: 'rgba(234,179,8,0.12)',  color: '#eab308', label: 'Skipped'           },
  already_applied:         { background: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Already Applied' },
  easy_apply_not_available:{ background: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'No Easy Apply'   },
};

/* ── SVG Icons ────────────────────────────────────────────────────────────── */

const IconLoader: React.FC = () => (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    style={{ animation: 'spin 1s linear infinite' }}
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const IconAlertCircle: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

const IconInbox: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

/* ── Shared sub-components ────────────────────────────────────────────────── */

/**
 * Stat card displaying a labeled numeric value with an accent color.
 */
const StatCard: React.FC<{ label: string; value: number; color: string }> = ({ label, value, color }) => (
  <div
    style={{
      backgroundColor: '#1a1a24',
      border: '1px solid #2a2a38',
      borderRadius: '12px',
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}
  >
    <span
      style={{
        fontSize: '28px',
        fontWeight: 800,
        color,
        letterSpacing: '-0.04em',
        lineHeight: 1,
      }}
    >
      {value}
    </span>
    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
  </div>
);

/**
 * Status badge pill with per-status background and text color.
 */
const StatusBadge: React.FC<{ status: ApplicationStatus }> = ({ status }) => {
  const style = STATUS_BADGE_STYLES[status];
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '11px',
        fontWeight: 600,
        letterSpacing: '0.02em',
        backgroundColor: style.background,
        color: style.color,
        border: `1px solid ${style.color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {style.label}
    </span>
  );
};

/* ── Score pill ───────────────────────────────────────────────────────────── */

/** Returns accent color based on score threshold. */
function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

const ScorePill: React.FC<{ score: number }> = ({ score }) => {
  const color = scoreColor(score);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 700,
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}33`,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {score}
    </span>
  );
};

/* ── Table ────────────────────────────────────────────────────────────────── */

interface ApplicationTableProps {
  records: ApplicationRecord[];
}

const TH_STYLE: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: '11px',
  fontWeight: 600,
  color: '#6b7280',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  borderBottom: '1px solid #2a2a38',
  whiteSpace: 'nowrap',
};

const TD_STYLE: React.CSSProperties = {
  padding: '14px 16px',
  fontSize: '13px',
  color: '#c8c8d8',
  borderBottom: '1px solid #1e1e2a',
  verticalAlign: 'middle',
};

/**
 * Renders an applications table with company, title, status, score, and date columns.
 */
const ApplicationTable: React.FC<ApplicationTableProps> = ({ records }) => (
  <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid #2a2a38' }}>
    <table style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#1a1a24' }}>
      <thead>
        <tr>
          <th style={TH_STYLE}>Company</th>
          <th style={TH_STYLE}>Job Title</th>
          <th style={TH_STYLE}>Status</th>
          <th style={{ ...TH_STYLE, textAlign: 'center' }}>Score</th>
          <th style={TH_STYLE}>Date</th>
        </tr>
      </thead>
      <tbody>
        {records.map((record, idx) => {
          const date = new Date(record.appliedAt);
          const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
          const isLast = idx === records.length - 1;
          return (
            <tr
              key={`${record.job.id}-${idx}`}
              style={{ transition: 'background 0.1s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(99,102,241,0.04)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
            >
              <td style={{ ...TD_STYLE, fontWeight: 600, color: '#e2e2e8', borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                {record.job.company}
              </td>
              <td style={{ ...TD_STYLE, borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                {record.job.title}
              </td>
              <td style={{ ...TD_STYLE, borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                <StatusBadge status={record.status} />
              </td>
              <td style={{ ...TD_STYLE, textAlign: 'center', borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                <ScorePill score={record.job.compatibilityScore} />
              </td>
              <td style={{ ...TD_STYLE, color: '#6b7280', whiteSpace: 'nowrap', borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                {dateStr}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
);

/* ── Empty state ──────────────────────────────────────────────────────────── */

const EmptyState: React.FC = () => (
  <div
    style={{
      textAlign: 'center',
      padding: '72px 32px',
      backgroundColor: '#1a1a24',
      border: '1px solid #2a2a38',
      borderRadius: '14px',
    }}
  >
    <div
      style={{
        width: '64px',
        height: '64px',
        borderRadius: '18px',
        backgroundColor: 'rgba(99,102,241,0.08)',
        border: '1px solid rgba(99,102,241,0.15)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#6366f1',
        margin: '0 auto 20px',
        opacity: 0.7,
      }}
    >
      <IconInbox />
    </div>
    <p style={{ fontSize: '15px', fontWeight: 500, color: '#e2e2e8', margin: '0 0 8px' }}>
      No applications yet
    </p>
    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
      Run the agent to start applying. Results will appear here.
    </p>
  </div>
);

/* ── Main page ────────────────────────────────────────────────────────────── */

/**
 * Application History page — shows all application records with stats and a filterable table.
 */
const ApplicationHistoryPage: React.FC = () => {
  const { data, isLoading, isError } = useQuery<ApplicationsApiResponse>({
    queryKey: ['applications'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/jobs/applications`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ApplicationsApiResponse>;
    },
    retry: false,
  });

  const records = data?.records ?? [];

  const found   = records.length;
  const applied = records.filter((r) => r.status === 'applied').length;
  const skipped = records.filter((r) => r.status === 'skipped_low_score').length;
  const failed  = records.filter((r) => r.status === 'failed').length;

  return (
    <div
      style={{
        backgroundColor: '#0f0f14',
        color: '#e2e2e8',
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.08) 0%, transparent 70%)',
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '960px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* ── Header ── */}
        <div style={{ marginBottom: '32px' }}>
          <h1
            style={{
              fontSize: '24px',
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: '#f0f0f8',
              margin: '0 0 6px',
            }}
          >
            Application History
          </h1>
          <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
            All job applications across every agent session.
          </p>
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#6b7280', gap: '10px' }}>
            <IconLoader />
            <span style={{ fontSize: '13px' }}>Loading applications…</span>
          </div>
        )}

        {/* ── Error ── */}
        {isError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '14px 16px',
              borderRadius: '10px',
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
              fontSize: '13px',
              marginBottom: '24px',
            }}
          >
            <IconAlertCircle />
            Could not connect to the API. Make sure the server is running on port 3002.
          </div>
        )}

        {/* ── Content ── */}
        {!isLoading && !isError && (
          <>
            {/* Stats row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                gap: '12px',
                marginBottom: '28px',
              }}
            >
              <StatCard label="Found"   value={found}   color="#6366f1" />
              <StatCard label="Applied" value={applied} color="#22c55e" />
              <StatCard label="Skipped" value={skipped} color="#eab308" />
              <StatCard label="Failed"  value={failed}  color="#ef4444" />
            </div>

            {/* Table or empty state */}
            {records.length > 0
              ? <ApplicationTable records={records} />
              : <EmptyState />
            }
          </>
        )}
      </div>
    </div>
  );
};

export default ApplicationHistoryPage;
