import React, { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../../lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface EmailDraftModalProps {
  vacancyId: string;
  vacancyTitle: string;
  company: string;
  score: number;
  recipientEmail: string | null;
  onClose: () => void;
  onSent: () => void;
}

interface ApplicationDocument {
  _id: string;
  emailContent?: {
    subject: string;
    body: string;
  };
  recipientEmail?: string;
}

type ModalState = 'loading' | 'draft' | 'sending' | 'error_generate' | 'error_send';

/* ── Design constants ───────────────────────────────────────────────────────── */

const SUBJECT_MAX = 120;
const BODY_MAX = 800;

/* ── Helpers ────────────────────────────────────────────────────────────────── */

/** Returns accent color based on score threshold. */
function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

/* ── SVG Icons ──────────────────────────────────────────────────────────────── */

const IconX: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const SpinnerSvg: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg
    width={size}
    height={size}
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

/* ── Toast ──────────────────────────────────────────────────────────────────── */

interface ToastProps {
  message: string;
  onDismiss: () => void;
}

const Toast: React.FC<ToastProps> = ({ message, onDismiss }) => {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        top: 20,
        right: 20,
        zIndex: 9999,
        background: '#1a1a24',
        border: '1px solid rgba(34,197,94,0.3)',
        borderRadius: 10,
        padding: '12px 16px',
        color: '#22c55e',
        fontSize: 13,
        fontFamily: 'Inter, system-ui, sans-serif',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: 320,
      }}
    >
      {message}
    </div>
  );
};

/* ── Score pill ─────────────────────────────────────────────────────────────── */

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

/* ── EmailDraftModal ────────────────────────────────────────────────────────── */

/**
 * Full-overlay modal for the email application flow.
 * States: loading → draft → sending → (closes + toast) or error.
 * Accessible: role=dialog, aria-modal, focus trap.
 */
const EmailDraftModal: React.FC<EmailDraftModalProps> = ({
  vacancyId,
  vacancyTitle,
  company,
  score,
  recipientEmail,
  onClose,
  onSent,
}) => {
  const [modalState, setModalState] = useState<ModalState>('loading');
  const [application, setApplication] = useState<ApplicationDocument | null>(null);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipient, setRecipient] = useState(recipientEmail ?? '');
  const [errorMessage, setErrorMessage] = useState('');
  const [toast, setToast] = useState<string | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  const firstFocusRef = useRef<HTMLButtonElement>(null);
  const lastFocusRef = useRef<HTMLButtonElement>(null);
  const previousFocusRef = useRef<Element | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Detect reduced motion preference
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
  }, []);

  // Save and restore focus on mount/unmount
  useEffect(() => {
    previousFocusRef.current = document.activeElement;
    return () => {
      if (previousFocusRef.current instanceof HTMLElement) {
        previousFocusRef.current.focus();
      }
    };
  }, []);

  // Focus first interactive element after loading completes
  useEffect(() => {
    if (modalState === 'draft') {
      setTimeout(() => firstFocusRef.current?.focus(), 50);
    }
  }, [modalState]);

  // Focus trap inside modal
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (!focusable || focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === first) {
            e.preventDefault();
            last?.focus();
          }
        } else {
          if (document.activeElement === last) {
            e.preventDefault();
            first?.focus();
          }
        }
      }
    },
    [onClose]
  );

  // Create application draft on mount
  useEffect(() => {
    let cancelled = false;

    const generate = async () => {
      try {
        const createRes = await api.post<ApplicationDocument>('/applications', { vacancyId });
        if (cancelled) return;

        const app = createRes.data;

        // Mark as pending_review
        try {
          await api.post(`/applications/${app._id}/review`);
        } catch {
          // non-fatal — proceed even if review transition fails
        }
        if (cancelled) return;

        setApplication(app);
        setSubject(app.emailContent?.subject ?? '');
        setBody(app.emailContent?.body ?? '');
        if (app.recipientEmail) setRecipient(app.recipientEmail);
        setModalState('draft');
      } catch (err: unknown) {
        if (cancelled) return;
        const msg = err instanceof Error ? err.message : 'Unknown error.';
        setErrorMessage(msg);
        setModalState('error_generate');
      }
    };

    void generate();
    return () => { cancelled = true; };
  }, [vacancyId]);

  const handleSaveDraft = async () => {
    if (!application) return;
    try {
      await api.patch(`/applications/${application._id}/draft`, {
        emailContent: { subject, body },
        recipientEmail: recipient || undefined,
      });
    } catch {
      // non-fatal save — close anyway
    }
    onClose();
  };

  const handleSend = async () => {
    if (!application) return;
    setModalState('sending');
    try {
      // Save edits first
      await api.patch(`/applications/${application._id}/draft`, {
        emailContent: { subject, body },
        recipientEmail: recipient || undefined,
      });
      // Then send
      await api.post(`/applications/${application._id}/send`);
      setToast(`Email sent to ${recipient}.`);
      onSent();
      // Small delay to let toast render before unmounting
      setTimeout(onClose, 200);
    } catch {
      setModalState('error_send');
    }
  };

  const isNarrow = typeof window !== 'undefined' && window.innerWidth < 640;

  return (
    <>
      {/* Toast */}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}

      {/* Overlay */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 1000,
          background: 'rgba(0,0,0,0.6)',
          display: 'flex',
          alignItems: isNarrow ? 'flex-end' : 'center',
          justifyContent: 'center',
          padding: isNarrow ? 0 : '16px',
        }}
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        {/* Modal card */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Email draft for ${vacancyTitle} at ${company}`}
          onKeyDown={handleKeyDown}
          style={{
            background: '#1a1a24',
            border: '1px solid #2a2a38',
            borderRadius: isNarrow ? '16px 16px 0 0' : 16,
            width: '100%',
            maxWidth: 680,
            maxHeight: '90vh',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            fontFamily: 'Inter, system-ui, sans-serif',
            ...(prefersReducedMotion ? {} : { animation: 'modalFadeIn 0.15s ease' }),
          }}
        >
          {/* Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 24px 16px',
              borderBottom: '1px solid #2a2a38',
              flexShrink: 0,
            }}
          >
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#f0f0f8', margin: 0, letterSpacing: '-0.02em' }}>
                Email Application
              </h2>
              <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
                {company} — {vacancyTitle}
              </p>
            </div>
            <button
              ref={firstFocusRef}
              type="button"
              onClick={onClose}
              aria-label="Close email draft modal"
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
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#e2e2e8'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
            >
              <IconX />
            </button>
          </div>

          {/* Body */}
          <div style={{ flex: 1, padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Loading state */}
            {modalState === 'loading' && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 14,
                  padding: '48px 0',
                  color: '#6b7280',
                }}
              >
                <SpinnerSvg size={28} />
                <p style={{ fontSize: 13, color: '#9090a8', margin: 0 }}>
                  Generating your personalized email...
                </p>
              </div>
            )}

            {/* Error generate */}
            {modalState === 'error_generate' && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#ef4444',
                  fontSize: 13,
                }}
              >
                Could not generate email draft. {errorMessage}. Try again or discard.
              </div>
            )}

            {/* Error send */}
            {modalState === 'error_send' && (
              <div
                role="alert"
                style={{
                  background: 'rgba(239,68,68,0.08)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  borderRadius: 8,
                  padding: '12px 16px',
                  color: '#ef4444',
                  fontSize: 13,
                }}
              >
                Failed to send email. Check your email configuration and try again.
              </div>
            )}

            {/* Draft / Sending state */}
            {(modalState === 'draft' || modalState === 'sending' || modalState === 'error_send') && (
              <div style={{ display: 'flex', flexDirection: isNarrow ? 'column' : 'row', gap: 20 }}>
                {/* Left: edit area */}
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14 }}>
                  {/* Subject */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label
                        htmlFor="email-subject"
                        style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                      >
                        Subject
                      </label>
                      <span style={{ fontSize: 11, color: subject.length > SUBJECT_MAX ? '#ef4444' : '#6b7280' }}>
                        {subject.length}/{SUBJECT_MAX}
                      </span>
                    </div>
                    <input
                      id="email-subject"
                      type="text"
                      value={subject}
                      maxLength={SUBJECT_MAX}
                      onChange={(e) => setSubject(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#13131c',
                        border: '1px solid #2a2a38',
                        borderRadius: 8,
                        color: '#e2e2e8',
                        fontSize: 13,
                        padding: '9px 12px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    />
                  </div>

                  {/* Body */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <label
                        htmlFor="email-body"
                        style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.04em' }}
                      >
                        Body
                      </label>
                      <span style={{ fontSize: 11, color: body.length > BODY_MAX ? '#ef4444' : '#6b7280' }}>
                        {body.length}/{BODY_MAX}
                      </span>
                    </div>
                    <textarea
                      id="email-body"
                      value={body}
                      maxLength={BODY_MAX}
                      onChange={(e) => setBody(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#13131c',
                        border: '1px solid #2a2a38',
                        borderRadius: 8,
                        color: '#e2e2e8',
                        fontSize: 13,
                        padding: '9px 12px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'Inter, system-ui, sans-serif',
                        minHeight: 160,
                        maxHeight: 320,
                        resize: 'vertical',
                        lineHeight: 1.6,
                      }}
                    />
                  </div>

                  {/* Recipient */}
                  <div>
                    <label
                      htmlFor="email-recipient"
                      style={{
                        display: 'block',
                        fontSize: 11,
                        fontWeight: 600,
                        color: '#6b7280',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                        marginBottom: 6,
                      }}
                    >
                      Recipient
                    </label>
                    <input
                      id="email-recipient"
                      type="email"
                      value={recipient}
                      onChange={(e) => setRecipient(e.target.value)}
                      style={{
                        width: '100%',
                        background: '#13131c',
                        border: '1px solid #2a2a38',
                        borderRadius: 8,
                        color: '#e2e2e8',
                        fontSize: 13,
                        padding: '9px 12px',
                        outline: 'none',
                        boxSizing: 'border-box',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    />
                    <p style={{ fontSize: 11, color: '#6b7280', margin: '5px 0 0' }}>
                      You can edit the recipient address before sending.
                    </p>
                  </div>
                </div>

                {/* Right: vacancy info panel */}
                <div
                  style={{
                    width: isNarrow ? '100%' : 180,
                    flexShrink: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    padding: '14px 16px',
                    background: '#13131c',
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.06)',
                    alignSelf: 'flex-start',
                  }}
                >
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#e2e2e8', margin: 0, lineHeight: 1.4 }}>
                    {vacancyTitle}
                  </p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{company}</p>
                  <div>
                    <span style={{ fontSize: 11, color: '#6b7280', display: 'block', marginBottom: 4 }}>Match score</span>
                    <ScorePill score={score} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer CTAs */}
          {(modalState === 'draft' || modalState === 'sending' || modalState === 'error_send') && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: 10,
                padding: '16px 24px',
                borderTop: '1px solid #2a2a38',
                flexShrink: 0,
              }}
            >
              {/* Discard */}
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: 13,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  padding: '8px 4px',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#ef4444'; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = '#6b7280'; }}
              >
                Discard
              </button>

              {/* Save Draft */}
              <button
                type="button"
                onClick={() => { void handleSaveDraft(); }}
                disabled={modalState === 'sending'}
                style={{
                  background: 'transparent',
                  border: '1px solid #2a2a38',
                  borderRadius: 8,
                  color: '#c8c8d8',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: modalState === 'sending' ? 'not-allowed' : 'pointer',
                  padding: '8px 16px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'border-color 0.15s',
                }}
              >
                Save Draft
              </button>

              {/* Send Email */}
              <button
                ref={lastFocusRef}
                type="button"
                onClick={() => { void handleSend(); }}
                disabled={modalState === 'sending'}
                style={{
                  background: modalState === 'sending' ? 'rgba(99,102,241,0.5)' : '#6366f1',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: modalState === 'sending' ? 'not-allowed' : 'pointer',
                  padding: '8px 18px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  transition: 'background 0.15s',
                }}
              >
                {modalState === 'sending' && <SpinnerSvg />}
                {modalState === 'sending' ? 'Sending...' : 'Send Email'}
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes modalFadeIn { from { opacity: 0; transform: scale(0.97); } to { opacity: 1; transform: scale(1); } }
      `}</style>
    </>
  );
};

export default EmailDraftModal;
