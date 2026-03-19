import React, { useRef, useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import SmtpConfigSection from './SmtpConfigSection';

/* ── Types ────────────────────────────────────────────────────────────────── */

type SeniorityLevel = 'Junior' | 'Mid' | 'Senior' | 'Lead' | 'Principal' | 'Executive';
type LanguageLevel = 'Native' | 'Fluent' | 'Advanced' | 'Intermediate' | 'Basic';

interface WorkExperience {
  company: string;
  title: string;
  startDate: string;
  endDate: string;
  description: string[];
  technologies: string[];
}

interface Education {
  institution: string;
  degree: string;
  field: string;
  graduationYear: number;
}

interface Language {
  name: string;
  level: LanguageLevel;
}

interface ProfessionalProfile {
  fullName: string;
  email: string;
  phone?: string;
  location?: string;
  linkedinUrl?: string;
  headline: string;
  summary: string;
  seniority: SeniorityLevel;
  yearsOfExperience: number;
  skills: string[];
  techStack: string[];
  languages: Language[];
  experience: WorkExperience[];
  education: Education[];
}

interface ProfileApiResponse {
  profile: ProfessionalProfile | null;
  isComplete: boolean;
  missingFields: string[];
}

interface UploadApiResponse {
  profile: ProfessionalProfile;
  isComplete: boolean;
  missingFields: string[];
}

/* ── Constants ────────────────────────────────────────────────────────────── */

const SENIORITY_COLORS: Record<SeniorityLevel, { bg: string; text: string; border: string }> = {
  Junior:    { bg: 'rgba(34,197,94,0.1)',   text: '#4ade80',  border: 'rgba(34,197,94,0.25)'   },
  Mid:       { bg: 'rgba(59,130,246,0.1)',   text: '#60a5fa',  border: 'rgba(59,130,246,0.25)'   },
  Senior:    { bg: 'rgba(99,102,241,0.1)',   text: '#818cf8',  border: 'rgba(99,102,241,0.25)'   },
  Lead:      { bg: 'rgba(168,85,247,0.1)',   text: '#c084fc',  border: 'rgba(168,85,247,0.25)'   },
  Principal: { bg: 'rgba(245,158,11,0.1)',   text: '#fbbf24',  border: 'rgba(245,158,11,0.25)'   },
  Executive: { bg: 'rgba(239,68,68,0.1)',    text: '#f87171',  border: 'rgba(239,68,68,0.25)'    },
};

const baseInput: React.CSSProperties = {
  background: '#12121a',
  border: '1px solid #2a2a38',
  borderRadius: 8,
  color: '#e2e2e8',
  fontSize: 14,
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
  fontFamily: 'Inter, system-ui, sans-serif',
  padding: '10px 12px',
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

/** Alert triangle icon for the incomplete profile banner */
const IconAlertTriangle: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="M12 17h.01" />
  </svg>
);

/* ── Helper sub-components ────────────────────────────────────────────────── */

interface ChipProps {
  label: string;
  variant: 'indigo' | 'slate';
}

const Chip: React.FC<ChipProps> = ({ label, variant }) => {
  const styles =
    variant === 'indigo'
      ? { backgroundColor: 'rgba(99,102,241,0.12)', color: '#a5b4fc', border: '1px solid rgba(99,102,241,0.25)' }
      : { backgroundColor: 'rgba(100,116,139,0.12)', color: '#94a3b8',  border: '1px solid rgba(100,116,139,0.25)' };

  return (
    <span
      style={{
        ...styles,
        display: 'inline-block',
        padding: '3px 10px',
        borderRadius: '999px',
        fontSize: '12px',
        fontWeight: 500,
        lineHeight: 1.6,
      }}
    >
      {label}
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

/* ── Incomplete profile banner ────────────────────────────────────────────── */

interface IncompleteBannerProps {
  missingFields: string[];
}

const IncompleteBanner: React.FC<IncompleteBannerProps> = ({ missingFields }) => {
  const navigate = useNavigate();

  if (missingFields.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        backgroundColor: 'rgba(245,158,11,0.08)',
        border: '1px solid rgba(245,158,11,0.25)',
        borderRadius: 12,
        padding: 16,
        display: 'flex',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 24,
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1 }}>
        <IconAlertTriangle />
      </span>
      <p style={{ fontSize: 14, color: '#fbbf24', margin: 0, lineHeight: 1.5 }}>
        Your profile is missing: {missingFields.join(', ')}. Add them to improve job matching.{' '}
        <button
          type="button"
          onClick={() => void navigate('/profile/setup')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: '#6366f1',
            fontSize: 14,
            fontWeight: 700,
            padding: 0,
            fontFamily: 'Inter, system-ui, sans-serif',
            textDecoration: 'underline',
          }}
        >
          Complete profile
        </button>
      </p>
    </div>
  );
};

/* ── Upload dropzone ──────────────────────────────────────────────────────── */

interface UploadState {
  status: 'idle' | 'uploading' | 'success' | 'error';
  message: string;
}

interface DropzoneProps {
  onUploadSuccess: (response: UploadApiResponse) => void;
}

const CvDropzone: React.FC<DropzoneProps> = ({ onUploadSuccess }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>({ status: 'idle', message: '' });
  const [isUploading, setIsUploading] = useState(false);

  const handleFile = useCallback(
    async (file: File) => {
      const ext = file.name.split('.').pop()?.toLowerCase();
      if (ext !== 'pdf' && ext !== 'docx') {
        setUploadState({
          status: 'error',
          message: 'Upload failed. Check the file is a PDF under 10 MB and try again.',
        });
        return;
      }
      setUploadState({ status: 'uploading', message: 'Uploading…' });
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append('cv', file);
        const res = await api.post<UploadApiResponse>('/users/profile/cv', formData);
        setUploadState({ status: 'success', message: 'CV uploaded and parsed successfully!' });
        onUploadSuccess(res.data);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Upload failed.';
        setUploadState({
          status: 'error',
          message: 'Upload failed. Check the file is a PDF under 10 MB and try again.',
        });
        // Log for debugging without console.log
        void msg;
      } finally {
        setIsUploading(false);
      }
    },
    [onUploadSuccess]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) void handleFile(file);
    },
    [handleFile]
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
      e.target.value = '';
    },
    [handleFile]
  );

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
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            !isUploading && fileInputRef.current?.click();
          }
        }}
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
        <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>PDF or DOCX · max 10 MB</p>
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
          {uploadState.status === 'success'   && <IconCheck />}
          {uploadState.status === 'error'     && <IconAlertCircle />}
          {uploadState.status === 'uploading' && <IconLoader />}
          {uploadState.message}
        </div>
      )}
    </div>
  );
};

/* ── Profile display (view mode) ──────────────────────────────────────────── */

interface ProfileDisplayProps {
  profile: ProfessionalProfile;
}

const ProfileDisplay: React.FC<ProfileDisplayProps> = ({ profile }) => {
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
        </div>

        {profile.summary && (
          <p style={{ fontSize: '13px', lineHeight: 1.7, color: '#9090a8', margin: '16px 0 0', paddingTop: '16px', borderTop: '1px solid #2a2a38' }}>
            {profile.summary}
          </p>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
        {profile.techStack.length > 0 && (
          <SectionCard title="Tech Stack" icon={<span style={{ fontSize: '16px' }}>{'</>'}</span>}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.techStack.map((tech) => (
                <Chip key={tech} label={tech} variant="indigo" />
              ))}
            </div>
          </SectionCard>
        )}

        {profile.languages.length > 0 && (
          <SectionCard title="Languages" icon={<span style={{ fontSize: '16px' }}>🌐</span>}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {profile.languages.map((lang) => (
                <Chip key={lang.name} label={`${lang.name} · ${lang.level}`} variant="slate" />
              ))}
            </div>
          </SectionCard>
        )}
      </div>

      {profile.skills.length > 0 && (
        <SectionCard title="Skills" icon={<span style={{ fontSize: '16px' }}>⚡</span>}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {profile.skills.map((skill) => (
              <Chip key={skill} label={skill} variant="indigo" />
            ))}
          </div>
        </SectionCard>
      )}

      {profile.experience.length > 0 && (
        <SectionCard title="Experience" icon={<IconBriefcase />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {profile.experience.map((job, idx) => (
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

      {profile.education.length > 0 && (
        <SectionCard title="Education" icon={<IconGraduationCap />}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {profile.education.map((edu, idx) => (
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

/* ── Edit form ────────────────────────────────────────────────────────────── */

interface EditFormProps {
  profile: ProfessionalProfile;
  onSave: (updated: Partial<ProfessionalProfile>) => Promise<void>;
  onDiscard: () => void;
  isSaving: boolean;
  saveSuccess: boolean;
}

const EditForm: React.FC<EditFormProps> = ({ profile, onSave, onDiscard, isSaving, saveSuccess }) => {
  const [fullName, setFullName] = useState(profile.fullName);
  const [headline, setHeadline] = useState(profile.headline);
  const [location, setLocation] = useState(profile.location ?? '');
  const [summary, setSummary] = useState(profile.summary);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      fullName: fullName.trim() || undefined,
      headline: headline.trim() || undefined,
      location: location.trim() || undefined,
      summary: summary.trim() || undefined,
    });
  };

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <SectionCard title="Identity" icon={<IconUser />}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }} htmlFor="edit-fullName">
              Full Name
            </label>
            <input
              id="edit-fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              style={baseInput}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }} htmlFor="edit-headline">
              Headline
            </label>
            <input
              id="edit-headline"
              type="text"
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              style={baseInput}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }} htmlFor="edit-location">
              Location
            </label>
            <input
              id="edit-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              style={baseInput}
            />
          </div>
          <div>
            <label style={{ fontSize: 12, color: '#6b7280', display: 'block', marginBottom: 6 }} htmlFor="edit-summary">
              Summary
            </label>
            <textarea
              id="edit-summary"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              rows={4}
              style={{
                ...baseInput,
                height: 'auto',
                resize: 'vertical',
                padding: '10px 12px',
              }}
            />
          </div>
        </div>
      </SectionCard>

      {saveSuccess && (
        <div
          style={{
            backgroundColor: 'rgba(34,197,94,0.08)',
            border: '1px solid rgba(34,197,94,0.25)',
            borderRadius: 8,
            color: '#22c55e',
            fontSize: 14,
            padding: '12px 16px',
          }}
        >
          Profile updated successfully.
        </div>
      )}

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
        Save Changes
      </button>

      <button
        type="button"
        onClick={onDiscard}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#6b7280',
          fontSize: 14,
          textAlign: 'center',
          padding: '4px 0',
          fontFamily: 'Inter, system-ui, sans-serif',
        }}
      >
        Discard Changes
      </button>
    </form>
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
 * Profile page — view and edit professional profile, upload CV, see completeness alerts.
 */
const ProfilePage: React.FC = () => {
  const [showDropzone, setShowDropzone] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [profile, setProfile] = useState<ProfessionalProfile | null>(null);
  const [missingFields, setMissingFields] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isError, setIsError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Fetch profile + completeness on mount
  useEffect(() => {
    setIsLoading(true);
    api
      .get<ProfileApiResponse>('/users/profile')
      .then((res) => {
        setProfile(res.data.profile);
        setMissingFields(res.data.missingFields);
        setIsLoading(false);
      })
      .catch(() => {
        setIsError(true);
        setIsLoading(false);
      });
  }, []);

  const hasProfile = profile !== null;

  const handleSaveEdit = useCallback(
    async (updated: Partial<ProfessionalProfile>) => {
      setIsSaving(true);
      setSaveSuccess(false);
      try {
        const res = await api.patch<{ profile: ProfessionalProfile }>('/users/profile', updated);
        setProfile(res.data.profile);
        setSaveSuccess(true);
        setIsEditing(false);
        // Refresh missing fields
        const refreshRes = await api.get<ProfileApiResponse>('/users/profile');
        setMissingFields(refreshRes.data.missingFields);
      } catch {
        // leave editing mode open so user can retry
      } finally {
        setIsSaving(false);
      }
    },
    []
  );

  const handleCvUploadSuccess = useCallback((response: UploadApiResponse) => {
    setProfile(response.profile);
    setMissingFields(response.missingFields);
    setShowDropzone(false);
  }, []);

  const handleDiscard = useCallback(() => {
    setIsEditing(false);
    setSaveSuccess(false);
  }, []);

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

          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            {/* Edit Profile / Discard toggle */}
            {hasProfile && !isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 18px',
                  borderRadius: '10px',
                  fontSize: '13px',
                  fontWeight: 700,
                  border: '1px solid #2a2a38',
                  cursor: 'pointer',
                  background: '#1a1a24',
                  color: '#e2e2e8',
                  transition: 'all 0.15s',
                }}
              >
                Edit Profile
              </button>
            )}

            {hasProfile && isEditing && (
              <button
                type="button"
                onClick={handleDiscard}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '13px',
                  fontFamily: 'Inter, system-ui, sans-serif',
                  padding: '9px 0',
                }}
              >
                Discard Changes
              </button>
            )}

            {/* Import CV button */}
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
            >
              <IconUpload />
              Import CV
            </button>
          </div>
        </div>

        {/* ── Incomplete profile banner ── */}
        {!isLoading && missingFields.length > 0 && (
          <IncompleteBanner missingFields={missingFields} />
        )}

        {/* ── Upload dropzone (toggled) ── */}
        {showDropzone && (
          <div style={{ marginBottom: '32px' }}>
            <CvDropzone onUploadSuccess={handleCvUploadSuccess} />
          </div>
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
            Could not connect to the API. Make sure the server is running on port 3001.
          </div>
        )}

        {!isLoading && !isError && (
          hasProfile && profile
            ? isEditing
              ? (
                <EditForm
                  profile={profile}
                  onSave={handleSaveEdit}
                  onDiscard={handleDiscard}
                  isSaving={isSaving}
                  saveSuccess={saveSuccess}
                />
              )
              : <ProfileDisplay profile={profile} />
            : !showDropzone && <EmptyState />
        )}

        {/* ── Email Configuration section ── */}
        {!isLoading && !isError && (
          <div style={{ marginTop: 32 }}>
            {/* Visual separator */}
            <div style={{ borderTop: '1px solid #1e1e2e', marginBottom: 32 }} />
            <SmtpConfigSection />
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
