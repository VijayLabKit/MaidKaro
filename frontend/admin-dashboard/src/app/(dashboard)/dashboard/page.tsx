'use client';

import useSWR from 'swr';
import { api } from '@/lib/api';
import { Card, PageHeader, LoadingState } from '@/components/ui';

interface Overview {
  totalCustomers: number;
  totalWorkers: number;
  pendingWorkers: number;
  bookingsByStatus: Record<string, number>;
  grossRevenue: number;
}

const fetcher = (path: string) => api.get<Overview>(path);

export default function DashboardPage() {
  const { data, isLoading } = useSWR('/admin/analytics/overview', fetcher, { refreshInterval: 30_000 });

  return (
    <div>
      <PageHeader title="Overview" subtitle="Live snapshot across Siliguri operations." />

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4 mb-8">
            <StatCard label="Customers" value={data.totalCustomers} />
            <StatCard label="Verified workers" value={data.totalWorkers} />
            <StatCard label="Pending verification" value={data.pendingWorkers} highlight={data.pendingWorkers > 0} />
            <StatCard label="Gross revenue" value={`₹${data.grossRevenue.toLocaleString('en-IN')}`} />
          </div>

          <Card>
            <h2 className="text-sm font-semibold text-navy-900 mb-4">Bookings by status</h2>
            <div className="grid grid-cols-4 gap-4">
              {Object.entries(data.bookingsByStatus).length === 0 && (
                <p className="text-sm text-navy-700/50 col-span-4">No bookings yet.</p>
              )}
              {Object.entries(data.bookingsByStatus).map(([status, count]) => (
                <div key={status} className="rounded-lg border border-navy-900/10 px-4 py-3">
                  <p className="text-xs text-navy-700/50">{status.replaceAll('_', ' ')}</p>
                  <p className="text-lg font-semibold text-navy-900 mt-0.5">{count}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string | number; highlight?: boolean }) {
  return (
    <Card className={highlight ? 'border-secondary/40 bg-accent' : undefined}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold text-foreground mt-1">{value}</p>
    </Card>
  );
}
