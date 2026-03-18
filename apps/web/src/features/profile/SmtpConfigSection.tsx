import React, { useState, useEffect } from 'react';
import { api } from '../../lib/api';

/* ── Types ─────────────────────────────────────────────────────────────────── */

interface SmtpFormState {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

type FieldErrors = Partial<Record<keyof SmtpFormState, string>>;

const REQUIRED_FIELDS: Array<keyof SmtpFormState> = ['host', 'port', 'user', 'password', 'fromEmail'];

const DEFAULT_FORM: SmtpFormState = {
  host: '',
  port: 587,
  secure: false,
  user: '',
  password: '',
  fromName: '',
  fromEmail: '',
};

/* ── Styles ────────────────────────────────────────────────────────────────── */

const inputBase: React.CSSProperties = {
  background: '#13131c',
  border: '1px solid #2a2a38',
  borderRadius: 8,
  color: '#e2e2e8',
  fontSize: 13,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '9px 12px',
};

const inputError: React.CSSProperties = {
  border: '1px solid #ef4444',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  fontWeight: 600,
  color: '#6b7280',
  marginBottom: 6,
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const fieldErrorStyle: React.CSSProperties = {
  fontSize: 11,
  color: '#ef4444',
  marginTop: 4,
};

/* ── SVG Icons ─────────────────────────────────────────────────────────────── */

const IconMail: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const IconLoader: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

/* ── Field wrapper ──────────────────────────────────────────────────────────── */

interface FieldProps {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ id, label, error, children }) => (
  <div>
    <label htmlFor={id} style={labelStyle}>{label}</label>
    {children}
    {error && <p style={fieldErrorStyle}>{error}</p>}
  </div>
);

/* ── SmtpConfigSection ──────────────────────────────────────────────────────── */

/**
 * Email Configuration section for the Profile page.
 * Loads existing SMTP config on mount, allows editing and saving.
 * Password field is always empty when editing (never shows stored value).
 */
const SmtpConfigSection: React.FC = () => {
  const [form, setForm] = useState<SmtpFormState>(DEFAULT_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    api
      .get<Partial<SmtpFormState> | null>('/users/smtp-config')
      .then((res) => {
        if (res.data) {
          setForm({
            host: res.data.host ?? '',
            port: res.data.port ?? 587,
            secure: res.data.secure ?? false,
            user: res.data.user ?? '',
            password: '', // Never pre-fill password — user must re-enter
            fromName: res.data.fromName ?? '',
            fromEmail: res.data.fromEmail ?? '',
          });
        }
      })
      .catch(() => {
        // Config may not exist yet — that's fine
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const validate = (data: SmtpFormState): FieldErrors => {
    const errs: FieldErrors = {};
    for (const field of REQUIRED_FIELDS) {
      const val = data[field];
      if (val === '' || val === null || val === undefined) {
        errs[field] = 'This field is required.';
      }
    }
    return errs;
  };

  const handleChange = <K extends keyof SmtpFormState>(key: K, value: SmtpFormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (submitted) {
      const updated = { ...form, [key]: value };
      const errs = validate(updated);
      setErrors(errs);
    }
    setSaveSuccess(false);
    setSaveError(null);
  };

  const handleBlur = (key: keyof SmtpFormState) => {
    if (!submitted) return;
    const errs = validate(form);
    setErrors((prev) => ({ ...prev, [key]: errs[key] }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(form);
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);
    try {
      await api.put('/users/smtp-config', form);
      setSaveSuccess(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save configuration.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: '#1a1a24',
          border: '1px solid #2a2a38',
          borderRadius: 12,
          padding: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          color: '#6b7280',
          fontSize: 13,
        }}
      >
        <IconLoader />
        Loading email configuration…
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: '#1a1a24',
        border: '1px solid #2a2a38',
        borderRadius: 12,
        padding: 24,
      }}
    >
      {/* Section heading */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <span style={{ color: '#6366f1' }}>
          <IconMail />
        </span>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f8', margin: 0 }}>
          Email Configuration
        </h3>
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 20px' }}>
        Required to send applications by email
      </p>

      <form onSubmit={(e) => { void handleSubmit(e); }} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {/* Row: Host + Port */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12 }}>
          <Field id="smtp-host" label="Host" error={errors.host}>
            <input
              id="smtp-host"
              type="text"
              value={form.host}
              placeholder="smtp.gmail.com"
              onChange={(e) => handleChange('host', e.target.value)}
              onBlur={() => handleBlur('host')}
              style={{ ...inputBase, ...(errors.host ? inputError : {}) }}
            />
          </Field>
          <Field id="smtp-port" label="Port" error={errors.port}>
            <input
              id="smtp-port"
              type="number"
              value={form.port}
              onChange={(e) => handleChange('port', parseInt(e.target.value, 10) || 0)}
              onBlur={() => handleBlur('port')}
              style={{ ...inputBase, ...(errors.port ? inputError : {}) }}
            />
          </Field>
        </div>

        {/* Secure toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input
            id="smtp-secure"
            type="checkbox"
            checked={form.secure}
            onChange={(e) => handleChange('secure', e.target.checked)}
            style={{ width: 16, height: 16, accentColor: '#6366f1', cursor: 'pointer' }}
          />
          <label htmlFor="smtp-secure" style={{ fontSize: 13, color: '#c8c8d8', cursor: 'pointer' }}>
            Use TLS/SSL (Secure)
          </label>
        </div>

        {/* Username */}
        <Field id="smtp-user" label="Username" error={errors.user}>
          <input
            id="smtp-user"
            type="text"
            value={form.user}
            placeholder="your@gmail.com"
            onChange={(e) => handleChange('user', e.target.value)}
            onBlur={() => handleBlur('user')}
            style={{ ...inputBase, ...(errors.user ? inputError : {}) }}
          />
        </Field>

        {/* Password */}
        <Field id="smtp-password" label="Password" error={errors.password}>
          <input
            id="smtp-password"
            type="password"
            value={form.password}
            placeholder="App password or SMTP password"
            onChange={(e) => handleChange('password', e.target.value)}
            onBlur={() => handleBlur('password')}
            style={{ ...inputBase, ...(errors.password ? inputError : {}) }}
          />
          <p style={{ fontSize: 11, color: '#6b7280', marginTop: 6 }}>
            Stored encrypted. For Gmail, use an App Password.
          </p>
        </Field>

        {/* From Name */}
        <Field id="smtp-fromName" label="From Name" error={errors.fromName}>
          <input
            id="smtp-fromName"
            type="text"
            value={form.fromName}
            placeholder="Your Name"
            onChange={(e) => handleChange('fromName', e.target.value)}
            onBlur={() => handleBlur('fromName')}
            style={{ ...inputBase, ...(errors.fromName ? inputError : {}) }}
          />
        </Field>

        {/* From Email */}
        <Field id="smtp-fromEmail" label="From Email" error={errors.fromEmail}>
          <input
            id="smtp-fromEmail"
            type="email"
            value={form.fromEmail}
            placeholder="your@gmail.com"
            onChange={(e) => handleChange('fromEmail', e.target.value)}
            onBlur={() => handleBlur('fromEmail')}
            style={{ ...inputBase, ...(errors.fromEmail ? inputError : {}) }}
          />
        </Field>

        {/* Success banner */}
        {saveSuccess && (
          <div
            role="status"
            style={{
              backgroundColor: 'rgba(34,197,94,0.08)',
              border: '1px solid rgba(34,197,94,0.25)',
              borderRadius: 8,
              color: '#22c55e',
              fontSize: 13,
              padding: '10px 14px',
            }}
          >
            Email configuration saved.
          </div>
        )}

        {/* Error banner */}
        {saveError && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              color: '#ef4444',
              fontSize: 13,
              padding: '10px 14px',
            }}
          >
            {saveError}
          </div>
        )}

        {/* Save button */}
        <button
          type="submit"
          disabled={isSaving}
          style={{
            height: 42,
            background: isSaving ? 'rgba(99,102,241,0.5)' : '#6366f1',
            border: 'none',
            borderRadius: 8,
            color: '#fff',
            fontSize: 13,
            fontWeight: 600,
            cursor: isSaving ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            fontFamily: 'Inter, system-ui, sans-serif',
            transition: 'opacity 0.15s',
            alignSelf: 'flex-start',
            padding: '0 20px',
          }}
        >
          {isSaving && <IconLoader />}
          Save Email Config
        </button>
      </form>
    </div>
  );
};

export default SmtpConfigSection;
