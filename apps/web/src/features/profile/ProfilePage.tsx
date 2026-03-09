import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { ProfessionalProfile, WorkExperience, Education, Language } from '@job-agent/core';

/* ── Re-export types used locally (no inline domain type definitions) ─────── */

type SeniorityLevel = ProfessionalProfile['seniority'];

/* ── Local UI-only response types (not domain types — safe to define here) ── */

interface ProfileApiResponse {
  hasProfile: boolean;
  profile?: ProfessionalProfile;
}

interface UploadApiResponse {
  success: boolean;
  message: string;
  fileName: string;
  sizeBytes: number;
  profile: ProfessionalProfile;
}

/** Fields the user can edit via the edit form */
interface ProfileEditFields {
  fullName: string;
  headline: string;
  summary: string;
  skills: string[];
  location: string;
}

/** Shape returned by the LinkedIn import endpoint */
interface LinkedInProfileResponse {
  success: boolean;
  profile: ProfessionalProfile;
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const API_BASE_URL = 'http://localhost:3000';
const USER_SERVICE_URL = 'http://localhost:3001';

const SENIORITY_COLORS: Record<SeniorityLevel, { bg: string; text: string; border: string }> = {
  Junior:    { bg: 'rgba(34,197,94,0.1)',   text: '#4ade80',  border: 'rgba(34,197,94,0.25)'   },
  Mid:       { bg: 'rgba(59,130,246,0.1)',   text: '#60a5fa',  border: 'rgba(59,130,246,0.25)'   },
  Senior:    { bg: 'rgba(99,102,241,0.1)',   text: '#818cf8',  border: 'rgba(99,102,241,0.25)'   },
  Lead:      { bg: 'rgba(168,85,247,0.1)',   text: '#c084fc',  border: 'rgba(168,85,247,0.25)'   },
  Principal: { bg: 'rgba(245,158,11,0.1)',   text: '#fbbf24',  border: 'rgba(245,158,11,0.25)'   },
  Executive: { bg: 'rgba(239,68,68,0.1)',    text: '#f87171',  border: 'rgba(239,68,68,0.25)'    },
};

/* ── SVG Icons ────────────────────────────────────────────────────────────── */

const IconUpload: React.FC = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" x2="12" y1="3" y2="15" />
  </svg>
);

const IconFileText: React.FC = () => (
  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" x2="8" y1="13" y2="13" />
    <line x1="16" x2="8" y1="17" y2="17" />
    <line x1="10" x2="8" y1="9" y2="9" />
  </svg>
);

const IconUser: React.FC = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const IconMail: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const IconMapPin: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

const IconBriefcase: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="14" x="2" y="7" rx="2" />
    <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
  </svg>
);

const IconGraduationCap: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
    <path d="M6 12v5c3 3 9 3 12 0v-5" />
  </svg>
);

const IconCheck: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const IconAlertCircle: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

const IconLoader: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ animation: 'spin 1s linear infinite' }}>
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);

const IconEdit: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const IconLinkedIn: React.FC = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect width="4" height="12" x="2" y="9" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

const IconX: React.FC = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/* ── Helper sub-components ────────────────────────────────────────────────── */

interface ChipProps {
  label: string;
  variant: 'indigo' | 'slate';
  onRemove?: () => void;
}

const Chip: React.FC<ChipProps> = ({ label, variant, onRemove }) => {
  const styles =
    variant === 'indigo'
      ? { backgroundColor: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }
      : { backgroundColor: 'rgba(100,116,139,0.12)', color: '#94a3b8',  border: '1px solid rgba(100,116,139,0.25)' };

  return (
    <span
      style={{
        ...styles,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: onRemove ? '3px 6px 3px 10px' : '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: 1.6,
      }}
    >
      {label}
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '1px',
            color: 'inherit',
            opacity: 0.7,
            display: 'flex',
            alignItems: 'center',
          }}
          aria-label={`Remove ${label}`}
        >
          <IconX />
        </button>
      )}
    </span>
  );
};

interface SectionCardProps {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const SectionCard: React.FC<SectionCardProps> = ({ title, icon, children }) => (
  <div
    style={{
      backgroundColor: '#1a1a24',
      border: '1px solid #2a2a38',
      borderRadius: '14px',
      padding: '24px',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
      <span style={{ color: '#6366f1' }}>{icon}</span>
      <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f8', margin: 0 }}>{title}</h3>
    </div>
    {children}
  </div>
);

/* ── Toast-style inline notification ─────────────────────────────────────── */

type ToastStatus = 'success' | 'error' | 'info';

interface ToastBannerProps {
  status: ToastStatus;
  message: string;
}

const ToastBanner: React.FC<ToastBannerProps> = ({ status, message }) => {
  const styles: Record<ToastStatus, React.CSSProperties> = {
    success: { backgroundColor: 'rgba(34,197,94,0.08)',  border: '1px solid rgba(34,197,94,0.2)',  color: '#4ade80' },
    error:   { backgroundColor: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.2)',  color: '#f87171' },
    info:    { backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' },
  };

  return (
    <div
      style={{
        ...styles[status],
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '10px 14px',
        borderRadius: '10px',
        fontSize: '13px',
        marginBottom: '16px',
      }}
    >
      {status === 'success' && <IconCheck />}
      {status === 'error'   && <IconAlertCircle />}
      {status === 'info'    && <IconLoader />}
      {message}
    </div>
  );
};

/* ── Skill chip input ─────────────────────────────────────────────────────── */

interface SkillChipInputProps {
  skills: string[];
  onChange: (skills: string[]) => void;
}

const SkillChipInput: React.FC<SkillChipInputProps> = ({ skills, onChange }) => {
  const [inputValue, setInputValue] = useState('');

  const addSkill = useCallback((raw: string) => {
    const trimmed = raw.trim();
    if (trimmed && !skills.includes(trimmed)) {
      onChange([...skills, trimmed]);
    }
    setInputValue('');
  }, [skills, onChange]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(inputValue);
    } else if (e.key === 'Backspace' && inputValue === '' && skills.length > 0) {
      onChange(skills.slice(0, -1));
    }
  }, [inputValue, skills, addSkill, onChange]);

  const handleBlur = useCallback(() => {
    if (inputValue.trim()) addSkill(inputValue);
  }, [inputValue, addSkill]);

  const removeSkill = useCallback((index: number) => {
    onChange(skills.filter((_, i) => i !== index));
  }, [skills, onChange]);

  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '6px',
        padding: '8px',
        borderRadius: '8px',
        border: '1px solid #2a2a38',
        backgroundColor: '#0f0f14',
        minHeight: '44px',
        alignItems: 'center',
      }}
    >
      {skills.map((skill, idx) => (
        <Chip
          key={`${skill}-${idx}`}
          label={skill}
          variant="indigo"
          onRemove={() => removeSkill(idx)}
        />
      ))}
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        placeholder={skills.length === 0 ? 'Type a skill, then press Enter or comma…' : 'Add more…'}
        style={{
          background: 'none',
          border: 'none',
          outline: 'none',
          color: '#e2e2e8',
          fontSize: '13px',
          flex: 1,
          minWidth: '160px',
          padding: '2px 4px',
        }}
      />
    </div>
  );
};

/* ── Upload dropzone ──────────────────────────────────────────────────────── */

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message: string;
}

interface DropzoneProps {
  onUploadSuccess: () => void;
}

const CvDropzone: React.FC<DropzoneProps> = ({ onUploadSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle', message: '' });
  const queryClient = useQueryClient();

  const uploadMutation = useMutation<UploadApiResponse, Error, File>({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('cv', file);
      const res = await fetch(`${API_BASE_URL}/api/cv/upload`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ message: 'Upload failed' })) as { message?: string };
        throw new Error(errorBody.message ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<UploadApiResponse>;
    },
    onSuccess: () => {
      setUploadState({ status: 'success', message: 'CV uploaded and parsed successfully!' });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      onUploadSuccess();
    },
    onError: (err: Error) => {
      setUploadState({ status: 'error', message: err.message });
    },
  });

  const handleFile = useCallback((file: File) => {
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'pdf' && ext !== 'docx') {
      setUploadState({ status: 'error', message: 'Only PDF and DOCX files are accepted.' });
      return;
    }
    setUploadState({ status: 'uploading', message: 'Uploading and parsing your CV…' });
    uploadMutation.mutate(file);
  }, [uploadMutation]);

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  const isUploading = uploadState.status === 'uploading';

  const borderColor = isDragging
    ? '#6366f1'
    : uploadState.status === 'success'
    ? '#4ade80'
    : uploadState.status === 'error'
    ? '#f87171'
    : '#2a2a38';

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload CV"
        onClick={() => !isUploading && fileInputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); !isUploading && fileInputRef.current?.click(); } }}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        style={{
          border: `2px dashed ${borderColor}`,
          borderRadius: '14px',
          padding: '48px 32px',
          textAlign: 'center',
          cursor: isUploading ? 'not-allowed' : 'pointer',
          backgroundColor: isDragging ? 'rgba(99,102,241,0.06)' : 'transparent',
          transition: 'all 0.2s',
          outline: 'none',
        }}
      >
        <div
          style={{
            width: '56px',
            height: '56px',
            borderRadius: '16px',
            backgroundColor: 'rgba(99,102,241,0.1)',
            border: '1px solid rgba(99,102,241,0.2)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#6366f1',
            margin: '0 auto 16px',
          }}
        >
          {isUploading ? <IconLoader /> : <IconUpload />}
        </div>

        <p style={{ fontSize: '14px', fontWeight: 500, color: '#e2e2e8', margin: '0 0 6px' }}>
          {isUploading ? 'Uploading…' : 'Drop your PDF here or click to upload'}
        </p>
        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
          PDF or DOCX · max 10 MB
        </p>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx"
        style={{ display: 'none' }}
        onChange={handleInputChange}
        aria-hidden="true"
      />

      {uploadState.status !== 'idle' && (
        <div
          style={{
            marginTop: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '10px 14px',
            borderRadius: '10px',
            fontSize: '13px',
            ...(uploadState.status === 'success'
              ? { backgroundColor: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)', color: '#4ade80' }
              : uploadState.status === 'error'
              ? { backgroundColor: 'rgba(239,68,68,0.08)',  border: '1px solid rgba(239,68,68,0.2)',  color: '#f87171' }
              : { backgroundColor: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.2)', color: '#a5b4fc' }),
          }}
        >
          {uploadState.status === 'success' && <IconCheck />}
          {uploadState.status === 'error'   && <IconAlertCircle />}
          {uploadState.status === 'uploading' && <IconLoader />}
          {uploadState.message}
        </div>
      )}
    </div>
  );
};

/* ── Profile edit form ────────────────────────────────────────────────────── */

interface ProfileEditFormProps {
  profile: ProfessionalProfile;
  onCancel: () => void;
  onSaved: () => void;
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  backgroundColor: '#0f0f14',
  border: '1px solid #2a2a38',
  borderRadius: '8px',
  padding: '9px 12px',
  fontSize: '13px',
  color: '#e2e2e8',
  outline: 'none',
  boxSizing: 'border-box',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '12px',
  fontWeight: 500,
  color: '#9090a8',
  marginBottom: '6px',
};

const ProfileEditForm: React.FC<ProfileEditFormProps> = ({ profile, onCancel, onSaved }) => {
  const queryClient = useQueryClient();

  const [fields, setFields] = useState<ProfileEditFields>({
    fullName: profile.fullName,
    headline: profile.headline,
    summary: profile.summary,
    skills: [...profile.skills],
    location: profile.location ?? '',
  });

  const [toast, setToast] = useState<{ status: ToastStatus; message: string } | null>(null);

  const updateField = useCallback(<K extends keyof ProfileEditFields>(key: K, value: ProfileEditFields[K]) => {
    setFields((prev) => ({ ...prev, [key]: value }));
  }, []);

  const saveMutation = useMutation<ProfessionalProfile, Error, ProfileEditFields>({
    mutationFn: async (updated: ProfileEditFields) => {
      const merged: ProfessionalProfile = { ...profile, ...updated };
      const res = await fetch(`${API_BASE_URL}/api/cv/profile`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(merged),
      });
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ message: 'Save failed' })) as { message?: string };
        throw new Error(errorBody.message ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<ProfessionalProfile>;
    },
    onSuccess: () => {
      setToast({ status: 'success', message: 'Profile saved successfully.' });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
      setTimeout(() => {
        onSaved();
      }, 1200);
    },
    onError: (err: Error) => {
      setToast({ status: 'error', message: err.message });
    },
  });

  const handleSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setToast(null);
    saveMutation.mutate(fields);
  }, [fields, saveMutation]);

  const isSaving = saveMutation.status === 'pending';

  return (
    <div
      style={{
        backgroundColor: '#1a1a24',
        border: '1px solid #2a2a38',
        borderRadius: '14px',
        padding: '24px',
        marginTop: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
        <span style={{ color: '#6366f1' }}><IconEdit /></span>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#f0f0f8', margin: 0 }}>Edit Profile</h3>
      </div>

      {toast && <ToastBanner status={toast.status} message={toast.message} />}

      <form onSubmit={handleSubmit}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Full name */}
          <div>
            <label htmlFor="edit-fullName" style={labelStyle}>Full name</label>
            <input
              id="edit-fullName"
              type="text"
              value={fields.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
              style={inputStyle}
              required
            />
          </div>

          {/* Headline */}
          <div>
            <label htmlFor="edit-headline" style={labelStyle}>Headline</label>
            <input
              id="edit-headline"
              type="text"
              value={fields.headline}
              onChange={(e) => updateField('headline', e.target.value)}
              style={inputStyle}
              placeholder="e.g. Senior Software Engineer · TypeScript · React"
            />
          </div>

          {/* Location */}
          <div>
            <label htmlFor="edit-location" style={labelStyle}>Location</label>
            <input
              id="edit-location"
              type="text"
              value={fields.location}
              onChange={(e) => updateField('location', e.target.value)}
              style={inputStyle}
              placeholder="e.g. Madrid, Spain (Remote)"
            />
          </div>

          {/* Summary */}
          <div>
            <label htmlFor="edit-summary" style={labelStyle}>Summary</label>
            <textarea
              id="edit-summary"
              value={fields.summary}
              onChange={(e) => updateField('summary', e.target.value)}
              rows={4}
              style={{
                ...inputStyle,
                resize: 'vertical',
                lineHeight: 1.6,
              }}
              placeholder="Brief professional summary…"
            />
          </div>

          {/* Skills chip input */}
          <div>
            <label style={labelStyle}>Skills</label>
            <p style={{ fontSize: '11px', color: '#6b7280', margin: '0 0 6px' }}>
              Press Enter or comma to add a skill. Backspace removes the last one.
            </p>
            <SkillChipInput
              skills={fields.skills}
              onChange={(skills) => updateField('skills', skills)}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button
              type="button"
              onClick={onCancel}
              disabled={isSaving}
              style={{
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 500,
                border: '1px solid #2a2a38',
                backgroundColor: 'transparent',
                color: '#9090a8',
                cursor: isSaving ? 'not-allowed' : 'pointer',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '9px 18px',
                borderRadius: '10px',
                fontSize: '13px',
                fontWeight: 600,
                border: 'none',
                background: isSaving ? 'rgba(99,102,241,0.4)' : 'linear-gradient(135deg, #6366f1, #7c3aed)',
                color: '#fff',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
            >
              {isSaving && <IconLoader />}
              {isSaving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

/* ── Profile display ──────────────────────────────────────────────────────── */

interface ProfileDisplayProps {
  profile: ProfessionalProfile;
  onEditToggle: () => void;
  onLinkedInImport: () => void;
  isImporting: boolean;
}

const ProfileDisplay: React.FC<ProfileDisplayProps> = ({ profile, onEditToggle, onLinkedInImport, isImporting }) => {
  const seniorityStyle = SENIORITY_COLORS[profile.seniority];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Identity card */}
      <div
        style={{
          backgroundColor: '#1a1a24',
          border: '1px solid #2a2a38',
          borderRadius: '14px',
          padding: '24px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          {/* Avatar placeholder */}
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, rgba(99,102,241,0.3), rgba(139,92,246,0.2))',
              border: '1px solid rgba(99,102,241,0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#6366f1',
              flexShrink: 0,
            }}
          >
            <IconUser />
          </div>

          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginBottom: '4px' }}>
              <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#f0f0f8', margin: 0 }}>
                {profile.fullName}
              </h2>
              {/* Seniority badge */}
              <span
                style={{
                  padding: '2px 10px',
                  borderRadius: '999px',
                  fontSize: '11px',
                  fontWeight: 600,
                  letterSpacing: '0.03em',
                  backgroundColor: seniorityStyle.bg,
                  color: seniorityStyle.text,
                  border: `1px solid ${seniorityStyle.border}`,
                }}
              >
                {profile.seniority}
              </span>
            </div>

            <p style={{ fontSize: '13px', color: '#9090a8', margin: '0 0 12px' }}>{profile.headline}</p>

            {/* Meta row */}
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b7280' }}>
                <IconMail /> {profile.email}
              </span>
              {profile.location && (
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#6b7280' }}>
                  <IconMapPin /> {profile.location}
                </span>
              )}
              <span style={{ fontSize: '12px', color: '#6b7280' }}>
                {profile.yearsOfExperience} yr{profile.yearsOfExperience !== 1 ? 's' : ''} experience
              </span>
            </div>
          </div>

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
            <button
              onClick={onLinkedInImport}
              disabled={isImporting}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                border: '1px solid rgba(10,102,194,0.4)',
                backgroundColor: isImporting ? 'rgba(10,102,194,0.05)' : 'rgba(10,102,194,0.1)',
                color: isImporting ? '#6b7280' : '#60a5fa',
                cursor: isImporting ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s',
              }}
              aria-label="Import from LinkedIn"
            >
              {isImporting ? <IconLoader /> : <IconLinkedIn />}
              {isImporting ? 'Importing…' : 'Import from LinkedIn'}
            </button>

            <button
              onClick={onEditToggle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '7px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 500,
                border: '1px solid #2a2a38',
                backgroundColor: 'transparent',
                color: '#9090a8',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              aria-label="Edit profile"
            >
              <IconEdit />
              Edit profile
            </button>
          </div>
        </div>

        {profile.summary && (
          <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#9090a8', margin: '16px 0 0', paddingTop: '16px', borderTop: '1px solid #2a2a38' }}>
            {profile.summary}
          </p>
        )}
      </div>

      {/* Two-column grid for tech + languages */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>

        {/* Tech Stack */}
        {profile.techStack.length > 0 && (
          <SectionCard title="Tech Stack" icon={<span style={{ fontSize: '16px' }}>{'</>'}</span>}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.techStack.map((tech) => (
                <Chip key={tech} label={tech} variant="indigo" />
              ))}
            </div>
          </SectionCard>
        )}

        {/* Languages */}
        {profile.languages.length > 0 && (
          <SectionCard title="Languages" icon={<span style={{ fontSize: '16px' }}>🌐</span>}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.languages.map((lang: Language) => (
                <Chip key={lang.name} label={`${lang.name} · ${lang.level}`} variant="slate" />
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {/* Skills */}
      {profile.skills.length > 0 && (
        <SectionCard title="Skills" icon={<span style={{ fontSize: '16px' }}>⚡</span>}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {profile.skills.map((skill) => (
              <Chip key={skill} label={skill} variant="indigo" />
            ))}
          </div>
        </SectionCard>
      )}

      {/* Experience */}
      {profile.experience.length > 0 && (
        <SectionCard title="Experience" icon={<IconBriefcase />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {profile.experience.map((job: WorkExperience, idx: number) => (
              <div
                key={`${job.company}-${idx}`}
                style={{
                  paddingBottom: idx < profile.experience.length - 1 ? '16px' : 0,
                  borderBottom: idx < profile.experience.length - 1 ? '1px solid #2a2a38' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: '#e2e2e8', margin: '0 0 2px' }}>{job.title}</p>
                    <p style={{ fontSize: '13px', color: '#9090a8', margin: 0 }}>{job.company}</p>
                  </div>
                  <span style={{ fontSize: '11px', color: '#6b7280', whiteSpace: 'nowrap', paddingTop: '2px' }}>
                    {job.startDate} — {job.endDate}
                  </span>
                </div>
                {job.technologies.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginTop: '10px' }}>
                    {job.technologies.map((tech) => (
                      <Chip key={tech} label={tech} variant="indigo" />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Education */}
      {profile.education.length > 0 && (
        <SectionCard title="Education" icon={<IconGraduationCap />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {profile.education.map((edu: Education, idx: number) => (
              <div key={`${edu.institution}-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                <div>
                  <p style={{ fontSize: '14px', fontWeight: 600, color: '#e2e2e8', margin: '0 0 2px' }}>{edu.degree} in {edu.field}</p>
                  <p style={{ fontSize: '13px', color: '#9090a8', margin: 0 }}>{edu.institution}</p>
                </div>
                <span style={{ fontSize: '11px', color: '#6b7280', paddingTop: '2px' }}>{edu.graduationYear}</span>
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
};

/* ── Empty state ──────────────────────────────────────────────────────────── */

const EmptyState: React.FC = () => (
  <div
    style={{
      textAlign: 'center',
      padding: '64px 32px',
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
      <IconFileText />
    </div>
    <p style={{ fontSize: '15px', fontWeight: 500, color: '#e2e2e8', margin: '0 0 8px' }}>
      No CV imported yet
    </p>
    <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
      Upload your PDF above to get started.
    </p>
  </div>
);

/* ── Main page ────────────────────────────────────────────────────────────── */

/**
 * Profile page — lets users upload a CV, view and edit their parsed professional
 * profile, and optionally import data directly from LinkedIn.
 */
const ProfilePage: React.FC = () => {
  const [showDropzone, setShowDropzone] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [linkedInToast, setLinkedInToast] = useState<{ status: ToastStatus; message: string } | null>(null);

  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<ProfileApiResponse>({
    queryKey: ['profile'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/cv/profile`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res.json() as Promise<ProfileApiResponse>;
    },
    retry: false,
  });

  const linkedInImportMutation = useMutation<LinkedInProfileResponse, Error>({
    mutationFn: async () => {
      const res = await fetch(`${USER_SERVICE_URL}/auth/linkedin/profile`);
      if (!res.ok) {
        const errorBody = await res.json().catch(() => ({ message: 'Import failed' })) as { message?: string };
        throw new Error(errorBody.message ?? `HTTP ${res.status}`);
      }
      return res.json() as Promise<LinkedInProfileResponse>;
    },
    onSuccess: () => {
      setLinkedInToast({ status: 'success', message: 'LinkedIn profile imported successfully.' });
      void queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
    onError: (err: Error) => {
      setLinkedInToast({ status: 'error', message: `LinkedIn import failed: ${err.message}` });
    },
  });

  /* Auto-dismiss LinkedIn toast after 5 seconds */
  useEffect(() => {
    if (!linkedInToast) return;
    const timer = setTimeout(() => setLinkedInToast(null), 5000);
    return () => clearTimeout(timer);
  }, [linkedInToast]);

  const handleLinkedInImport = useCallback(() => {
    setLinkedInToast(null);
    linkedInImportMutation.mutate();
  }, [linkedInImportMutation]);

  const hasProfile = data?.hasProfile === true && data.profile !== undefined;

  return (
    <div
      style={{
        backgroundColor: '#0f0f14',
        color: '#e2e2e8',
        minHeight: '100vh',
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Ambient glow */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 0,
          background: 'radial-gradient(ellipse 80% 50% at 50% -10%, rgba(99,102,241,0.1) 0%, transparent 70%)',
        }}
      />

      {/* Spin keyframes injected inline */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={{ position: 'relative', zIndex: 1, maxWidth: '800px', margin: '0 auto', padding: '40px 24px 80px' }}>

        {/* ── Header ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '32px',
            flexWrap: 'wrap',
            gap: '12px',
          }}
        >
          <div>
            <h1
              style={{
                fontSize: '24px',
                fontWeight: 800,
                letterSpacing: '-0.04em',
                color: '#f0f0f8',
                margin: '0 0 4px',
              }}
            >
              Your Profile
            </h1>
            <p style={{ fontSize: '13px', color: '#6b7280', margin: 0 }}>
              Manage your professional profile and CV
            </p>
          </div>

          <button
            onClick={() => setShowDropzone((v) => !v)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 18px',
              borderRadius: '10px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #6366f1, #7c3aed)',
              color: '#fff',
              boxShadow: '0 0 0 1px rgba(99,102,241,0.4), 0 4px 16px rgba(99,102,241,0.2)',
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(99,102,241,0.6), 0 6px 24px rgba(99,102,241,0.3)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '0 0 0 1px rgba(99,102,241,0.4), 0 4px 16px rgba(99,102,241,0.2)'; }}
          >
            <IconUpload />
            Import CV
          </button>
        </div>

        {/* ── Upload dropzone (toggled) ── */}
        {showDropzone && (
          <div style={{ marginBottom: '32px' }}>
            <CvDropzone onUploadSuccess={() => setShowDropzone(false)} />
          </div>
        )}

        {/* ── LinkedIn import toast ── */}
        {linkedInToast && (
          <ToastBanner status={linkedInToast.status} message={linkedInToast.message} />
        )}

        {/* ── Content ── */}
        {isLoading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '80px 0', color: '#6b7280', gap: '10px' }}>
            <IconLoader />
            <span style={{ fontSize: '13px' }}>Loading profile…</span>
          </div>
        )}

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
            Could not connect to the API. Make sure the server is running on port 3000.
          </div>
        )}

        {!isLoading && !isError && (
          hasProfile && data?.profile ? (
            <>
              <ProfileDisplay
                profile={data.profile}
                onEditToggle={() => setIsEditing((v) => !v)}
                onLinkedInImport={handleLinkedInImport}
                isImporting={linkedInImportMutation.status === 'pending'}
              />
              {isEditing && (
                <ProfileEditForm
                  profile={data.profile}
                  onCancel={() => setIsEditing(false)}
                  onSaved={() => setIsEditing(false)}
                />
              )}
            </>
          ) : (
            !showDropzone && <EmptyState />
          )
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
