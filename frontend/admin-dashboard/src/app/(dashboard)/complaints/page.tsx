'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { Card, PageHeader, StatusBadge, Button, LoadingState, EmptyState } from '@/components/ui';
import { ShieldAlert, MessageSquare, Send } from 'lucide-react';

interface ComplaintMessage {
  id: string;
  senderUserId: string;
  senderRole: 'CUSTOMER' | 'WORKER' | 'STAFF';
  body: string;
  createdAt: string;
}

interface Complaint {
  id: string;
  type: 'COMPLAINT' | 'DISPUTE';
  raisedBy: 'CUSTOMER' | 'WORKER';
  description: string;
  status: string;
  resolutionNote: string | null;
  refundIssued: string | null;
  assignedStaffId: string | null;
  createdAt: string;
  booking: {
    id: string;
    priceQuoted: string;
    category: { name: string };
    customer: { fullName: string };
    worker: { fullName: string } | null;
  };
  messages: ComplaintMessage[];
}

const fetcher = (path: string) => api.get<Complaint[]>(path);

export default function ComplaintsPage() {
  const { admin } = useAuth();
  const canManageSupport = hasPermission(admin?.staffRole, 'support');

  const { data, isLoading, mutate } = useSWR(canManageSupport ? '/admin/complaints' : null, fetcher);
  const [openId, setOpenId] = useState<string | null>(null);
  const [threadId, setThreadId] = useState<string | null>(null);

  if (!canManageSupport) {
    return (
      <div className="py-12">
        <PageHeader title="Complaints & disputes" subtitle="Access is restricted to the Support team." />
        <Card>
          <div className="flex items-center gap-4 py-6 text-center justify-center flex-col">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="font-semibold text-base text-foreground">Support Permission Required</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Only accounts with <strong className="text-foreground">Customer Support</strong>, <strong className="text-foreground">Operations</strong>, or <strong className="text-foreground">Super Admin</strong> permissions can view and manage complaints and disputes.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Complaints & disputes" subtitle="Raised by customers or workers against a booking." />

      {isLoading || !data ? (
        <LoadingState />
      ) : data.length === 0 ? (
        <EmptyState message="No complaints on file." />
      ) : (
        <div className="grid gap-4">
          {data.map((c) => (
            <Card key={c.id}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                      c.type === 'DISPUTE' ? 'bg-purple-500/10 text-purple-700 border-purple-500/30' : 'bg-muted text-muted-foreground border-border'
                    }`}>
                      {c.type === 'DISPUTE' ? 'Billing dispute' : 'Complaint'}
                    </span>
                    <p className="font-semibold text-base text-foreground">
                      {c.booking.category.name} <span className="font-normal text-muted-foreground">·</span> {c.booking.customer.fullName}
                      {c.booking.worker ? <span className="text-primary font-medium"> × {c.booking.worker.fullName}</span> : ''}
                    </p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Raised by <strong className="font-medium text-foreground capitalize">{c.raisedBy.toLowerCase()}</strong> · Booking value <span className="font-medium text-foreground">₹{Number(c.booking.priceQuoted).toFixed(0)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={c.status} />
                  <Button variant="ghost" size="sm" onClick={() => setThreadId(c.id)}>
                    <MessageSquare size={14} className="mr-1" /> {c.messages.length > 0 ? `${c.messages.length} messages` : 'Thread'}
                  </Button>
                  {c.status !== 'RESOLVED' && c.status !== 'DISMISSED' && c.status !== 'CLOSED' && (
                    <Button variant="secondary" size="sm" onClick={() => setOpenId(c.id)}>
                      Resolve
                    </Button>
                  )}
                </div>
              </div>

              <div className="mt-3.5 p-3.5 rounded-lg bg-muted/40 border border-border/60 text-sm text-foreground/90">
                <p className="font-medium text-xs text-muted-foreground uppercase tracking-wider mb-1">Details</p>
                <p>{c.description}</p>
              </div>

              {c.resolutionNote && (
                <div className="mt-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-950 text-sm">
                  <p className="font-medium text-xs text-emerald-800 uppercase tracking-wider mb-0.5">Resolution Note</p>
                  <p>
                    {c.resolutionNote}
                    {c.refundIssued ? <strong className="ml-2">· Refunded ₹{Number(c.refundIssued).toFixed(0)}</strong> : ''}
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {openId && (
        <ResolveModal complaintId={openId} onClose={() => setOpenId(null)} onResolved={() => { setOpenId(null); mutate(); }} />
      )}
      {threadId && (
        <ThreadModal
          complaint={data?.find((c) => c.id === threadId) ?? null}
          onClose={() => setThreadId(null)}
          onSent={() => mutate()}
        />
      )}
    </div>
  );
}

function ResolveModal({ complaintId, onClose, onResolved }: { complaintId: string; onClose: () => void; onResolved: () => void }) {
  const [status, setStatus] = useState<'IN_REVIEW' | 'AWAITING_INFO' | 'RESOLVED' | 'CLOSED' | 'DISMISSED'>('RESOLVED');
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
            <option value="AWAITING_INFO">Awaiting more information</option>
            <option value="RESOLVED">Resolved</option>
            <option value="CLOSED">Closed</option>
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

function ThreadModal({ complaint, onClose, onSent }: { complaint: Complaint | null; onClose: () => void; onSent: () => void }) {
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    if (!complaint || body.trim().length < 1) return;
    setSending(true);
    setError(null);
    try {
      await api.post(`/admin/complaints/${complaint.id}/messages`, { body });
      setBody('');
      onSent();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  }

  if (!complaint) return null;

  return (
    <div className="fixed inset-0 bg-navy-900/40 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl2 shadow-card max-w-lg w-full p-6 max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Conversation</h2>

        <div className="flex-1 overflow-y-auto space-y-3 mb-4 min-h-[120px]">
          {complaint.messages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No messages yet.</p>
          ) : (
            complaint.messages.map((m) => (
              <div key={m.id} className={`flex ${m.senderRole === 'STAFF' ? '' : 'justify-end'}`}>
                <div className={`rounded-lg px-3.5 py-2.5 text-sm max-w-[80%] ${m.senderRole === 'STAFF' ? 'bg-muted' : 'bg-primary/10'}`}>
                  <p className="text-foreground">{m.body}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {m.senderRole === 'STAFF' ? 'Support' : m.senderRole === 'CUSTOMER' ? 'Customer' : 'Worker'} ·{' '}
                    {new Date(m.createdAt).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </p>
                </div>
              </div>
            ))
          )}
        </div>

        {error && <p className="text-sm text-red-600 mb-2">{error}</p>}

        <div className="flex gap-2">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={2}
            placeholder="Reply to the customer/worker…"
            className="flex-1 rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500 resize-none"
          />
          <Button variant="secondary" disabled={sending || body.trim().length < 1} onClick={send}>
            <Send size={14} />
          </Button>
        </div>
        <Button variant="ghost" onClick={onClose} className="mt-3 self-start">Close</Button>
      </div>
    </div>
  );
}
