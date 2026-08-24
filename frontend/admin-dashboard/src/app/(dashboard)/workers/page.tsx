'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { Card, PageHeader, StatusBadge, Button, EmptyState, LoadingState } from '@/components/ui';
import { ShieldAlert } from 'lucide-react';

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
  guardianName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  addressLine: string | null;
  kycCity: string | null;
  kycState: string | null;
  kycPincode: string | null;
  qualification: string | null;
  previousExperience: string | null;
  kycSubmittedAt: string | null;
  phone: string | null;
}

const fetcher = <T,>(path: string) => api.get<T>(path);

export default function WorkersPage() {
  const { admin } = useAuth();
  const canVerify = hasPermission(admin?.staffRole, 'verification');

  const { data: pending, isLoading, mutate } = useSWR<PendingWorker[]>(canVerify ? '/admin/workers/pending' : null, fetcher);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (!canVerify) {
    return (
      <div className="py-12">
        <PageHeader title="Worker verification" subtitle="Access is restricted to the Verification team." />
        <Card>
          <div className="flex items-center gap-4 py-6 text-center justify-center flex-col">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="font-semibold text-base text-foreground">Verification Permission Required</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Only accounts with <strong className="text-foreground">Verification</strong>, <strong className="text-foreground">Operations</strong>, or <strong className="text-foreground">Super Admin</strong> permissions can review worker KYC submissions.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

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
            <Card key={w.id}>
              <div className="flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="font-semibold text-base text-foreground">{w.fullName}</p>
                  <p className="text-sm text-muted-foreground">
                    {w.city.name} · {w.yearsExperience} yrs exp · {w.skills.map((s) => s.category.name).join(', ') || 'No skills added'}
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={w.verificationStatus} />
                  <Button variant="secondary" onClick={() => setSelectedId(w.id)}>
                    Review
                  </Button>
                </div>
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

            <h3 className="text-sm font-semibold text-navy-900 mb-2">Personal information</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm bg-muted/40 rounded-lg p-3.5 border border-border/60">
              <p><span className="text-muted-foreground">Phone:</span> <span className="text-foreground">{worker.phone ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Guardian:</span> <span className="text-foreground">{worker.guardianName ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Date of birth:</span> <span className="text-foreground">{worker.dateOfBirth ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Gender:</span> <span className="text-foreground">{worker.gender ?? '—'}</span></p>
              <p className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="text-foreground">{worker.addressLine ?? '—'}{worker.kycCity ? `, ${worker.kycCity}` : ''}{worker.kycState ? `, ${worker.kycState}` : ''} {worker.kycPincode ?? ''}</span></p>
              <p><span className="text-muted-foreground">Qualification:</span> <span className="text-foreground">{worker.qualification ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Submitted:</span> <span className="text-foreground">{worker.kycSubmittedAt ? new Date(worker.kycSubmittedAt).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—'}</span></p>
              {worker.previousExperience && (
                <p className="col-span-2 pt-1"><span className="text-muted-foreground">Experience:</span> <span className="text-foreground">{worker.previousExperience}</span></p>
              )}
            </div>

            <h3 className="text-sm font-semibold text-navy-900 mb-2 mt-6">Submitted documents</h3>
            {worker.documents.length === 0 ? (
              <p className="text-sm text-navy-700/50">No documents uploaded yet.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {worker.documents.map((doc) => {
                  const backendBase = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';
                  const fullUrl = doc.viewUrl.startsWith('http')
                    ? doc.viewUrl
                    : `${backendBase}${doc.viewUrl.startsWith('/') ? '' : '/'}${doc.viewUrl}`;
                  const isImage = /\.(jpg|jpeg|png|webp)($|\?)/i.test(doc.viewUrl) || doc.viewUrl.startsWith('data:image');

                  return (
                    <div
                      key={doc.id}
                      className="rounded-lg border border-navy-900/15 overflow-hidden bg-slate-50 flex flex-col justify-between shadow-xs"
                    >
                      <div className="relative aspect-video bg-navy-900/5 flex items-center justify-center overflow-hidden group">
                        {isImage ? (
                          <img
                            src={fullUrl}
                            alt={doc.type}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="text-center p-3">
                            <span className="text-xs font-semibold text-navy-800">{doc.type.replaceAll('_', ' ')}</span>
                            <p className="text-[10px] text-navy-500 mt-0.5">PDF / Document file</p>
                          </div>
                        )}
                        <a
                          href={fullUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="absolute inset-0 bg-navy-950/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-semibold gap-1.5 transition-opacity"
                        >
                          Open document ↗
                        </a>
                      </div>
                      <div className="px-3 py-2 flex items-center justify-between border-t border-navy-900/10 bg-white">
                        <span className="text-xs font-semibold text-navy-900 truncate max-w-[130px]" title={doc.type.replaceAll('_', ' ')}>
                          {doc.type.replaceAll('_', ' ')}
                        </span>
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
                  );
                })}
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
