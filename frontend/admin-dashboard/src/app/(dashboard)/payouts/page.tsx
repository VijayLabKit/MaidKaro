'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHeader, Card, Button, LoadingState, EmptyState } from '@/components/ui';
import { hasPermission } from '@/lib/permissions';
import { CheckCircle2, Clock, Phone, Wallet, XCircle, Loader2, ShieldAlert } from 'lucide-react';

interface PayoutItem {
  id: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  amount: number;
  status: 'REQUESTED' | 'PROCESSING' | 'PROCESSED' | 'FAILED';
  requestedAt: string;
  processedAt?: string;
  razorpayPayoutId?: string;
}

const STATUS_STYLE: Record<PayoutItem['status'], string> = {
  REQUESTED: 'bg-amber-500/10 text-amber-700 border border-amber-500/30',
  PROCESSING: 'bg-blue-500/10 text-blue-700 border border-blue-500/20',
  PROCESSED: 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20',
  FAILED: 'bg-destructive/10 text-destructive border border-destructive/20',
};
const STATUS_LABEL: Record<PayoutItem['status'], string> = {
  REQUESTED: 'Pending',
  PROCESSING: 'Processing',
  PROCESSED: 'Paid',
  FAILED: 'Failed',
};

export default function PayoutsPage() {
  const { admin } = useAuth();
  const canManageFinance = hasPermission(admin?.staffRole, 'finance');

  const { data: payouts, isLoading, mutate } = useSWR<PayoutItem[]>(canManageFinance ? '/admin/payouts' : null, fetcher);
  const [actingId, setActingId] = useState<string | null>(null);

  const totalDisbursed = payouts?.filter((p) => p.status === 'PROCESSED').reduce((acc, p) => acc + p.amount, 0) ?? 0;
  const pendingAmount = payouts?.filter((p) => p.status === 'REQUESTED' || p.status === 'PROCESSING').reduce((acc, p) => acc + p.amount, 0) ?? 0;
  const pendingCount = payouts?.filter((p) => p.status === 'REQUESTED' || p.status === 'PROCESSING').length ?? 0;

  async function handlePayoutAction(payoutId: string, action: 'MARK_PROCESSING' | 'MARK_PAID' | 'MARK_FAILED') {
    setActingId(payoutId);
    try {
      const failure_reason = action === 'MARK_FAILED' ? window.prompt('Reason for failure (optional):') ?? undefined : undefined;
      await api.post(`/admin/payouts/${payoutId}/process`, { action, failure_reason });
      mutate();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not update this payout.');
    } finally {
      setActingId(null);
    }
  }

  if (!canManageFinance) {
    return (
      <div className="py-12">
        <PageHeader title="Worker Payouts & Financial Settlements" subtitle="Access is restricted to the Finance team." />
        <Card>
          <div className="flex items-center gap-4 py-6 text-center justify-center flex-col">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="font-semibold text-base text-foreground">Finance Permission Required</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Only accounts with <strong className="text-foreground">Finance</strong> or <strong className="text-foreground">Super Admin</strong> permissions can view and process worker payouts.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Worker Payouts & Financial Settlements"
        subtitle="Automated ledger accounting, commission retention, and digital bank/UPI transfers."
      />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-amber-500/10 text-amber-700 flex items-center justify-center shrink-0">
              <Clock size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Pending Approvals</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">₹{pendingAmount.toLocaleString('en-IN')}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{pendingCount} requests waiting</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-emerald-500/10 text-emerald-700 flex items-center justify-center shrink-0">
              <CheckCircle2 size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Disbursed</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">₹{totalDisbursed.toLocaleString('en-IN')}</p>
              <p className="text-xs text-emerald-600 font-medium mt-0.5">100% On-time digital transfers</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center gap-3.5">
            <div className="h-11 w-11 rounded-xl bg-blue-500/10 text-blue-700 flex items-center justify-center shrink-0">
              <Wallet size={22} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform Take-rate</p>
              <p className="text-2xl font-bold text-foreground mt-0.5">15%</p>
              <p className="text-xs text-muted-foreground mt-0.5">Retained automatically</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Payouts List */}
      <div>
        <h2 className="text-lg font-semibold text-foreground mb-3">Settlement History &amp; Batches</h2>

        {isLoading || !payouts ? (
          <LoadingState />
        ) : payouts.length === 0 ? (
          <EmptyState message="No payout batches on record." />
        ) : (
          <div className="grid gap-3">
            {payouts.map((p) => (
              <Card key={p.id}>
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2.5">
                      <p className="font-semibold text-base text-foreground">{p.workerName}</p>
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${STATUS_STYLE[p.status]}`}>
                        {STATUS_LABEL[p.status]}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Phone size={13} /> {p.workerPhone}
                      </span>
                      <span>Requested: {new Date(p.requestedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      {p.processedAt && (
                        <span>Processed: {new Date(p.processedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                      )}
                      {p.razorpayPayoutId && (
                        <span className="font-mono bg-muted px-2 py-0.5 rounded text-[11px] text-foreground">
                          Ref: {p.razorpayPayoutId}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0 pt-2 sm:pt-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-foreground">₹{p.amount.toLocaleString('en-IN')}</p>
                      <p className="text-[11px] text-muted-foreground">Net Payout</p>
                    </div>

                    {p.status === 'REQUESTED' && (
                      <div className="flex items-center gap-2">
                        <Button variant="gold" size="sm" disabled={actingId === p.id} onClick={() => handlePayoutAction(p.id, 'MARK_PROCESSING')}>
                          {actingId === p.id ? <Loader2 size={14} className="animate-spin" /> : 'Start processing'}
                        </Button>
                        <Button variant="danger" size="sm" disabled={actingId === p.id} onClick={() => handlePayoutAction(p.id, 'MARK_FAILED')}>
                          Mark failed
                        </Button>
                      </div>
                    )}
                    {p.status === 'PROCESSING' && (
                      <div className="flex items-center gap-2">
                        <Button variant="gold" size="sm" disabled={actingId === p.id} onClick={() => handlePayoutAction(p.id, 'MARK_PAID')}>
                          {actingId === p.id ? <Loader2 size={14} className="animate-spin" /> : 'Mark as paid'}
                        </Button>
                        <Button variant="danger" size="sm" disabled={actingId === p.id} onClick={() => handlePayoutAction(p.id, 'MARK_FAILED')}>
                          Mark failed
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
