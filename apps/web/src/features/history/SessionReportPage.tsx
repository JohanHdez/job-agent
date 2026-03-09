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
  applied:                  { background: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Applied'          },
  failed:                   { background: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Failed'           },
  skipped_low_score:        { background: 'rgba(234,179,8,0.12)',   color: '#eab308', label: 'Skipped'          },
  already_applied:          { background: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Already Applied'  },
  easy_apply_not_available: { background: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'No Easy Apply'    },
};

/* ── Helpers ──────────────────────────────────────────────────────────────── */

/** Returns "YYYY-MM-DD" for a given ISO date string, used to group records by day. */
function toDateKey(isoString: string): string {
  return isoString.slice(0, 10);
}

/**
 * Groups records by date (YYYY-MM-DD) and returns the records belonging to the
 * most recent session date.
 */
function filterLastSession(records: ApplicationRecord[]): ApplicationRecord[] {
  if (records.length === 0) return [];

  const sorted = [...records].sort(
    (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
  );

  const latestDateKey = toDateKey(sorted[0].appliedAt);
  return records.filter((r) => toDateKey(r.appliedAt) === latestDateKey);
}

/** Returns accent color based on score threshold. */
function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

/** Formats a date string into a human-readable session label. */
function formatSessionDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

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

const IconFileBarChart: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </svg>
);

const IconDownload: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
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
 * Table showing applications for the current session.
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
      <IconFileBarChart />
    </div>
    <p style={{ fontSize: '15px', fontWeight: 500, color: '#e2e2e8', margin: '0 0 8px' }}>
      No applications yet
    </p>
    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
      Run the agent to start applying. Your session report will appear here.
    </p>
  </div>
);

/* ── Main page ────────────────────────────────────────────────────────────── */

/**
 * Session Report page — shows stats and application records for the most recent session,
 * grouped by the most recent date found in the applications array.
 */
const SessionReportPage: React.FC = () => {
  const { data, isLoading, isError } = useQuery<ApplicationsApiResponse>({
    queryKey: ['applications'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/jobs/applications`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ApplicationsApiResponse>;
    },
    retry: false,
  });

  const allRecords     = data?.records ?? [];
  const sessionRecords = filterLastSession(allRecords);

  const lastSessionDate = sessionRecords.length > 0
    ? formatSessionDate(
        [...sessionRecords].sort(
          (a, b) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime(),
        )[0].appliedAt,
      )
    : null;

  const found   = sessionRecords.length;
  const applied = sessionRecords.filter((r) => r.status === 'applied').length;
  const skipped = sessionRecords.filter((r) => r.status === 'skipped_low_score').length;
  const failed  = sessionRecords.filter((r) => r.status === 'failed').length;

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
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '32px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: '#f0f0f8',
                margin: '0 0 6px',
              }}
            >
              Session Report
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              {lastSessionDate
                ? `Last session: ${lastSessionDate}`
                : 'No sessions recorded yet.'}
            </p>
          </div>

          {/* Download report — placeholder, disabled */}
          <button
            disabled
            aria-disabled="true"
            title="Report download is not available yet"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              border: '1px solid #2a2a38',
              cursor: 'not-allowed',
              background: '#1a1a24',
              color: '#4a4a5a',
              opacity: 0.6,
            }}
          >
            <IconDownload />
            Download Report
          </button>
        </div>

        {/* ── Loading ── */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#6b7280', gap: '10px' }}>
            <IconLoader />
            <span style={{ fontSize: '13px' }}>Loading session data…</span>
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
            {/* Stats row — last session only */}
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
            {sessionRecords.length > 0
              ? <ApplicationTable records={sessionRecords} />
              : <EmptyState />
            }
          </>
        )}
      </div>
    </div>
  );
};

export default SessionReportPage;
