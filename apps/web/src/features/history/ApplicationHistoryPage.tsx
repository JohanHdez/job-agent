import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import ApplicationFilters, { type FiltersState } from './ApplicationFilters';
import CsvExportButton from './CsvExportButton';
import ApplicationDetailDrawer from '../applications/ApplicationDetailDrawer';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface ApplicationRecord {
  _id: string;
  status: string;
  recipientEmail?: string;
  createdAt: string;
  vacancy?: {
    title?: string;
    company?: string;
    platform?: string;
    compatibilityScore?: number;
  };
}

interface ApplicationsApiResponse {
  data: ApplicationRecord[];
  total: number;
  page: number;
  pageSize: number;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */

const PAGE_SIZE = 20;

const EMPTY_FILTERS: FiltersState = {
  status: '',
  company: '',
  platform: '',
  dateFrom: '',
  dateTo: '',
};

const STATUS_BADGE_STYLES: Record<string, { background: string; color: string; label: string }> = {
  draft:                    { background: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Draft' },
  pending_review:           { background: 'rgba(99,102,241,0.12)',  color: '#818cf8', label: 'Pending Review' },
  sent:                     { background: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Sent' },
  tracking_active:          { background: 'rgba(99,102,241,0.12)',  color: '#6366f1', label: 'Tracking' },
  interview_scheduled:      { background: 'rgba(234,179,8,0.12)',   color: '#eab308', label: 'Interview' },
  offer_received:           { background: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Offer' },
  rejected:                 { background: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Rejected' },
  // Legacy statuses for backward compat
  applied:                  { background: 'rgba(34,197,94,0.12)',   color: '#22c55e', label: 'Applied' },
  failed:                   { background: 'rgba(239,68,68,0.12)',   color: '#ef4444', label: 'Failed' },
  skipped_low_score:        { background: 'rgba(234,179,8,0.12)',   color: '#eab308', label: 'Skipped' },
  already_applied:          { background: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'Already Applied' },
  easy_apply_not_available: { background: 'rgba(107,114,128,0.12)', color: '#6b7280', label: 'No Easy Apply' },
};

function getStatusStyle(status: string): { background: string; color: string; label: string } {
  return STATUS_BADGE_STYLES[status] ?? { background: 'rgba(107,114,128,0.12)', color: '#6b7280', label: status };
}

/* ── SVG Icons ──────────────────────────────────────────────────────────────── */

const IconLoader: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
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

/* ── Shared sub-components ──────────────────────────────────────────────────── */

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
    <span style={{ fontSize: '28px', fontWeight: 800, color, letterSpacing: '-0.04em', lineHeight: 1 }}>
      {value}
    </span>
    <span style={{ fontSize: '12px', color: '#6b7280', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
      {label}
    </span>
  </div>
);

const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const style = getStatusStyle(status);
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

/* ── Table constants ────────────────────────────────────────────────────────── */

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

/* ── Empty states ───────────────────────────────────────────────────────────── */

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

const FilteredEmptyState: React.FC = () => (
  <div
    style={{
      textAlign: 'center',
      padding: '48px 32px',
      backgroundColor: '#1a1a24',
      border: '1px solid #2a2a38',
      borderRadius: '14px',
    }}
  >
    <p style={{ fontSize: '14px', fontWeight: 500, color: '#e2e2e8', margin: '0 0 8px' }}>
      No results for these filters
    </p>
    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
      Try clearing some filters to see more applications.
    </p>
  </div>
);

/* ── Main page ──────────────────────────────────────────────────────────────── */

/**
 * Application History page — paginated table with filters, CSV export, and row-click drawer.
 * Uses the shared api instance (not raw fetch) for all calls.
 */
const ApplicationHistoryPage: React.FC = () => {
  const [filters, setFilters] = useState<FiltersState>(EMPTY_FILTERS);
  const [page, setPage] = useState(1);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  const buildParams = () => {
    const params: Record<string, string | number> = { page, pageSize: PAGE_SIZE };
    if (filters.status) params['status'] = filters.status;
    if (filters.company) params['company'] = filters.company;
    if (filters.platform) params['platform'] = filters.platform;
    if (filters.dateFrom) params['dateFrom'] = filters.dateFrom;
    if (filters.dateTo) params['dateTo'] = filters.dateTo;
    return params;
  };

  const { data, isLoading, isError, refetch } = useQuery<ApplicationsApiResponse>({
    queryKey: ['applications', filters, page],
    queryFn: async () => {
      const res = await api.get<ApplicationsApiResponse>('/applications', { params: buildParams() });
      return res.data;
    },
    retry: false,
  });

  const records = data?.data ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const isFiltered =
    filters.status !== '' ||
    filters.company !== '' ||
    filters.platform !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  const handleFiltersChange = (newFilters: FiltersState) => {
    setFilters(newFilters);
    setPage(1);
  };

  const handleClearFilters = () => {
    setFilters(EMPTY_FILTERS);
    setPage(1);
  };

  // Stats from first-page totals — counts from all records loaded
  const pendingReview = records.filter((r) => r.status === 'pending_review').length;
  const sent = records.filter((r) => r.status === 'sent').length;
  const tracking = records.filter((r) => r.status === 'tracking_active' || r.status === 'interview_scheduled').length;
  const rejected = records.filter((r) => r.status === 'rejected').length;

  return (
    <div
      style={{
        color: '#e2e2e8',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ maxWidth: '960px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 12,
            marginBottom: 28,
            flexWrap: 'wrap',
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
              Application History
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              All job applications across every agent session.
            </p>
          </div>

          <CsvExportButton filters={{ status: filters.status, dateFrom: filters.dateFrom, dateTo: filters.dateTo }} />
        </div>

        {/* Loading */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#6b7280', gap: '10px' }}>
            <IconLoader />
            <span style={{ fontSize: '13px' }}>Loading applications…</span>
          </div>
        )}

        {/* Error */}
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
            Could not connect to the API. Make sure the server is running.
          </div>
        )}

        {/* Content */}
        {!isLoading && !isError && (
          <>
            {/* Stats row (only when not filtering) */}
            {!isFiltered && records.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  marginBottom: '28px',
                }}
              >
                <StatCard label="Total"    value={total}         color="#6366f1" />
                <StatCard label="Pending"  value={pendingReview} color="#818cf8" />
                <StatCard label="Sent"     value={sent}          color="#22c55e" />
                <StatCard label="Tracking" value={tracking}      color="#eab308" />
                <StatCard label="Rejected" value={rejected}      color="#ef4444" />
              </div>
            )}

            {/* Filters */}
            <div style={{ marginBottom: 20 }}>
              <ApplicationFilters
                filters={filters}
                onChange={handleFiltersChange}
                onClear={handleClearFilters}
              />
            </div>

            {/* Table or empty state */}
            {records.length === 0 && !isFiltered && <EmptyState />}
            {records.length === 0 && isFiltered && <FilteredEmptyState />}

            {records.length > 0 && (
              <>
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
                        const date = new Date(record.createdAt);
                        const dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
                        const isLast = idx === records.length - 1;
                        return (
                          <tr
                            key={record._id}
                            onClick={() => setSelectedAppId(record._id)}
                            style={{ cursor: 'pointer', transition: 'background 0.1s' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'rgba(99,102,241,0.04)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = 'transparent'; }}
                          >
                            <td style={{ ...TD_STYLE, fontWeight: 600, color: '#e2e2e8', borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                              {record.vacancy?.company ?? '—'}
                            </td>
                            <td style={{ ...TD_STYLE, borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                              {record.vacancy?.title ?? '—'}
                            </td>
                            <td style={{ ...TD_STYLE, borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                              <StatusBadge status={record.status} />
                            </td>
                            <td style={{ ...TD_STYLE, textAlign: 'center', borderBottom: isLast ? 'none' : TD_STYLE.borderBottom }}>
                              {record.vacancy?.compatibilityScore !== undefined
                                ? <ScorePill score={record.vacancy.compatibilityScore} />
                                : <span style={{ color: '#6b7280' }}>—</span>}
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

                {/* Pagination */}
                {totalPages > 1 && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginTop: 16,
                      flexWrap: 'wrap',
                      gap: 10,
                    }}
                  >
                    <span style={{ fontSize: 13, color: '#6b7280' }}>
                      Page {page} of {totalPages} ({total} total)
                    </span>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        style={{
                          background: 'transparent',
                          border: '1px solid #2a2a38',
                          borderRadius: 8,
                          color: page === 1 ? '#3a3a50' : '#c8c8d8',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: page === 1 ? 'not-allowed' : 'pointer',
                          padding: '7px 14px',
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                      >
                        Previous
                      </button>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        style={{
                          background: 'transparent',
                          border: '1px solid #2a2a38',
                          borderRadius: 8,
                          color: page >= totalPages ? '#3a3a50' : '#c8c8d8',
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: page >= totalPages ? 'not-allowed' : 'pointer',
                          padding: '7px 14px',
                          fontFamily: 'Inter, system-ui, sans-serif',
                        }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>

      {/* Application Detail Drawer */}
      {selectedAppId && (
        <ApplicationDetailDrawer
          applicationId={selectedAppId}
          onClose={() => setSelectedAppId(null)}
          onStatusUpdated={() => {
            void refetch();
          }}
        />
      )}
    </div>
  );
};

export default ApplicationHistoryPage;
