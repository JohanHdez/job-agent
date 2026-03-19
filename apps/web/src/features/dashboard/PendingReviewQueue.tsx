import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import EmailDraftModal from '../applications/EmailDraftModal';

/* ── Types ─────────────────────────────────────────────────────────────────── */

export interface PendingReviewQueueProps {
  onDraftReviewed: () => void;
}

interface DraftVacancy {
  _id: string;
  title: string;
  company: string;
  compatibilityScore: number;
  recipientEmail?: string | null;
}

interface DraftApplication {
  _id: string;
  vacancyId: string;
  status: string;
  vacancy?: DraftVacancy;
}

interface ApplicationsApiResponse {
  data: DraftApplication[];
  total: number;
  page: number;
  pageSize: number;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */

function scoreColor(score: number): string {
  if (score >= 80) return '#22c55e';
  if (score >= 60) return '#eab308';
  return '#ef4444';
}

/* ── ScorePill ──────────────────────────────────────────────────────────────── */

const ScorePill: React.FC<{ score: number }> = ({ score }) => {
  const color = scoreColor(score);
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '2px 8px',
        borderRadius: '999px',
        fontSize: 11,
        fontWeight: 700,
        color,
        backgroundColor: `${color}18`,
        border: `1px solid ${color}33`,
        fontVariantNumeric: 'tabular-nums',
        flexShrink: 0,
      }}
    >
      {score}
    </span>
  );
};

/* ── PendingReviewQueue ─────────────────────────────────────────────────────── */

/**
 * Horizontal scrollable row of draft/pending_review application cards.
 * Hidden entirely when no drafts exist.
 * Each card has a "Review Draft" button that opens EmailDraftModal.
 */
const PendingReviewQueue: React.FC<PendingReviewQueueProps> = ({ onDraftReviewed }) => {
  const [selectedApp, setSelectedApp] = useState<DraftApplication | null>(null);

  const { data, refetch } = useQuery<ApplicationsApiResponse>({
    queryKey: ['pending-drafts'],
    queryFn: async () => {
      const res = await api.get<ApplicationsApiResponse>('/applications', {
        params: { status: 'pending_review', page: 1 },
      });
      return res.data;
    },
    refetchOnWindowFocus: false,
  });

  const drafts = data?.data ?? [];

  if (drafts.length === 0) return null;

  return (
    <>
      <div>
        <h3
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#818cf8',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            margin: '0 0 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <span
            style={{
              display: 'inline-block',
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: '#818cf8',
            }}
          />
          Pending Review
          <span
            style={{
              fontSize: 11,
              fontWeight: 600,
              color: '#818cf8',
              background: 'rgba(99,102,241,0.12)',
              padding: '1px 7px',
              borderRadius: 999,
            }}
          >
            {drafts.length}
          </span>
        </h3>

        {/* Horizontal scroll */}
        <div
          style={{
            display: 'flex',
            gap: 12,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollbarWidth: 'thin',
          }}
        >
          {drafts.map((app) => {
            const vacancy = app.vacancy;
            if (!vacancy) return null;

            return (
              <div
                key={app._id}
                style={{
                  width: 260,
                  flexShrink: 0,
                  background: '#1a1a24',
                  border: '1px solid #2a2a38',
                  borderRadius: 12,
                  padding: 16,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: '#e2e2e8',
                      margin: '0 0 4px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {vacancy.title}
                  </p>
                  <p style={{ fontSize: 12, color: '#6b7280', margin: 0 }}>{vacancy.company}</p>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <ScorePill score={vacancy.compatibilityScore} />

                  <button
                    type="button"
                    onClick={() => setSelectedApp(app)}
                    style={{
                      background: 'transparent',
                      border: '1px solid #6366f1',
                      borderRadius: 7,
                      color: '#6366f1',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                      padding: '5px 10px',
                      fontFamily: 'Inter, system-ui, sans-serif',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(99,102,241,0.08)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'transparent'; }}
                  >
                    Review Draft
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Email Draft Modal */}
      {selectedApp?.vacancy && (
        <EmailDraftModal
          vacancyId={selectedApp.vacancy._id}
          vacancyTitle={selectedApp.vacancy.title}
          company={selectedApp.vacancy.company}
          score={selectedApp.vacancy.compatibilityScore}
          recipientEmail={selectedApp.vacancy.recipientEmail ?? null}
          onClose={() => setSelectedApp(null)}
          onSent={() => {
            setSelectedApp(null);
            void refetch();
            onDraftReviewed();
          }}
        />
      )}
    </>
  );
};

export default PendingReviewQueue;
