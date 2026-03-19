import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';

// ─── Design tokens ────────────────────────────────────────────────────────────
const C = {
  bg: '#0f0f14',
  surface: '#1a1a24',
  border: '#2a2a38',
  accent: '#6366f1',
  text: '#f0f0f8',
  textDefault: '#e2e2e8',
  textMuted: '#6b7280',
  inputBg: '#12121a',
  error: '#ef4444',
} as const;

const baseInput: React.CSSProperties = {
  background: C.inputBg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.textDefault,
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '10px 12px',
  height: 44,
};

type SeniorityLevel = 'Junior' | 'Mid' | 'Senior' | 'Lead';

const SENIORITY_OPTIONS: SeniorityLevel[] = ['Junior', 'Mid', 'Senior', 'Lead'];

// ─── ChipInput ────────────────────────────────────────────────────────────────
interface ChipInputProps {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  hasError?: boolean;
  ariaRequired?: boolean;
  ariaLabel?: string;
}

const ChipInput: React.FC<ChipInputProps> = ({
  value,
  onChange,
  placeholder,
  hasError,
  ariaRequired,
  ariaLabel,
}) => {
  const [draft, setDraft] = useState('');

  const addChip = (raw: string) => {
    const trimmed = raw.trim();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setDraft('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addChip(draft);
    } else if (e.key === 'Backspace' && draft === '' && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handleBlur = () => {
    if (draft.trim()) addChip(draft);
  };

  return (
    <div
      style={{
        ...baseInput,
        height: 'auto',
        minHeight: 44,
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 10px',
        cursor: 'text',
        alignItems: 'center',
        borderColor: hasError ? C.error : C.border,
      }}
      onClick={(e) => {
        const target = e.currentTarget.querySelector('input');
        target?.focus();
      }}
    >
      {value.map((chip) => (
        <span
          key={chip}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            background: 'rgba(99,102,241,0.13)',
            border: '1px solid rgba(99,102,241,0.33)',
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 13,
            color: C.textDefault,
            whiteSpace: 'nowrap',
          }}
        >
          {chip}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange(value.filter((v) => v !== chip));
            }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: C.textMuted,
              fontSize: 14,
              lineHeight: 1,
              padding: 0,
              marginLeft: 2,
            }}
            aria-label={`Remove ${chip}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={value.length === 0 ? placeholder : ''}
        aria-required={ariaRequired}
        aria-label={ariaLabel}
        style={{
          background: 'none',
          border: 'none',
          color: C.textDefault,
          fontSize: 14,
          outline: 'none',
          flexGrow: 1,
          minWidth: 120,
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      />
    </div>
  );
};

// ─── PillToggle ───────────────────────────────────────────────────────────────
interface PillToggleProps {
  label: string;
  selected: boolean;
  onClick: () => void;
}

const PillToggle: React.FC<PillToggleProps> = ({ label, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    style={{
      background: selected ? C.accent : C.surface,
      border: `1px solid ${selected ? C.accent : C.border}`,
      borderRadius: 20,
      color: selected ? '#fff' : C.textMuted,
      cursor: 'pointer',
      fontSize: 13,
      fontWeight: selected ? 600 : 400,
      padding: '6px 16px',
      minHeight: 36,
      transition: 'all 0.15s ease',
      fontFamily: 'Inter, system-ui, sans-serif',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

// ─── Required label indicator ─────────────────────────────────────────────────
const RequiredIndicator: React.FC = () => (
  <span style={{ fontSize: 12, color: C.error, marginLeft: 4 }}>(required)</span>
);

// ─── Experience entry ─────────────────────────────────────────────────────────
interface ExperienceEntry {
  company: string;
  title: string;
}

// ─── ProfileSetupPage ─────────────────────────────────────────────────────────

/**
 * First-login onboarding gate.
 * Redirects new users here after OAuth to fill critical profile fields
 * before reaching the main dashboard.
 */
const ProfileSetupPage: React.FC = () => {
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [headline, setHeadline] = useState('');
  const [seniority, setSeniority] = useState<SeniorityLevel | ''>('');
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState<ExperienceEntry>({ company: '', title: '' });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Show "Skip for now" if the user has at least some data pre-filled
  const hasPartialData = fullName !== '' || headline !== '' || skills.length > 0;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!seniority) newErrors['seniority'] = 'Seniority is required.';
    if (skills.length === 0) newErrors['skills'] = 'At least one skill is required.';
    if (!experience.company.trim()) newErrors['experience.company'] = 'Company is required.';
    if (!experience.title.trim()) newErrors['experience.title'] = 'Job title is required.';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    if (!validate()) return;

    setIsSaving(true);
    try {
      await api.patch('/users/profile', {
        fullName: fullName.trim() || undefined,
        headline: headline.trim() || undefined,
        seniority,
        skills,
        experience: [
          {
            company: experience.company.trim(),
            title: experience.title.trim(),
            startDate: '',
            endDate: '',
            description: [],
            technologies: [],
          },
        ],
      });
      void navigate('/config');
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : 'Failed to save profile. Please try again.';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSkip = (e: React.MouseEvent) => {
    e.preventDefault();
    void navigate('/config');
  };

  return (
    <div
      style={{
        backgroundColor: C.bg,
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '40px 20px',
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background:
            'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.1) 0%, transparent 70%)',
        }}
      />

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          width: '100%',
          maxWidth: 640,
          backgroundColor: C.surface,
          border: `1px solid ${C.border}`,
          borderRadius: 24,
          padding: '40px 40px 32px',
        }}
      >
        {/* ── Page heading ── */}
        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: '-0.04em',
            color: C.text,
            margin: '0 0 8px',
          }}
        >
          Complete Your Profile
        </h1>
        <p style={{ fontSize: 14, color: C.textMuted, margin: '0 0 32px' }}>
          Fill in the fields below so the agent can find the right jobs for you.
        </p>

        {/* ── Save error banner ── */}
        {saveError && (
          <div
            role="alert"
            style={{
              backgroundColor: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.25)',
              borderRadius: 8,
              color: '#f87171',
              fontSize: 14,
              padding: '12px 16px',
              marginBottom: 24,
            }}
          >
            {saveError}
          </div>
        )}

        <form onSubmit={(e) => { void handleSave(e); }} noValidate>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

            {/* Full name */}
            <div>
              <label
                style={{ fontSize: 14, fontWeight: 500, color: C.textDefault, display: 'block', marginBottom: 6 }}
                htmlFor="fullName"
              >
                Full Name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Jane Smith"
                style={baseInput}
              />
            </div>

            {/* Headline */}
            <div>
              <label
                style={{ fontSize: 14, fontWeight: 500, color: C.textDefault, display: 'block', marginBottom: 6 }}
                htmlFor="headline"
              >
                Headline
              </label>
              <input
                id="headline"
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                placeholder="Senior Software Engineer"
                style={baseInput}
              />
            </div>

            {/* Seniority */}
            <div>
              <label
                style={{ fontSize: 14, fontWeight: 500, color: C.textDefault, display: 'block', marginBottom: 6 }}
                htmlFor="seniority-group"
              >
                Seniority
                <RequiredIndicator />
              </label>
              <div
                id="seniority-group"
                role="group"
                aria-required="true"
                aria-label="Seniority level"
                style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}
              >
                {SENIORITY_OPTIONS.map((level) => (
                  <PillToggle
                    key={level}
                    label={level}
                    selected={seniority === level}
                    onClick={() => {
                      setSeniority(level);
                      setErrors((prev) => ({ ...prev, seniority: '' }));
                    }}
                  />
                ))}
              </div>
              {errors['seniority'] && (
                <p style={{ fontSize: 12, color: C.error, margin: '6px 0 0' }}>{errors['seniority']}</p>
              )}
            </div>

            {/* Skills */}
            <div>
              <label
                style={{ fontSize: 14, fontWeight: 500, color: C.textDefault, display: 'block', marginBottom: 6 }}
                htmlFor="skills-input"
              >
                Skills
                <RequiredIndicator />
              </label>
              <ChipInput
                value={skills}
                onChange={(v) => {
                  setSkills(v);
                  setErrors((prev) => ({ ...prev, skills: '' }));
                }}
                placeholder="Type a skill and press Enter…"
                hasError={!!errors['skills']}
                ariaRequired={true}
                ariaLabel="Skills"
              />
              {errors['skills'] && (
                <p style={{ fontSize: 12, color: C.error, margin: '6px 0 0' }}>{errors['skills']}</p>
              )}
            </div>

            {/* Experience */}
            <div>
              <p
                style={{ fontSize: 14, fontWeight: 500, color: C.textDefault, margin: '0 0 10px' }}
              >
                Experience (most recent)
                <RequiredIndicator />
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div>
                  <label
                    style={{ fontSize: 12, color: C.textMuted, display: 'block', marginBottom: 6 }}
                    htmlFor="exp-company"
                  >
                    Company
                  </label>
                  <input
                    id="exp-company"
                    type="text"
                    value={experience.company}
                    onChange={(e) => {
                      setExperience((prev) => ({ ...prev, company: e.target.value }));
                      setErrors((prev) => ({ ...prev, 'experience.company': '' }));
                    }}
                    placeholder="Acme Corp"
                    aria-required="true"
                    style={{
                      ...baseInput,
                      borderColor: errors['experience.company'] ? C.error : C.border,
                    }}
                  />
                  {errors['experience.company'] && (
                    <p style={{ fontSize: 12, color: C.error, margin: '6px 0 0' }}>
                      {errors['experience.company']}
                    </p>
                  )}
                </div>
                <div>
                  <label
                    style={{ fontSize: 12, color: C.textMuted, display: 'block', marginBottom: 6 }}
                    htmlFor="exp-title"
                  >
                    Job Title
                  </label>
                  <input
                    id="exp-title"
                    type="text"
                    value={experience.title}
                    onChange={(e) => {
                      setExperience((prev) => ({ ...prev, title: e.target.value }));
                      setErrors((prev) => ({ ...prev, 'experience.title': '' }));
                    }}
                    placeholder="Software Engineer"
                    aria-required="true"
                    style={{
                      ...baseInput,
                      borderColor: errors['experience.title'] ? C.error : C.border,
                    }}
                  />
                  {errors['experience.title'] && (
                    <p style={{ fontSize: 12, color: C.error, margin: '6px 0 0' }}>
                      {errors['experience.title']}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* CTA */}
            <div style={{ marginTop: 8 }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  width: '100%',
                  height: 44,
                  background: isSaving
                    ? 'rgba(99,102,241,0.5)'
                    : 'linear-gradient(135deg, #6366f1, #7c3aed)',
                  border: 'none',
                  borderRadius: 12,
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: isSaving ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontFamily: 'Inter, system-ui, sans-serif',
                  transition: 'opacity 0.15s',
                }}
              >
                {isSaving && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 16,
                      height: 16,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff',
                      borderRadius: '50%',
                      animation: 'spin 0.7s linear infinite',
                    }}
                  />
                )}
                Save Profile
              </button>

              {hasPartialData && (
                <button
                  type="button"
                  onClick={handleSkip}
                  style={{
                    display: 'block',
                    width: '100%',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: C.textMuted,
                    fontSize: 14,
                    textAlign: 'center',
                    marginTop: 12,
                    fontFamily: 'Inter, system-ui, sans-serif',
                    padding: '4px 0',
                  }}
                >
                  Skip for now
                </button>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProfileSetupPage;
