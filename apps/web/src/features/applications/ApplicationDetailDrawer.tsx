import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';
import StatusUpdateMenu from './StatusUpdateMenu';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface ApplicationDetailDrawerProps {
  applicationId: string;
  onClose: () => void;
  onStatusUpdated: () => void;
}

interface HistoryEntry {
  status: string;
  timestamp: string;
  note?: string;
}

interface VacancyDetail {
  title: string;
  company: string;
  location?: string;
  platform?: string;
  url?: string;
  compatibilityScore?: number;
}

interface ApplicationDetail {
  _id: string;
  status: string;
  recipientEmail?: string;
  emailContent?: {
    subject: string;
    body: string;
  };
  history: HistoryEntry[];
  createdAt: string;
}

interface DrawerApiResponse {
  application: ApplicationDetail;
  vacancy: VacancyDetail;
}

/* ── Design constants ───────────────────────────────────────────────────────── */

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:                { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Draft' },
  pending_review:       { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8', label: 'Pending Review' },
  sent:                 { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Sent' },
  tracking_active:      { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1', label: 'Tracking' },
  interview_scheduled:  { bg: 'rgba(234,179,8,0.12)',   color: '#eab308', label: 'Interview' },
  offer_received:       { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Offer' },
  rejected:             { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Rejected' },
  applied:              { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Applied' },
  failed:               { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Failed' },
  skipped_low_score:    { bg: 'rgba(234,179,8,0.12)',   color: '#eab308', label: 'Skipped' },
  already_applied:      { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Already Applied' },
};

function getStatusStyle(status: string): { bg: string; color: string; label: string } {
  return STATUS_STYLES[status] ?? { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: status };
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

function formatTs(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return ts;
  }
}

/* ── SVG Icons ──────────────────────────────────────────────────────────────── */

const IconX: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const IconLoader: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const IconChevron: React.FC<{ open: boolean }> = ({ open }) => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.15s' }}>
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/* ── Sub-components ─────────────────────────────────────────────────────────── */

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = getStatusStyle(status);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '0.02em',
        backgroundColor: s.bg,
        color: s.color,
        border: `1px solid ${s.color}33`,
        whiteSpace: 'nowrap',
      }}
    >
      {s.label}
    </span>
  );
};

const ScorePill: React.FC<{ score: number }> = ({ score }) => {
  const color = scoreColor(score);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: 12,
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

/* ── ApplicationDetailDrawer ────────────────────────────────────────────────── */

/**
 * Right-side drawer showing full application detail with status timeline,
 * vacancy info, email content (collapsible), and status update menu.
 */
const ApplicationDetailDrawer: React.FC<ApplicationDetailDrawerProps> = ({
  applicationId,
  onClose,
  onStatusUpdated,
}) => {
  const [data, setData] = useState<DrawerApiResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [emailExpanded, setEmailExpanded] = useState(false);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<Element | null>(null);

  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setIsError(false);
    api
      .get<DrawerApiResponse>(`/applications/${applicationId}`)
      .then((res) => {
        setData(res.data);
        setIsLoading(false);
      })
      .catch(() => {
        setIsError(true);
        setIsLoading(false);
      });
  }, [applicationId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [onClose]
  );

  const handleStatusUpdated = () => {
    setShowStatusMenu(false);
    onStatusUpdated();
    // Refresh application data
    api
      .get<DrawerApiResponse>(`/applications/${applicationId}`)
      .then((res) => setData(res.data))
      .catch(() => { /* noop */ });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 900,
          background: 'rgba(0,0,0,0.3)',
        }}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Application details"
        onKeyDown={handleKeyDown}
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          zIndex: 901,
          width: typeof window !== 'undefined' && window.innerWidth < 640 ? '100%' : 480,
          background: '#1a1a24',
          borderLeft: '1px solid #2a2a38',
          display: 'flex',
          flexDirection: 'column',
          fontFamily: 'Inter, system-ui, sans-serif',
          animation: 'slideIn 0.2s ease',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            padding: '20px 20px 16px',
            borderBottom: '1px solid #2a2a38',
            flexShrink: 0,
          }}
        >
          <div style={{ minWidth: 0 }}>
            {data && (
              <>
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: '#f0f0f8',
                    margin: '0 0 4px',
                    letterSpacing: '-0.02em',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {data.vacancy.title}
                </h2>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{data.vacancy.company}</p>
              </>
            )}
            {isLoading && (
              <div style={{ height: 44, display: 'flex', alignItems: 'center', gap: 8, color: '#6b7280', fontSize: 13 }}>
                <IconLoader />
                Loading…
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close application details"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6b7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 6,
              borderRadius: 6,
              flexShrink: 0,
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#e2e2e8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
          >
            <IconX />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

          {isError && (
            <div
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.2)',
                borderRadius: 8,
                padding: '12px 14px',
                color: '#ef4444',
                fontSize: 13,
              }}
            >
              Could not load application details.
            </div>
          )}

          {data && (
            <>
              {/* 1. Status timeline */}
              <section>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
                  Status Timeline
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[...data.application.history].reverse().map((entry, idx) => (
                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <StatusBadge status={entry.status} />
                        <span style={{ fontSize: 11, color: '#6b7280' }}>{formatTs(entry.timestamp)}</span>
                      </div>
                      {entry.note && (
                        <p style={{ fontSize: 12, color: '#9090a8', margin: '0 0 0 4px', lineHeight: 1.5 }}>
                          {entry.note}
                        </p>
                      )}
                    </div>
                  ))}
                  {data.application.history.length === 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <StatusBadge status={data.application.status} />
                      <span style={{ fontSize: 11, color: '#6b7280' }}>{formatTs(data.application.createdAt)}</span>
                    </div>
                  )}
                </div>
              </section>

              {/* 2. Job details */}
              <section>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
                  Job Details
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {data.vacancy.compatibilityScore !== undefined && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>Match</span>
                      <ScorePill score={data.vacancy.compatibilityScore} />
                    </div>
                  )}
                  {data.vacancy.platform && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>Platform</span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          color: '#818cf8',
                          background: 'rgba(99,102,241,0.1)',
                          padding: '2px 8px',
                          borderRadius: 999,
                        }}
                      >
                        {data.vacancy.platform}
                      </span>
                    </div>
                  )}
                  {data.vacancy.location && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>Location</span>
                      <span style={{ fontSize: 12, color: '#c8c8d8' }}>{data.vacancy.location}</span>
                    </div>
                  )}
                  {data.vacancy.url && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 12, color: '#6b7280', minWidth: 60 }}>URL</span>
                      <a
                        href={data.vacancy.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: 12, color: '#818cf8', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'underline'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.textDecoration = 'none'; }}
                      >
                        View posting
                      </a>
                    </div>
                  )}
                </div>
              </section>

              {/* 3. Email content (collapsible) */}
              {data.application.emailContent && (
                <section>
                  <button
                    type="button"
                    onClick={() => setEmailExpanded((v) => !v)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: 0,
                      marginBottom: emailExpanded ? 12 : 0,
                    }}
                    aria-expanded={emailExpanded}
                  >
                    <h3 style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>
                      Email Sent
                    </h3>
                    <IconChevron open={emailExpanded} />
                  </button>

                  {emailExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e2e8', margin: 0, lineHeight: 1.5 }}>
                        {data.application.emailContent.subject}
                      </p>
                      <div
                        style={{
                          background: '#13131c',
                          borderRadius: 8,
                          padding: 14,
                          fontFamily: 'monospace',
                          fontSize: 12,
                          color: '#c8c8d8',
                          lineHeight: 1.7,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {data.application.emailContent.body}
                      </div>
                      {data.application.recipientEmail && (
                        <p style={{ fontSize: 11, color: '#6b7280', margin: 0 }}>
                          Sent to: {data.application.recipientEmail}
                        </p>
                      )}
                    </div>
                  )}
                </section>
              )}

              {/* 4. Status update */}
              <section>
                <h3 style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', margin: '0 0 12px' }}>
                  Actions
                </h3>
                <div style={{ position: 'relative', display: 'inline-block' }}>
                  <button
                    type="button"
                    onClick={() => setShowStatusMenu((v) => !v)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #2a2a38',
                      borderRadius: 8,
                      color: '#c8c8d8',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '8px 14px',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      transition: 'border-color 0.15s',
                    }}
                  >
                    Update Status
                  </button>

                  {showStatusMenu && (
                    <div style={{ position: 'absolute', top: '100%', left: 0, marginTop: 6, zIndex: 100 }}>
                      <StatusUpdateMenu
                        applicationId={applicationId}
                        currentStatus={data.application.status}
                        onStatusUpdated={handleStatusUpdated}
                        onClose={() => setShowStatusMenu(false)}
                      />
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @media (prefers-reduced-motion: reduce) { * { animation: none !important; } }
      `}</style>
    </>
  );
};

export default ApplicationDetailDrawer;
