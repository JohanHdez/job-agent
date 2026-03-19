import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AppConfig } from '@job-agent/core';
import { api } from '../../lib/api';

// ─── Design tokens ────────────────────────────────────────────────────────────
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

// ─── SearchPresetType (mirrored from packages/core) ───────────────────────────
interface SearchPresetType {
  id: string;
  name: string;
  keywords: string[];
  location: string;
  modality: ('Remote' | 'Hybrid' | 'On-site')[];
  platforms: string[];
  seniority: string[];
  languages: string[];
  datePosted: 'past_24h' | 'past_week' | 'past_month';
  minScoreToApply: number;
  maxApplicationsPerSession: number;
  excludedCompanies: string[];
}

// ─── API helpers ─────────────────────────────────────────────────────────────

async function fetchConfig(): Promise<AppConfig | null> {
  const res = await api.get<{ config: AppConfig | null }>('/users/config');
  return res.data.config;
}

async function saveConfig(config: AppConfig): Promise<void> {
  await api.post('/users/config', config);
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

// ─── Trash SVG icon ───────────────────────────────────────────────────────────
const IconTrash: React.FC<{ hovered: boolean }> = ({ hovered }) => (
  <svg
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke={hovered ? '#ef4444' : '#6b7280'}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

// ─── PillGroup helpers ────────────────────────────────────────────────────────
function toggleArrayItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((v) => v !== item) : [...arr, item];
}

// ─── PresetManagementSection ──────────────────────────────────────────────────
const MAX_PRESETS = 5;

interface PresetManagementSectionProps {
  form: AppConfig;
  onLoadPreset: (preset: SearchPresetType) => void;
}

const PresetManagementSection: React.FC<PresetManagementSectionProps> = ({
  form,
  onLoadPreset,
}) => {
  const [presets, setPresets] = useState<SearchPresetType[]>([]);
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [selectedPresetId, setSelectedPresetId] = useState<string>('custom');
  const [presetName, setPresetName] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [hoveredDeleteId, setHoveredDeleteId] = useState<string | null>(null);
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Fetch presets on mount
  useEffect(() => {
    api
      .get<SearchPresetType[]>('/users/presets')
      .then((res) => {
        setPresets(res.data);
      })
      .catch(() => {
        // silent — presets are non-critical
      });
  }, []);

  // Auto-dismiss inline delete confirmation after 5 seconds
  useEffect(() => {
    if (confirmDeleteId) {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
      dismissTimerRef.current = setTimeout(() => {
        setConfirmDeleteId(null);
      }, 5000);
    }
    return () => {
      if (dismissTimerRef.current) clearTimeout(dismissTimerRef.current);
    };
  }, [confirmDeleteId]);

  // Auto-dismiss save success message after 3 seconds
  useEffect(() => {
    if (!saveMessage) return;
    const t = setTimeout(() => setSaveMessage(null), 3000);
    return () => clearTimeout(t);
  }, [saveMessage]);

  const handleSavePreset = async () => {
    if (!presetName.trim() || presets.length >= MAX_PRESETS) return;
    try {
      const payload = {
        name: presetName.trim(),
        keywords: form.search.keywords,
        location: form.search.location,
        modality: form.search.modality,
        platforms: form.search.platforms,
        seniority: form.search.seniority,
        languages: form.search.languages,
        datePosted: form.search.datePosted,
        minScoreToApply: form.matching.minScoreToApply,
        maxApplicationsPerSession: form.matching.maxApplicationsPerSession,
        excludedCompanies: form.search.excludedCompanies,
      };
      const res = await api.post<SearchPresetType>('/users/presets', payload);
      setPresets((prev) => [...prev, res.data]);
      setPresetName('');
      setSaveMessage('Preset saved.');
    } catch {
      // error handling — silently fail to not interrupt main config flow
    }
  };

  const handleActivatePreset = async (presetId: string) => {
    try {
      await api.patch('/users/presets/active', { presetId });
      setActivePresetId(presetId);
    } catch {
      // silent
    }
  };

  const handleDeleteConfirmed = async (presetId: string) => {
    try {
      await api.delete(`/users/presets/${presetId}`);
      setPresets((prev) => prev.filter((p) => p.id !== presetId));
      if (activePresetId === presetId) setActivePresetId(null);
      if (selectedPresetId === presetId) setSelectedPresetId('custom');
      setConfirmDeleteId(null);
    } catch {
      // silent
    }
  };

  const handleLoadPreset = () => {
    if (selectedPresetId === 'custom') return;
    const preset = presets.find((p) => p.id === selectedPresetId);
    if (preset) onLoadPreset(preset);
  };

  const atLimit = presets.length >= MAX_PRESETS;

  return (
    <Section title="Presets">
      {/* Preset selector row */}
      <div>
        <FieldLabel>Active Preset</FieldLabel>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select
            value={selectedPresetId}
            onChange={(e) => setSelectedPresetId(e.target.value)}
            style={{
              ...baseInput,
              height: 44,
              padding: '10px 12px',
              flex: 1,
              color: '#e2e2e8',
              appearance: 'none',
              cursor: 'pointer',
            }}
          >
            <option value="custom">Custom (unsaved)</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleLoadPreset}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              background: C.surface,
              border: `1px solid ${C.border}`,
              color: '#e2e2e8',
              fontSize: 14,
              fontWeight: 700,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            Load Preset
          </button>
        </div>
      </div>

      {/* Save as preset */}
      <div>
        <FieldLabel>Save current settings as preset</FieldLabel>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            placeholder="Name this preset..."
            style={{ ...baseInput, height: 44, padding: '10px 12px', flex: 1 }}
          />
          <button
            type="button"
            onClick={() => { void handleSavePreset(); }}
            disabled={atLimit}
            style={{
              height: 36,
              padding: '0 16px',
              borderRadius: 8,
              background: C.accent,
              border: 'none',
              color: '#fff',
              fontSize: 14,
              fontWeight: 700,
              cursor: atLimit ? 'not-allowed' : 'pointer',
              opacity: atLimit ? 0.5 : 1,
              whiteSpace: 'nowrap',
              alignSelf: 'center',
              fontFamily: 'Inter, system-ui, sans-serif',
            }}
          >
            Save Preset
          </button>
        </div>

        {atLimit && (
          <p style={{ fontSize: 12, color: '#fbbf24', margin: '6px 0 0' }}>
            Maximum 5 presets reached. Delete one to save a new preset.
          </p>
        )}

        {saveMessage && (
          <p style={{ fontSize: 12, color: C.success, margin: '6px 0 0' }}>
            {saveMessage}
          </p>
        )}
      </div>

      {/* Preset list */}
      {presets.length > 0 && (
        <div
          style={{
            background: C.surface,
            border: `1px solid ${C.border}`,
            borderRadius: 12,
            overflow: 'hidden',
          }}
        >
          {presets.map((preset, idx) => {
            const isActive = preset.id === activePresetId;
            const isConfirming = confirmDeleteId === preset.id;

            if (isConfirming) {
              return (
                <div
                  key={preset.id}
                  role="group"
                  aria-label={`Delete confirmation for ${preset.name}`}
                  style={{
                    padding: '12px 16px',
                    borderBottom: idx < presets.length - 1 ? `1px solid ${C.border}` : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                  }}
                >
                  <p style={{ fontSize: 14, color: '#e2e2e8', margin: 0 }}>
                    Delete preset &ldquo;{preset.name}&rdquo;? This cannot be undone.
                  </p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => { void handleDeleteConfirmed(preset.id); }}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        background: C.error,
                        border: 'none',
                        color: '#fff',
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    >
                      Delete Preset
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDeleteId(null)}
                      style={{
                        padding: '6px 14px',
                        borderRadius: 6,
                        background: 'none',
                        border: 'none',
                        color: C.textMuted,
                        fontSize: 13,
                        cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    >
                      Keep Preset
                    </button>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={preset.id}
                style={{
                  padding: '12px 16px',
                  borderBottom: idx < presets.length - 1 ? `1px solid ${C.border}` : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  backgroundColor: isActive ? 'rgba(99,102,241,0.06)' : 'transparent',
                  borderLeft: isActive ? '4px solid rgba(99,102,241,0.4)' : '4px solid transparent',
                }}
              >
                <span style={{ fontSize: 14, color: '#e2e2e8', fontWeight: 400 }}>
                  {preset.name}
                </span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  {!isActive && (
                    <button
                      type="button"
                      onClick={() => { void handleActivatePreset(preset.id); }}
                      style={{
                        padding: '4px 12px',
                        borderRadius: 999,
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        color: '#e2e2e8',
                        fontSize: 12,
                        cursor: 'pointer',
                        fontFamily: 'Inter, system-ui, sans-serif',
                      }}
                    >
                      Activate Preset
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Delete ${preset.name} preset`}
                    onClick={() => setConfirmDeleteId(preset.id)}
                    onMouseEnter={() => setHoveredDeleteId(preset.id)}
                    onMouseLeave={() => setHoveredDeleteId(null)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <IconTrash hovered={hoveredDeleteId === preset.id} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Section>
  );
};

// ─── ConfigPage ───────────────────────────────────────────────────────────────
const ConfigPage: React.FC = () => {
  const navigate = useNavigate();
  const [form, setForm] = useState<AppConfig>(DEFAULT_CONFIG);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [missingProfileFields, setMissingProfileFields] = useState<string[]>([]);

  // Load config and profile completeness in parallel on mount
  useEffect(() => {
    Promise.all([
      fetchConfig().catch(() => null),
      api.get<{ missingFields: string[] }>('/users/profile').catch(() => null),
    ]).then(([config, profileRes]) => {
      if (config) setForm(config);
      if (profileRes) setMissingProfileFields(profileRes.data.missingFields);
      setIsLoading(false);
    });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setBanner(null);
    setIsSaving(true);
    saveConfig(form)
      .then(() => api.post<{ sessionId: string }>('/sessions', {}))
      .then(() => {
        navigate('/applications');
      })
      .catch((err: unknown) => {
        // 409 = session already active → still navigate to dashboard
        if (
          err != null &&
          typeof err === 'object' &&
          'response' in err &&
          (err as { response?: { status?: number } }).response?.status === 409
        ) {
          navigate('/applications');
          return;
        }
        const message = err instanceof Error ? err.message : 'Failed to start session';
        setBanner({ type: 'error', message });
      })
      .finally(() => {
        setIsSaving(false);
      });
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

  /** Populate form fields from a loaded preset */
  const handleLoadPreset = useCallback((preset: SearchPresetType) => {
    setForm((prev) => ({
      ...prev,
      search: {
        ...prev.search,
        keywords: preset.keywords,
        location: preset.location,
        modality: preset.modality,
        seniority: preset.seniority,
        languages: preset.languages,
        datePosted: preset.datePosted,
        excludedCompanies: preset.excludedCompanies,
      },
      matching: {
        ...prev.matching,
        minScoreToApply: preset.minScoreToApply,
        maxApplicationsPerSession: preset.maxApplicationsPerSession,
      },
    }));
  }, []);

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

        {/* Incomplete profile banner */}
        {missingProfileFields.length > 0 && (
          <div
            role="alert"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
              borderRadius: 10,
              padding: '12px 16px',
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                <path d="M12 9v4" /><path d="M12 17h.01" />
              </svg>
              <span style={{ fontSize: 13, color: '#fbbf24' }}>
                Your profile is incomplete — upload your CV so the agent can match jobs accurately.
              </span>
            </div>
            <button
              type="button"
              onClick={() => void navigate('/profile')}
              style={{
                background: 'rgba(245,158,11,0.15)',
                border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: 8,
                color: '#fbbf24',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 700,
                padding: '6px 14px',
                fontFamily: 'Inter, system-ui, sans-serif',
                whiteSpace: 'nowrap',
              }}
            >
              Go to Profile →
            </button>
          </div>
        )}

        {/* Config save banner */}
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

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* 0. Presets — at the TOP before Keywords */}
          <PresetManagementSection form={form} onLoadPreset={handleLoadPreset} />

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
                disabled={isSaving}
                style={{
                  background: isSaving ? `${C.accent}88` : C.accent,
                  border: 'none',
                  borderRadius: 10,
                  color: '#fff',
                  cursor: isSaving ? 'not-allowed' : 'pointer',
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
                {isSaving && (
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
                {isSaving ? 'Saving…' : 'Save & Start Agent'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Keyframe for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default ConfigPage;
