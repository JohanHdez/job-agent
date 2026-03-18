import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import EmailDraftModal from '../applications/EmailDraftModal';
import PendingReviewQueue from './PendingReviewQueue';

/* ── Types ─────────────────────────────────────────────────────────────────── */

type EmailDetectionMethod = 'apply_options' | 'jd_regex' | 'manual_required';

interface Vacancy {
  _id: string;
  title: string;
  company: string;
  location?: string;
  modality?: string;
  platform?: string;
  url?: string;
  compatibilityScore: number;
  recipientEmail?: string | null;
  emailDetectionMethod?: EmailDetectionMethod | null;
  applicationStatus?: string | null;
}

interface VacanciesApiResponse {
  data: Vacancy[];
  total: number;
  page: number;
  pageSize: number;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

const APPLICATION_STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  draft:                { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Draft' },
  pending_review:       { bg: 'rgba(99,102,241,0.12)',  color: '#818cf8', label: 'Pending Review' },
  sent:                 { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Sent' },
  tracking_active:      { bg: 'rgba(99,102,241,0.12)',  color: '#6366f1', label: 'Tracking' },
  interview_scheduled:  { bg: 'rgba(234,179,8,0.12)',   color: '#eab308', label: 'Interview' },
  offer_received:       { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Offer' },
  rejected:             { bg: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Rejected' },
  applied:              { bg: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Applied' },
};

function getAppStatusStyle(status: string): { bg: string; color: string; label: string } {
  return APPLICATION_STATUS_STYLES[status] ?? { bg: 'rgba(107,114,128,0.12)', color: '#6b7280', label: status };
}

/* ── SVG Icons ──────────────────────────────────────────────────────────────── */

const IconLoader: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
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
  <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
    <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
  </svg>
);

/* ── Sub-components ─────────────────────────────────────────────────────────── */

const ScorePill: React.FC<{ score: number }> = ({ score }) => {
  const color = scoreColor(score);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: 11,
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

const ApplicationStatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const s = getAppStatusStyle(status);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: 11,
        fontWeight: 600,
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

/* ── Vacancy Card ───────────────────────────────────────────────────────────── */

interface VacancyCardProps {
  vacancy: Vacancy;
  onApplyByEmail: (vacancy: Vacancy) => void;
}

const VacancyCard: React.FC<VacancyCardProps> = ({ vacancy, onApplyByEmail }) => {
  const hasApplication = vacancy.applicationStatus != null && vacancy.applicationStatus !== '';
  const canEmailApply =
    !hasApplication &&
    vacancy.emailDetectionMethod !== 'manual_required' &&
    vacancy.recipientEmail != null &&
    vacancy.recipientEmail !== '';
  const isManual = !hasApplication && !canEmailApply;

  return (
    <div
      style={{
        background: '#1a1a24',
        border: '1px solid #2a2a38',
        borderRadius: 12,
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        transition: 'border-color 0.15s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = 'rgba(99,102,241,0.3)'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = '#2a2a38'; }}
    >
      {/* Top: title + score */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ minWidth: 0 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#e2e2e8',
              margin: '0 0 4px',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {vacancy.title}
          </p>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>{vacancy.company}</p>
        </div>
        <ScorePill score={vacancy.compatibilityScore} />
      </div>

      {/* Meta row */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {vacancy.location && (
          <span style={{ fontSize: 11, color: '#6b7280' }}>{vacancy.location}</span>
        )}
        {vacancy.modality && (
          <span style={{ fontSize: 11, color: '#6b7280' }}>· {vacancy.modality}</span>
        )}
        {vacancy.platform && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#818cf8',
              background: 'rgba(99,102,241,0.1)',
              padding: '1px 7px',
              borderRadius: 999,
            }}
          >
            {vacancy.platform}
          </span>
        )}
      </div>

      {/* CTA row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4 }}>
        {/* Already applied: show badge */}
        {hasApplication && (
          <ApplicationStatusBadge status={vacancy.applicationStatus!} />
        )}

        {/* Apply by Email */}
        {canEmailApply && (
          <button
            type="button"
            onClick={() => onApplyByEmail(vacancy)}
            style={{
              background: 'transparent',
              border: '1px solid #6366f1',
              borderRadius: 8,
              color: '#6366f1',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 12px',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'background 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
          >
            Apply by Email
          </button>
        )}

        {/* Apply Manually */}
        {isManual && vacancy.url && (
          <button
            type="button"
            onClick={() => window.open(vacancy.url, '_blank')}
            style={{
              background: 'transparent',
              border: '1px solid #2a2a38',
              borderRadius: 8,
              color: '#6b7280',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              padding: '6px 12px',
              fontFamily: 'Inter, system-ui, sans-serif',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#c8c8d8'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
          >
            Apply Manually
          </button>
        )}

        {/* emailDetectionMethod indicator */}
        {!hasApplication && vacancy.emailDetectionMethod === 'manual_required' && (
          <span style={{ fontSize: 11, color: '#6b7280' }}>No email detected</span>
        )}
      </div>
    </div>
  );
};

/* ── DashboardPage ──────────────────────────────────────────────────────────── */

/**
 * Main dashboard showing scored vacancies with "Apply by Email" or "Apply Manually" buttons,
 * application status badges when already applied, and pending review queue.
 */
const DashboardPage: React.FC = () => {
  const [selectedVacancy, setSelectedVacancy] = useState<Vacancy | null>(null);

  const { data, isLoading, isError, refetch } = useQuery<VacanciesApiResponse>({
    queryKey: ['vacancies', 'dashboard'],
    queryFn: async () => {
      const res = await api.get<VacanciesApiResponse>('/vacancies', {
        params: { includeApplication: 'true' },
      });
      return res.data;
    },
    refetchOnWindowFocus: false,
  });

  const vacancies = data?.data ?? [];

  return (
    <div
      style={{
        backgroundColor: '#0f0f14',
        color: '#e2e2e8',
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          maxWidth: '960px',
          margin: '0 auto',
          padding: '40px 24px 80px',
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: '-0.04em',
              color: '#f0f0f8',
              margin: '0 0 6px',
            }}
          >
            Dashboard
          </h1>
          <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
            Browse scored vacancies and apply by email.
          </p>
        </div>

        {/* Pending Review Queue */}
        {!isLoading && (
          <div style={{ marginBottom: 32 }}>
            <PendingReviewQueue
              onDraftReviewed={() => { void refetch(); }}
            />
          </div>
        )}

        {/* Loading */}
        {isLoading && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '80px 0',
              color: '#6b7280',
              gap: 10,
            }}
          >
            <IconLoader />
            <span style={{ fontSize: 13 }}>Loading vacancies…</span>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '14px 16px',
              borderRadius: 10,
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.2)',
              color: '#f87171',
              fontSize: 13,
              marginBottom: 24,
            }}
          >
            <IconAlertCircle />
            Could not connect to the API. Make sure the server is running.
          </div>
        )}

        {/* Vacancies */}
        {!isLoading && !isError && (
          <>
            {vacancies.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '72px 32px',
                  backgroundColor: '#1a1a24',
                  border: '1px solid #2a2a38',
                  borderRadius: 14,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 18,
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
                <p style={{ fontSize: 15, fontWeight: 500, color: '#e2e2e8', margin: '0 0 8px' }}>
                  No vacancies found yet
                </p>
                <p style={{ fontSize: 13, color: '#6b7280', margin: 0 }}>
                  Run the agent to search and score jobs. Vacancies will appear here.
                </p>
              </div>
            ) : (
              <>
                <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
                  {data?.total ?? vacancies.length} vacancies found
                </p>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: 16,
                  }}
                >
                  {vacancies.map((vacancy) => (
                    <VacancyCard
                      key={vacancy._id}
                      vacancy={vacancy}
                      onApplyByEmail={(v) => setSelectedVacancy(v)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      {/* Email Draft Modal */}
      {selectedVacancy && (
        <EmailDraftModal
          vacancyId={selectedVacancy._id}
          vacancyTitle={selectedVacancy.title}
          company={selectedVacancy.company}
          score={selectedVacancy.compatibilityScore}
          recipientEmail={selectedVacancy.recipientEmail ?? null}
          onClose={() => setSelectedVacancy(null)}
          onSent={() => {
            setSelectedVacancy(null);
            void refetch();
          }}
        />
      )}
    </div>
  );
};

export default DashboardPage;
