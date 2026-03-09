import React, { useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { AppConfig } from '@job-agent/core';

// ─── Design tokens ───────────────────────────────────────────────────────────
const C = {
  bg: '#0f0f14',
  surface: '#1a1a24',
  border: '#2a2a38',
  accent: '#6366f1',
  accentHover: '#4f51d6',
  text: '#e4e4f0',
  textMuted: '#6b6b8a',
  success: '#22c55e',
  error: '#ef4444',
  inputBg: '#12121a',
} as const;

const baseInput: React.CSSProperties = {
  background: C.inputBg,
  border: `1px solid ${C.border}`,
  borderRadius: 8,
  color: C.text,
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'Inter, system-ui, sans-serif',
};

// ─── API helpers ─────────────────────────────────────────────────────────────
const API_BASE = 'http://localhost:3000';

async function fetchConfig(): Promise<AppConfig | null> {
  const res = await fetch(`${API_BASE}/api/config`);
  if (!res.ok) throw new Error('Failed to fetch config');
  const data = (await res.json()) as { config: AppConfig | null };
  return data.config;
}

async function saveConfig(config: AppConfig): Promise<void> {
  const res = await fetch(`${API_BASE}/api/config`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    throw new Error(err.message ?? 'Failed to save config');
  }
}

// ─── Default config ───────────────────────────────────────────────────────────
const DEFAULT_CONFIG: AppConfig = {
  search: {
    keywords: [],
    location: 'Remote',
    modality: ['Remote'],
    languages: ['English'],
    seniority: ['Mid'],
    datePosted: 'past_week',
    excludedCompanies: [],
    platforms: ['linkedin'],
    maxJobsToFind: 100,
  },
  matching: {
    minScoreToApply: 70,
    maxApplicationsPerSession: 10,
  },
  coverLetter: {
    language: 'en',
    tone: 'professional',
  },
  report: {
    format: 'both',
  },
};

// ─── ChipInput ────────────────────────────────────────────────────────────────
interface ChipInputProps {
  value: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
}

const ChipInput: React.FC<ChipInputProps> = ({ value, onChange, placeholder }) => {
  const [draft, setDraft] = useState('');

  const addChip = useCallback(
    (raw: string) => {
      const trimmed = raw.trim();
      if (trimmed && !value.includes(trimmed)) {
        onChange([...value, trimmed]);
      }
      setDraft('');
    },
    [value, onChange],
  );

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
        display: 'flex',
        flexWrap: 'wrap',
        gap: 6,
        padding: '8px 10px',
        cursor: 'text',
        minHeight: 44,
        alignItems: 'center',
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
            background: `${C.accent}22`,
            border: `1px solid ${C.accent}55`,
            borderRadius: 6,
            padding: '2px 8px',
            fontSize: 13,
            color: C.text,
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
        style={{
          background: 'none',
          border: 'none',
          color: C.text,
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
      transition: 'all 0.15s ease',
      fontFamily: 'Inter, system-ui, sans-serif',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

// ─── Section wrapper ──────────────────────────────────────────────────────────
interface SectionProps {
  title: string;
  children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, children }) => (
  <div
    style={{
      background: C.surface,
      border: `1px solid ${C.border}`,
      borderRadius: 12,
      padding: '20px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}
  >
    <h2
      style={{
        color: C.text,
        fontSize: 14,
        fontWeight: 600,
        margin: 0,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        opacity: 0.7,
      }}
    >
      {title}
    </h2>
    {children}
  </div>
);

// ─── Label ────────────────────────────────────────────────────────────────────
const FieldLabel: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <label
    style={{
      color: C.text,
      fontSize: 14,
      fontWeight: 500,
      display: 'block',
      marginBottom: 6,
    }}
  >
    {children}
  </label>
);

// ─── PillGroup helpers ────────────────────────────────────────────────────────
function toggleArrayItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

// ─── ConfigPage ───────────────────────────────────────────────────────────────
const ConfigPage: React.FC = () => {
  const queryClient = useQueryClient();
  const [form, setForm] = useState<AppConfig>(DEFAULT_CONFIG);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: existingConfig, isLoading } = useQuery({
    queryKey: ['config'],
    queryFn: fetchConfig,
  });

  // Populate form when config loads
  useEffect(() => {
    if (existingConfig) {
      setForm(existingConfig);
    }
  }, [existingConfig]);

  const mutation = useMutation({
    mutationFn: saveConfig,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['config'] });
      setBanner({ type: 'success', message: 'Configuration saved successfully.' });
      setTimeout(() => setBanner(null), 4000);
    },
    onError: (err: Error) => {
      setBanner({ type: 'error', message: err.message });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    mutation.mutate(form);
  };

  // Typed updaters
  const setSearch = useCallback(
    <K extends keyof AppConfig['search']>(key: K, value: AppConfig['search'][K]) => {
      setForm((prev) => ({ ...prev, search: { ...prev.search, [key]: value } }));
    },
    [],
  );

  const setMatching = useCallback(
    <K extends keyof AppConfig['matching']>(key: K, value: AppConfig['matching'][K]) => {
      setForm((prev) => ({ ...prev, matching: { ...prev.matching, [key]: value } }));
    },
    [],
  );

  const setCoverLetter = useCallback(
    <K extends keyof AppConfig['coverLetter']>(key: K, value: AppConfig['coverLetter'][K]) => {
      setForm((prev) => ({ ...prev, coverLetter: { ...prev.coverLetter, [key]: value } }));
    },
    [],
  );

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: C.bg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: C.textMuted,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: 15,
        }}
      >
        Loading configuration…
      </div>
    );
  }

  const modalities: AppConfig['search']['modality'] = ['Remote', 'Hybrid', 'On-site'];
  const languageOptions = ['English', 'Spanish', 'Portuguese', 'French'];
  const seniorityOptions = ['Junior', 'Mid', 'Senior', 'Lead'];
  const datePostedOptions: { label: string; value: AppConfig['search']['datePosted'] }[] = [
    { label: 'Last 24h', value: 'past_24h' },
    { label: 'Last week', value: 'past_week' },
    { label: 'Last month', value: 'past_month' },
  ];
  const coverLangOptions: { label: string; value: AppConfig['coverLetter']['language'] }[] = [
    { label: 'English', value: 'en' },
    { label: 'Spanish', value: 'es' },
  ];
  const toneOptions: { label: string; value: AppConfig['coverLetter']['tone'] }[] = [
    { label: 'Professional', value: 'professional' },
    { label: 'Casual', value: 'casual' },
    { label: 'Enthusiastic', value: 'enthusiastic' },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background: C.bg,
        fontFamily: 'Inter, system-ui, sans-serif',
        padding: '40px 20px 80px',
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1
            style={{
              color: C.text,
              fontSize: 26,
              fontWeight: 700,
              margin: '0 0 6px',
              letterSpacing: '-0.02em',
            }}
          >
            Search Configuration
          </h1>
          <p style={{ color: C.textMuted, fontSize: 14, margin: 0 }}>
            Configure your job search criteria and application preferences.
          </p>
        </div>

        {/* Banner */}
        {banner && (
          <div
            role="alert"
            style={{
              background: banner.type === 'success' ? `${C.success}18` : `${C.error}18`,
              border: `1px solid ${banner.type === 'success' ? `${C.success}55` : `${C.error}55`}`,
              borderRadius: 8,
              color: banner.type === 'success' ? C.success : C.error,
              fontSize: 14,
              padding: '12px 16px',
              marginBottom: 24,
            }}
          >
            {banner.message}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* 1. Keywords */}
          <Section title="Keywords">
            <FieldLabel>Job title keywords</FieldLabel>
            <ChipInput
              value={form.search.keywords}
              onChange={(v) => setSearch('keywords', v)}
              placeholder="Type a keyword and press Enter or comma…"
            />
            <p style={{ color: C.textMuted, fontSize: 12, margin: 0 }}>
              Press Enter or comma to add. Backspace removes the last chip.
            </p>
          </Section>

          {/* 2. Location */}
          <Section title="Location">
            <FieldLabel>Preferred location</FieldLabel>
            <input
              type="text"
              value={form.search.location}
              onChange={(e) => setSearch('location', e.target.value)}
              placeholder="e.g. Remote, New York, London"
              style={{ ...baseInput, padding: '10px 12px' }}
            />
          </Section>

          {/* 3. Work modality */}
          <Section title="Work Modality">
            <FieldLabel>Select all that apply</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {modalities.map((m) => (
                <PillToggle
                  key={m}
                  label={m}
                  selected={form.search.modality.includes(m)}
                  onClick={() => setSearch('modality', toggleArrayItem(form.search.modality, m))}
                />
              ))}
            </div>
          </Section>

          {/* 4. Languages */}
          <Section title="Languages">
            <FieldLabel>Job posting languages accepted</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {languageOptions.map((lang) => (
                <PillToggle
                  key={lang}
                  label={lang}
                  selected={form.search.languages.includes(lang)}
                  onClick={() =>
                    setSearch('languages', toggleArrayItem(form.search.languages, lang))
                  }
                />
              ))}
            </div>
          </Section>

          {/* 5. Seniority */}
          <Section title="Seniority">
            <FieldLabel>Target seniority levels</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {seniorityOptions.map((s) => (
                <PillToggle
                  key={s}
                  label={s}
                  selected={form.search.seniority.includes(s)}
                  onClick={() =>
                    setSearch('seniority', toggleArrayItem(form.search.seniority, s))
                  }
                />
              ))}
            </div>
          </Section>

          {/* 6. Date posted */}
          <Section title="Date Posted">
            <FieldLabel>Only show jobs posted within</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {datePostedOptions.map(({ label, value }) => (
                <PillToggle
                  key={value}
                  label={label}
                  selected={form.search.datePosted === value}
                  onClick={() => setSearch('datePosted', value)}
                />
              ))}
            </div>
          </Section>

          {/* 7. Min compatibility score */}
          <Section title="Compatibility Score">
            <FieldLabel>
              Minimum score to apply
              <span
                style={{
                  marginLeft: 10,
                  background: `${C.accent}22`,
                  border: `1px solid ${C.accent}55`,
                  borderRadius: 6,
                  color: C.accent,
                  fontSize: 14,
                  fontWeight: 700,
                  padding: '1px 10px',
                }}
              >
                {form.matching.minScoreToApply}
              </span>
            </FieldLabel>
            <input
              type="range"
              min={0}
              max={100}
              step={1}
              value={form.matching.minScoreToApply}
              onChange={(e) => setMatching('minScoreToApply', parseInt(e.target.value, 10))}
              style={{
                width: '100%',
                accentColor: C.accent,
                cursor: 'pointer',
                height: 4,
              }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                color: C.textMuted,
                fontSize: 12,
              }}
            >
              <span>0 — apply to all</span>
              <span>100 — perfect match only</span>
            </div>
          </Section>

          {/* 8. Max applications */}
          <Section title="Max Applications">
            <FieldLabel>Maximum applications per session</FieldLabel>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <button
                type="button"
                aria-label="Decrease"
                onClick={() =>
                  setMatching(
                    'maxApplicationsPerSession',
                    Math.max(1, form.matching.maxApplicationsPerSession - 1),
                  )
                }
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                −
              </button>
              <input
                type="number"
                min={1}
                max={25}
                value={form.matching.maxApplicationsPerSession}
                onChange={(e) => {
                  const n = parseInt(e.target.value, 10);
                  if (!isNaN(n)) {
                    setMatching('maxApplicationsPerSession', Math.min(25, Math.max(1, n)));
                  }
                }}
                style={{
                  ...baseInput,
                  width: 72,
                  textAlign: 'center',
                  padding: '8px 10px',
                }}
              />
              <button
                type="button"
                aria-label="Increase"
                onClick={() =>
                  setMatching(
                    'maxApplicationsPerSession',
                    Math.min(25, form.matching.maxApplicationsPerSession + 1),
                  )
                }
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontSize: 18,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                +
              </button>
              <span style={{ color: C.textMuted, fontSize: 13 }}>max 25 per session</span>
            </div>
          </Section>

          {/* 9. Excluded companies */}
          <Section title="Excluded Companies">
            <FieldLabel>Skip applications at these companies</FieldLabel>
            <ChipInput
              value={form.search.excludedCompanies}
              onChange={(v) => setSearch('excludedCompanies', v)}
              placeholder="Type a company name and press Enter…"
            />
          </Section>

          {/* 10. Cover letter language */}
          <Section title="Cover Letter Language">
            <FieldLabel>Language for generated cover letters</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {coverLangOptions.map(({ label, value }) => (
                <PillToggle
                  key={value}
                  label={label}
                  selected={form.coverLetter.language === value}
                  onClick={() => setCoverLetter('language', value)}
                />
              ))}
            </div>
          </Section>

          {/* 11. Cover letter tone */}
          <Section title="Cover Letter Tone">
            <FieldLabel>Tone for generated cover letters</FieldLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {toneOptions.map(({ label, value }) => (
                <PillToggle
                  key={value}
                  label={label}
                  selected={form.coverLetter.tone === value}
                  onClick={() => setCoverLetter('tone', value)}
                />
              ))}
            </div>
          </Section>

          {/* Submit */}
          <div style={{ paddingTop: 8 }}>
            <button
              type="submit"
              disabled={mutation.isPending}
              style={{
                background: mutation.isPending ? `${C.accent}88` : C.accent,
                border: 'none',
                borderRadius: 10,
                color: '#fff',
                cursor: mutation.isPending ? 'not-allowed' : 'pointer',
                fontSize: 15,
                fontWeight: 600,
                padding: '13px 28px',
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 10,
                transition: 'background 0.15s ease',
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            >
              {mutation.isPending && (
                <span
                  style={{
                    display: 'inline-block',
                    width: 16,
                    height: 16,
                    border: '2px solid #ffffff55',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
              )}
              {mutation.isPending ? 'Saving…' : 'Save & Start Agent'}
            </button>
          </div>
        </form>
      </div>

      {/* Keyframe for spinner — injected via a style tag */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ConfigPage;
