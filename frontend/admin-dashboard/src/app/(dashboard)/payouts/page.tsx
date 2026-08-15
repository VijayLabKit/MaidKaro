'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHeader, Card, Button, StatusBadge, LoadingState, EmptyState } from '@/components/ui';
import { CreditCard, CheckCircle2, AlertCircle, Clock, ArrowUpRight, Phone, Wallet } from 'lucide-react';

interface PayoutItem {
  id: string;
  workerId: string;
  workerName: string;
  workerPhone: string;
  amount: number;
  status: 'REQUESTED' | 'PROCESSED' | 'FAILED';
  requestedAt: string;
  processedAt?: string;
  razorpayPayoutId?: string;
}

export default function PayoutsPage() {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';

  const { data: payouts, isLoading, mutate } = useSWR<PayoutItem[]>('/admin/payouts', fetcher);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const totalDisbursed = payouts?.filter((p) => p.status === 'PROCESSED').reduce((acc, p) => acc + p.amount, 0) ?? 0;
  const pendingAmount = payouts?.filter((p) => p.status === 'REQUESTED').reduce((acc, p) => acc + p.amount, 0) ?? 0;
  const pendingCount = payouts?.filter((p) => p.status === 'REQUESTED').length ?? 0;

  async function handleProcessPayout(payoutId: string) {
    setProcessingId(payoutId);
    try {
      await api.post(`/admin/payouts/${payoutId}/process`, {});
      mutate();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not process payout.');
    } finally {
      setProcessingId(null);
    }
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
                      <span
                        className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                          p.status === 'PROCESSED'
                            ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                            : p.status === 'REQUESTED'
                            ? 'bg-amber-500/10 text-amber-700 border border-amber-500/30'
                            : 'bg-destructive/10 text-destructive border border-destructive/20'
                        }`}
                      >
                        {p.status === 'PROCESSED' ? 'Processed' : p.status === 'REQUESTED' ? 'Pending Approval' : 'Failed'}
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
                      <Button
                        variant="gold"
                        size="sm"
                        disabled={processingId === p.id}
                        onClick={() => handleProcessPayout(p.id)}
                      >
                        {processingId === p.id ? 'Processing...' : 'Approve & Settle'}
                      </Button>
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
