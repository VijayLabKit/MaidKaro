'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@/lib/api';
import { Card, PageHeader, StatusBadge, Button, LoadingState, EmptyState } from '@/components/ui';

interface Complaint {
  id: string;
  raisedBy: 'CUSTOMER' | 'WORKER';
  description: string;
  status: string;
  resolutionNote: string | null;
  refundIssued: string | null;
  createdAt: string;
  booking: {
    id: string;
    priceQuoted: string;
    category: { name: string };
    customer: { fullName: string };
    worker: { fullName: string } | null;
  };
}

const fetcher = (path: string) => api.get<Complaint[]>(path);

export default function ComplaintsPage() {
  const { data, isLoading, mutate } = useSWR('/admin/complaints', fetcher);
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader title="Complaints & disputes" subtitle="Raised by customers or workers against a booking." />

      {isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No complaints on file." />
      ) : (
        <div className="grid gap-3">
          {data.map((c) => (
            <Card key={c.id}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium text-navy-900">
                    {c.booking.category.name} · {c.booking.customer.fullName}
                    {c.booking.worker ? ` × ${c.booking.worker.fullName}` : ''}
                  </p>
                  <p className="text-xs text-navy-700/50 mt-0.5">
                    Raised by {c.raisedBy.toLowerCase()} · Booking value ₹{Number(c.booking.priceQuoted).toFixed(0)}
                  </p>
                </div>
                <StatusBadge status={c.status} />
              </div>
              <p className="text-sm text-navy-700/80 mt-3">{c.description}</p>
              {c.resolutionNote && (
                <p className="text-sm text-navy-700/50 mt-2 border-l-2 border-gold-500/40 pl-3">
                  Resolution: {c.resolutionNote}
                  {c.refundIssued ? ` · Refunded ₹${Number(c.refundIssued).toFixed(0)}` : ''}
                </p>
              )}
              {c.status !== 'RESOLVED' && c.status !== 'DISMISSED' && (
                <div className="mt-3">
                  <Button variant="secondary" onClick={() => setOpenId(c.id)}>
                    Resolve
                  </Button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {openId && (
        <ResolveModal complaintId={openId} onClose={() => setOpenId(null)} onResolved={() => { setOpenId(null); mutate(); }} />
      )}
    </div>
  );
}

function ResolveModal({ complaintId, onClose, onResolved }: { complaintId: string; onClose: () => void; onResolved: () => void }) {
  const [status, setStatus] = useState<'IN_REVIEW' | 'RESOLVED' | 'DISMISSED'>('RESOLVED');
  const [note, setNote] = useState('');
  const [refund, setRefund] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post(`/admin/complaints/${complaintId}/resolve`, {
        status,
        resolutionNote: note || undefined,
        refundAmount: refund ? Number(refund) : undefined,
      });
      onResolved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy-900/40 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl2 shadow-card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Resolve complaint</h2>

        <label className="flex flex-col gap-1.5 mb-4">
          <span className="text-sm font-medium text-navy-900">Outcome</span>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as never)}
            className="rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500"
          >
            <option value="IN_REVIEW">Keep in review</option>
            <option value="RESOLVED">Resolved</option>
            <option value="DISMISSED">Dismissed</option>
          </select>
        </label>

        <label className="flex flex-col gap-1.5 mb-4">
          <span className="text-sm font-medium text-navy-900">Resolution note</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            className="rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500"
          />
        </label>

        <label className="flex flex-col gap-1.5 mb-5">
          <span className="text-sm font-medium text-navy-900">Refund amount (₹, optional)</span>
          <input
            type="number"
            min={0}
            value={refund}
            onChange={(e) => setRefund(e.target.value)}
            className="rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500"
            placeholder="0"
          />
        </label>

        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

        <div className="flex gap-3">
          <Button variant="secondary" disabled={submitting} onClick={submit}>
            {submitting ? 'Saving…' : 'Save outcome'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
