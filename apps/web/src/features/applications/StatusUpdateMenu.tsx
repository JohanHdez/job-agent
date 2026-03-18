import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface StatusUpdateMenuProps {
  applicationId: string;
  currentStatus: string;
  onStatusUpdated: () => void;
  onClose: () => void;
}

interface StatusOption {
  value: string;
  label: string;
  color: string;
}

/* ── Constants ──────────────────────────────────────────────────────────────── */

const STATUS_OPTIONS: StatusOption[] = [
  { value: 'tracking_active',     label: 'Tracking Active',     color: '#6366f1' },
  { value: 'interview_scheduled', label: 'Interview Scheduled', color: '#eab308' },
  { value: 'offer_received',      label: 'Offer Received',      color: '#22c55e' },
  { value: 'rejected',            label: 'Rejected',            color: '#ef4444' },
];

/* ── StatusUpdateMenu ───────────────────────────────────────────────────────── */

/**
 * Inline dropdown menu for manually updating an application's tracking status.
 * Supports keyboard navigation (arrow keys, Enter, Escape) and an optional note.
 * Accessible via role="menu" with aria-label.
 */
const StatusUpdateMenu: React.FC<StatusUpdateMenuProps> = ({
  applicationId,
  currentStatus,
  onStatusUpdated,
  onClose,
}) => {
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  // Focus first item on mount
  useEffect(() => {
    const firstItem = menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]');
    firstItem?.focus();
  }, []);

  // Focus note input after status is selected
  useEffect(() => {
    if (selectedStatus !== null) {
      setTimeout(() => noteRef.current?.focus(), 50);
    }
  }, [selectedStatus]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectedStatus !== null) return; // note input handles its own keys

      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        const next = Math.min(focusedIndex + 1, STATUS_OPTIONS.length - 1);
        setFocusedIndex(next);
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
        items?.[next]?.focus();
        return;
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prev = Math.max(focusedIndex - 1, 0);
        setFocusedIndex(prev);
        const items = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]');
        items?.[prev]?.focus();
        return;
      }

      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        const opt = STATUS_OPTIONS[focusedIndex];
        if (opt) setSelectedStatus(opt.value);
        return;
      }
    },
    [focusedIndex, selectedStatus, onClose]
  );

  const handleConfirm = async () => {
    if (!selectedStatus) return;
    setIsSaving(true);
    try {
      await api.patch(`/applications/${applicationId}/status`, {
        status: selectedStatus,
        ...(note.trim() ? { note: note.trim() } : {}),
      });
      onStatusUpdated();
      onClose();
    } catch {
      // noop — leave menu open so user can retry
    } finally {
      setIsSaving(false);
    }
  };

  const selectedOption = STATUS_OPTIONS.find((o) => o.value === selectedStatus);

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Update application status"
      onKeyDown={handleKeyDown}
      style={{
        background: '#1a1a24',
        border: '1px solid #2a2a38',
        borderRadius: 10,
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        padding: 8,
        minWidth: 220,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Status options */}
      {STATUS_OPTIONS.map((opt, idx) => (
        <button
          key={opt.value}
          role="menuitem"
          tabIndex={idx === 0 ? 0 : -1}
          aria-current={opt.value === currentStatus ? 'true' : undefined}
          onClick={() => setSelectedStatus(opt.value)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            width: '100%',
            padding: '8px 10px',
            background: selectedStatus === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent',
            border: 'none',
            borderRadius: 7,
            cursor: 'pointer',
            color: '#e2e2e8',
            fontSize: 13,
            fontFamily: 'Inter, system-ui, sans-serif',
            textAlign: 'left',
            transition: 'background 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.04)'; }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background =
              selectedStatus === opt.value ? 'rgba(99,102,241,0.08)' : 'transparent';
          }}
        >
          {/* Color dot */}
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              backgroundColor: opt.color,
              flexShrink: 0,
            }}
          />
          {opt.label}
        </button>
      ))}

      {/* Note + confirm panel (shown after selection) */}
      {selectedStatus !== null && (
        <div
          style={{
            borderTop: '1px solid #2a2a38',
            marginTop: 6,
            paddingTop: 10,
            paddingLeft: 10,
            paddingRight: 10,
            paddingBottom: 4,
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
          }}
        >
          {selectedOption && (
            <p style={{ fontSize: 11, color: '#6b7280', margin: '0 0 4px' }}>
              Updating to:{' '}
              <span style={{ color: selectedOption.color, fontWeight: 600 }}>
                {selectedOption.label}
              </span>
            </p>
          )}

          <textarea
            ref={noteRef}
            rows={2}
            placeholder="Add a note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            style={{
              background: '#13131c',
              border: '1px solid #2a2a38',
              borderRadius: 6,
              color: '#e2e2e8',
              fontSize: 12,
              padding: '7px 10px',
              resize: 'vertical',
              outline: 'none',
              fontFamily: 'Inter, system-ui, sans-serif',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button
              type="button"
              onClick={() => { void handleConfirm(); }}
              disabled={isSaving}
              style={{
                flex: 1,
                height: 34,
                background: isSaving ? 'rgba(99,102,241,0.5)' : '#6366f1',
                border: 'none',
                borderRadius: 7,
                color: '#fff',
                fontSize: 12,
                fontWeight: 600,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              Save Status
            </button>

            <button
              type="button"
              onClick={() => {
                setSelectedStatus(null);
                setNote('');
              }}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: 12,
                fontFamily: 'Inter, system-ui, sans-serif',
                padding: '4px 0',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
            >
              Never mind
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default StatusUpdateMenu;
