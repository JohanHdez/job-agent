import React from 'react';

const IconMail: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect width="20" height="16" x="2" y="4" rx="2" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

const IconCheck: React.FC = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Email sending status section on the Profile page.
 * Replaces the SMTP form — emails are sent via Gmail API using the Google session.
 */
const SmtpConfigSection: React.FC = () => (
  <div
    style={{
      backgroundColor: '#1a1a24',
      border: '1px solid #2a2a38',
      borderRadius: 12,
      padding: 24,
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
      <span style={{ color: '#6366f1' }}>
        <IconMail />
      </span>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#f0f0f8', margin: 0 }}>
        Email Configuration
      </h3>
    </div>
    <p style={{ fontSize: 12, color: '#6b7280', margin: '0 0 16px' }}>
      Used to send applications by email
    </p>

    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        backgroundColor: 'rgba(34,197,94,0.07)',
        border: '1px solid rgba(34,197,94,0.2)',
        borderRadius: 8,
      }}
    >
      <span style={{ color: '#4ade80', flexShrink: 0 }}>
        <IconCheck />
      </span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 600, color: '#4ade80', margin: 0 }}>
          Connected with Google
        </p>
        <p style={{ fontSize: 12, color: '#6b7280', margin: '2px 0 0' }}>
          Emails are sent directly via your Gmail account — no SMTP setup required.
        </p>
      </div>
    </div>
  </div>
);

export default SmtpConfigSection;
