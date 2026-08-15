'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@/lib/api';
import { Card, PageHeader, StatusBadge, Button, EmptyState, LoadingState } from '@/components/ui';

interface PendingWorker {
  id: string;
  fullName: string;
  photoUrl: string | null;
  city: { name: string };
  verificationStatus: string;
  yearsExperience: number;
  languages: string[];
  skills: { category: { name: string } }[];
  createdAt: string;
}

interface WorkerDetail extends PendingWorker {
  documents: { id: string; type: string; status: string; viewUrl: string; rejectReason: string | null }[];
  verificationNote: string | null;
}

const fetcher = <T,>(path: string) => api.get<T>(path);

export default function WorkersPage() {
  const { data: pending, isLoading, mutate } = useSWR<PendingWorker[]>('/admin/workers/pending', fetcher);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Worker verification" subtitle="Review KYC documents before a worker can accept jobs." />

      {isLoading ? (
        <LoadingState />
      ) : !pending || pending.length === 0 ? (
        <EmptyState message="No workers awaiting review right now." />
      ) : (
        <div className="grid gap-3">
          {pending.map((w) => (
            <Card key={w.id} className="flex items-center justify-between py-4">
              <div>
                <p className="font-medium text-navy-900">{w.fullName}</p>
                <p className="text-sm text-navy-700/50 mt-0.5">
                  {w.city.name} · {w.yearsExperience} yrs exp · {w.skills.map((s) => s.category.name).join(', ') || 'No skills added'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={w.verificationStatus} />
                <Button variant="secondary" onClick={() => setSelectedId(w.id)}>
                  Review
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {selectedId && (
        <WorkerReviewModal
          workerId={selectedId}
          onClose={() => setSelectedId(null)}
          onDecided={() => {
            setSelectedId(null);
            mutate();
          }}
        />
      )}
    </div>
  );
}

function WorkerReviewModal({ workerId, onClose, onDecided }: { workerId: string; onClose: () => void; onDecided: () => void }) {
  const { data: worker, isLoading } = useSWR<WorkerDetail>(`/admin/workers/${workerId}`, fetcher);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: 'APPROVE' | 'REJECT' | 'REQUEST_RESUBMISSION') {
    setSubmitting(action);
    setError(null);
    try {
      await api.post(`/admin/workers/${workerId}/review`, { action, note: note || undefined });
      onDecided();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(null);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy-900/40 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-xl2 shadow-card max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !worker ? (
          <LoadingState />
        ) : (
          <>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-navy-900">{worker.fullName}</h2>
                <p className="text-sm text-navy-700/50">
                  {worker.city.name} · {worker.languages.join(', ')}
                </p>
              </div>
              <StatusBadge status={worker.verificationStatus} />
            </div>

            <h3 className="text-sm font-semibold text-navy-900 mb-2 mt-6">Submitted documents</h3>
            {worker.documents.length === 0 ? (
              <p className="text-sm text-navy-700/50">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {worker.documents.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.viewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg border border-navy-900/10 overflow-hidden hover:border-gold-500/50 transition"
                  >
                    <div className="aspect-video bg-navy-900/5 flex items-center justify-center text-xs text-navy-700/40">
                      {doc.type.replaceAll('_', ' ')}
                    </div>
                    <div className="px-3 py-2 flex items-center justify-between">
                      <span className="text-xs text-navy-900">{doc.type.replaceAll('_', ' ')}</span>
                      <StatusBadge status={doc.status} />
                    </div>
                  </a>
                ))}
              </div>
            )}

            <label className="flex flex-col gap-1.5 mt-6">
              <span className="text-sm font-medium text-navy-900">Note (shown to the worker if rejected)</span>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500 focus:ring-2 focus:ring-gold-500/20"
                placeholder="e.g. Government ID photo is blurry, please re-upload"
              />
            </label>

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

            <div className="flex items-center gap-3 mt-6">
              <Button variant="secondary" disabled={!!submitting} onClick={() => decide('APPROVE')}>
                {submitting === 'APPROVE' ? 'Approving…' : 'Approve worker'}
              </Button>
              <Button variant="ghost" disabled={!!submitting} onClick={() => decide('REQUEST_RESUBMISSION')}>
                Request resubmission
              </Button>
              <Button variant="danger" disabled={!!submitting} onClick={() => decide('REJECT')}>
                Reject
              </Button>
              <Button variant="ghost" className="ml-auto" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
