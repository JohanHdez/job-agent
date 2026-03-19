import React from 'react';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface FiltersState {
  status: string;
  company: string;
  platform: string;
  dateFrom: string;
  dateTo: string;
}

export interface ApplicationFiltersProps {
  filters: FiltersState;
  onChange: (filters: FiltersState) => void;
  onClear: () => void;
}

/* ── Styles ─────────────────────────────────────────────────────────────────── */

const controlStyle: React.CSSProperties = {
  background: '#13131c',
  border: '1px solid #2a2a38',
  color: '#e2e2e8',
  borderRadius: 8,
  padding: '8px 12px',
  fontSize: 13,
  outline: 'none',
  fontFamily: 'Inter, system-ui, sans-serif',
  cursor: 'pointer',
};

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'draft', label: 'Draft' },
  { value: 'pending_review', label: 'Pending Review' },
  { value: 'sent', label: 'Sent' },
  { value: 'tracking_active', label: 'Tracking Active' },
  { value: 'interview_scheduled', label: 'Interview Scheduled' },
  { value: 'offer_received', label: 'Offer Received' },
  { value: 'rejected', label: 'Rejected' },
];

const PLATFORM_OPTIONS = [
  { value: '', label: 'All Platforms' },
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'computrabajo', label: 'Computrabajo' },
  { value: 'glassdoor', label: 'Glassdoor' },
  { value: 'other', label: 'Other' },
];

/* ── ApplicationFilters ─────────────────────────────────────────────────────── */

/**
 * Horizontal filter row for application history.
 * Controls: status dropdown, company text input, platform dropdown, date range.
 */
const ApplicationFilters: React.FC<ApplicationFiltersProps> = ({ filters, onChange, onClear }) => {
  const isActive =
    filters.status !== '' ||
    filters.company !== '' ||
    filters.platform !== '' ||
    filters.dateFrom !== '' ||
    filters.dateTo !== '';

  const update = (key: keyof FiltersState, value: string) => {
    onChange({ ...filters, [key]: value });
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        flexWrap: 'wrap',
      }}
    >
      {/* Status */}
      <select
        aria-label="Filter by status"
        value={filters.status}
        onChange={(e) => update('status', e.target.value)}
        style={controlStyle}
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Company */}
      <input
        type="text"
        aria-label="Filter by company"
        placeholder="Filter by company..."
        value={filters.company}
        onChange={(e) => update('company', e.target.value)}
        style={{ ...controlStyle, minWidth: 160 }}
      />

      {/* Platform */}
      <select
        aria-label="Filter by platform"
        value={filters.platform}
        onChange={(e) => update('platform', e.target.value)}
        style={controlStyle}
      >
        {PLATFORM_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>

      {/* Date from */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          From
        </span>
        <input
          type="date"
          aria-label="Date from"
          value={filters.dateFrom}
          onChange={(e) => update('dateFrom', e.target.value)}
          style={{ ...controlStyle, cursor: 'text' }}
        />
      </div>

      {/* Date to */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          To
        </span>
        <input
          type="date"
          aria-label="Date to"
          value={filters.dateTo}
          onChange={(e) => update('dateTo', e.target.value)}
          style={{ ...controlStyle, cursor: 'text' }}
        />
      </div>

      {/* Clear filters */}
      {isActive && (
        <button
          type="button"
          onClick={onClear}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6b7280',
            fontSize: 13,
            padding: '4px 0',
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'color 0.15s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
};

export default ApplicationFilters;
