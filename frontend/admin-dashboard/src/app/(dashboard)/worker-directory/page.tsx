'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { Search, UserCheck, Phone, MapPin, Star, Shield, Filter, Eye } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Card, PageHeader, LoadingState, EmptyState, StatusBadge, Button } from '@/components/ui';

interface WorkerSkill {
  category: { name: string };
}

interface WorkerListItem {
  id: string;
  fullName: string;
  photoUrl: string | null;
  phone: string | null;
  city: { name: string };
  verificationStatus: string;
  yearsExperience: number;
  languages: string[];
  skills: WorkerSkill[];
  createdAt: string;
  ratingAvg: number;
  isAvailableNow: boolean;
}

interface KycDoc {
  id: string;
  type: string;
  status: string;
  viewUrl: string;
  rejectReason: string | null;
}

interface WorkerDetail extends WorkerListItem {
  documents: KycDoc[];
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
}

const fetcher = (path: string) => api.get<WorkerListItem[]>(path);
const detailFetcher = (path: string) => api.get<WorkerDetail>(path);

const STATUS_FILTERS = [
  { value: 'ALL', label: 'All Workers' },
  { value: 'APPROVED', label: 'Verified & Active' },
  { value: 'PENDING_REVIEW', label: 'Pending Review' },
  { value: 'NEEDS_RESUBMISSION', label: 'Needs Resubmission' },
  { value: 'REJECTED', label: 'Rejected' },
  { value: 'NOT_SUBMITTED', label: 'Draft / Unsubmitted' },
];

export default function WorkerDirectoryPage() {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const queryParams = new URLSearchParams();
  if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
  if (search.trim()) queryParams.set('search', search.trim());

  const { data: workers, isLoading, mutate } = useSWR<WorkerListItem[]>(
    `/admin/workers?${queryParams.toString()}`,
    fetcher,
    { refreshInterval: 20_000 }
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worker Directory"
        subtitle={workers ? `${workers.length} registered service professionals` : 'Browse, filter, and inspect registered helpers'}
      />

      {/* Filter and Search Controls */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        {/* Status Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => setStatusFilter(f.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                statusFilter === f.value
                  ? 'bg-secondary text-secondary-foreground shadow-xs'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <div className="relative min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name or phone..."
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>

      {/* Directory Table */}
      {isLoading || !workers ? (
        <LoadingState />
      ) : workers.length === 0 ? (
        <EmptyState message="No workers found matching your filter criteria." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs font-medium text-muted-foreground bg-muted/30">
                  <th className="px-5 py-3">Worker</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">City</th>
                  <th className="px-5 py-3">Skills &amp; Services</th>
                  <th className="px-5 py-3">Rating / Exp</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Availability</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {workers.map((w) => (
                  <tr key={w.id} className="hover:bg-muted/40 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                          {w.fullName.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground text-sm truncate">{w.fullName}</p>
                          <p className="text-[11px] text-muted-foreground">Joined {format(new Date(w.createdAt), 'dd MMM yyyy')}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs text-foreground font-mono">
                      {w.phone ? (
                        <span className="flex items-center gap-1">
                          <Phone className="h-3 w-3 text-muted-foreground shrink-0" />
                          {w.phone}
                        </span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-xs text-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3 text-muted-foreground shrink-0" />
                        {w.city.name}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {w.skills.length > 0 ? (
                          w.skills.map((s, i) => (
                            <span key={i} className="px-1.5 py-0.5 rounded bg-muted text-[10px] font-medium text-foreground">
                              {s.category.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      <div className="flex items-center gap-1.5">
                        <span className="flex items-center gap-0.5 text-amber-500 font-semibold">
                          <Star className="h-3 w-3 fill-amber-500" />
                          {w.ratingAvg ? w.ratingAvg.toFixed(1) : 'New'}
                        </span>
                        <span className="text-muted-foreground font-normal">· {w.yearsExperience}y exp</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={w.verificationStatus} />
                    </td>
                    <td className="px-5 py-3.5 text-xs">
                      {w.isAvailableNow ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" /> Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-500/10 text-slate-500 border border-slate-500/20">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-400" /> Offline
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedId(w.id)}
                        className="text-xs font-semibold inline-flex items-center gap-1"
                      >
                        <Eye className="h-3 w-3" /> View Profile
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Worker Detail / Review Modal */}
      {selectedId && (
        <WorkerProfileModal
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

function WorkerProfileModal({
  workerId,
  onClose,
  onDecided,
}: {
  workerId: string;
  onClose: () => void;
  onDecided: () => void;
}) {
  const { data: worker, isLoading } = useSWR<WorkerDetail>(`/admin/workers/${workerId}`, detailFetcher);
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
    <div className="fixed inset-0 bg-navy-950/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div
        className="bg-card text-card-foreground rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 border border-border"
        onClick={(e) => e.stopPropagation()}
      >
        {isLoading || !worker ? (
          <LoadingState />
        ) : (
          <>
            <div className="flex items-start justify-between mb-4 border-b border-border pb-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">{worker.fullName}</h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {worker.city.name} · {worker.languages.join(', ') || 'Languages not specified'}
                </p>
              </div>
              <StatusBadge status={worker.verificationStatus} />
            </div>

            <h3 className="text-sm font-semibold text-foreground mb-2">Personal &amp; Contact Information</h3>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs bg-muted/40 rounded-xl p-4 border border-border">
              <p><span className="text-muted-foreground">Phone:</span> <span className="font-medium text-foreground">{worker.phone ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Guardian:</span> <span className="font-medium text-foreground">{worker.guardianName ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Date of birth:</span> <span className="font-medium text-foreground">{worker.dateOfBirth ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Gender:</span> <span className="font-medium text-foreground">{worker.gender ?? '—'}</span></p>
              <p className="col-span-2"><span className="text-muted-foreground">Address:</span> <span className="font-medium text-foreground">{worker.addressLine ?? '—'}{worker.kycCity ? `, ${worker.kycCity}` : ''}{worker.kycState ? `, ${worker.kycState}` : ''} {worker.kycPincode ?? ''}</span></p>
              <p><span className="text-muted-foreground">Qualification:</span> <span className="font-medium text-foreground">{worker.qualification ?? '—'}</span></p>
              <p><span className="text-muted-foreground">Submitted:</span> <span className="font-medium text-foreground">{worker.kycSubmittedAt ? format(new Date(worker.kycSubmittedAt), 'dd MMM yyyy') : '—'}</span></p>
              {worker.previousExperience && (
                <p className="col-span-2 pt-1"><span className="text-muted-foreground">Experience:</span> <span className="font-medium text-foreground">{worker.previousExperience}</span></p>
              )}
            </div>

            <h3 className="text-sm font-semibold text-foreground mb-2 mt-5">Submitted KYC Documents</h3>
            {worker.documents.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">No documents uploaded yet.</p>
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
                      className="rounded-xl border border-border overflow-hidden bg-muted/20 flex flex-col justify-between"
                    >
                      <div className="relative aspect-video bg-muted/40 flex items-center justify-center overflow-hidden group">
                        {isImage ? (
                          <img
                            src={fullUrl}
                            alt={doc.type}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                          />
                        ) : (
                          <div className="text-center p-3">
                            <span className="text-xs font-semibold text-foreground">{doc.type.replaceAll('_', ' ')}</span>
                            <p className="text-[10px] text-muted-foreground mt-0.5">PDF / Document file</p>
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
                      <div className="px-3 py-2 flex items-center justify-between border-t border-border bg-card">
                        <span className="text-xs font-medium text-foreground truncate max-w-[130px]" title={doc.type.replaceAll('_', ' ')}>
                          {doc.type.replaceAll('_', ' ')}
                        </span>
                        <StatusBadge status={doc.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mt-5 space-y-1.5">
              <label className="text-xs font-medium text-foreground">Decision Note (visible to the worker if resubmission/rejection)</label>
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-border bg-background p-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                placeholder="e.g. Government ID image is blurry or expired, please upload a clear copy"
              />
            </div>

            {error && <p className="text-xs text-destructive mt-2">{error}</p>}

            <div className="flex items-center gap-2 mt-6 border-t border-border pt-4">
              <Button variant="secondary" disabled={!!submitting} onClick={() => decide('APPROVE')}>
                {submitting === 'APPROVE' ? 'Approving…' : 'Approve worker'}
              </Button>
              <Button variant="ghost" disabled={!!submitting} onClick={() => decide('REQUEST_RESUBMISSION')}>
                Request resubmission
              </Button>
              <Button variant="danger" disabled={!!submitting} onClick={() => decide('REJECT')}>
                Reject
              </Button>
              <Button variant="ghost" className="ml-auto text-xs" onClick={onClose}>
                Close
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
