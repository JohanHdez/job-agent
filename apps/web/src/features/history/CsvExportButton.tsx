import React, { useState } from 'react';
import { api } from '../../lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface CsvExportButtonProps {
  filters: {
    status?: string;
    dateFrom?: string;
    dateTo?: string;
  };
}

type ExportState = 'idle' | 'loading' | 'done' | 'error';

/* ── Helpers ────────────────────────────────────────────────────────────────── */

/** Returns ISO date string formatted as YYYY-MM-DD */
function todayFormatted(): string {
  return new Date().toISOString().slice(0, 10);
}

/* ── CsvExportButton ────────────────────────────────────────────────────────── */

/**
 * Ghost-style button that downloads the filtered applications list as a CSV file.
 * Handles loading, done, and error states with brief feedback messages.
 */
const CsvExportButton: React.FC<CsvExportButtonProps> = ({ filters }) => {
  const [state, setState] = useState<ExportState>('idle');

  const handleExport = async () => {
    if (state === 'loading') return;
    setState('loading');

    try {
      const params: Record<string, string> = {};
      if (filters.status) params['status'] = filters.status;
      if (filters.dateFrom) params['dateFrom'] = filters.dateFrom;
      if (filters.dateTo) params['dateTo'] = filters.dateTo;

      const response = await api.get<Blob>('/applications/export/csv', {
        params,
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `applications-${todayFormatted()}.csv`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setState('done');
      setTimeout(() => setState('idle'), 2000);
    } catch {
      setState('error');
      setTimeout(() => setState('idle'), 2000);
    }
  };

  const label =
    state === 'loading'
      ? 'Exporting...'
      : state === 'done'
      ? 'Downloaded!'
      : state === 'error'
      ? 'Export failed'
      : 'Export CSV';

  return (
    <button
      type="button"
      onClick={() => { void handleExport(); }}
      disabled={state === 'loading'}
      style={{
        background: 'transparent',
        border: '1px solid #2a2a38',
        borderRadius: 8,
        color: state === 'error' ? '#ef4444' : state === 'done' ? '#22c55e' : '#c8c8d8',
        fontSize: 13,
        fontWeight: 600,
        cursor: state === 'loading' ? 'not-allowed' : 'pointer',
        padding: '8px 14px',
        fontFamily: 'Inter, system-ui, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        whiteSpace: 'nowrap',
        transition: 'color 0.15s, border-color 0.15s',
      }}
      aria-label="Export applications as CSV"
    >
      {state === 'loading' && (
        <svg
          width="13"
          height="13"
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
      )}
      {label}
    </button>
  );
};

export default CsvExportButton;
