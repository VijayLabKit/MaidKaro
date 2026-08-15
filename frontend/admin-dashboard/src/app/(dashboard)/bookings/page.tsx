'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Card, PageHeader, StatusBadge, LoadingState, EmptyState } from '@/components/ui';

interface Booking {
  id: string;
  status: string;
  type: 'INSTANT' | 'SCHEDULED';
  priceQuoted: string;
  durationHours: string;
  createdAt: string;
  scheduledFor: string | null;
  category: { name: string };
  customer: { fullName: string };
  worker: { fullName: string } | null;
}

interface Paged<T> { items: T[]; total: number }

const STATUS_FILTERS = ['ALL', 'PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'REJECTED', 'EXPIRED'];

const fetcher = (path: string) => api.get<Paged<Booking>>(path);

export default function BookingsPage() {
  const [status, setStatus] = useState('ALL');
  const query = status === 'ALL' ? '' : `?status=${status}`;
  const { data, isLoading } = useSWR(`/admin/bookings${query}`, fetcher);

  return (
    <div>
      <PageHeader title="Bookings" subtitle="All customer bookings across every worker and category." />

      <div className="flex gap-2 mb-5 flex-wrap">
        {STATUS_FILTERS.map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition ${
              status === s ? 'bg-navy-900 text-white border-navy-900' : 'border-navy-900/10 text-navy-700/60 hover:border-navy-900/30'
            }`}
          >
            {s.replaceAll('_', ' ')}
          </button>
        ))}
      </div>

      {isLoading || !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState message="No bookings match this filter." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-900/5 text-left text-xs text-navy-700/50">
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Worker</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Price</th>
                <th className="px-5 py-3 font-medium">Created</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((b) => (
                <tr key={b.id} className="border-b border-navy-900/5 last:border-0 hover:bg-navy-900/[0.02]">
                  <td className="px-5 py-3 text-navy-900">{b.category.name}</td>
                  <td className="px-5 py-3 text-navy-700/70">{b.customer.fullName}</td>
                  <td className="px-5 py-3 text-navy-700/70">{b.worker?.fullName ?? '—'}</td>
                  <td className="px-5 py-3 text-navy-700/70">{b.type}</td>
                  <td className="px-5 py-3 text-navy-900">₹{Number(b.priceQuoted).toFixed(0)}</td>
                  <td className="px-5 py-3 text-navy-700/50">{format(new Date(b.createdAt), 'dd MMM, h:mm a')}</td>
                  <td className="px-5 py-3">
                    <StatusBadge status={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
