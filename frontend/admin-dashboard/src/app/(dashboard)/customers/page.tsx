'use client';

import useSWR from 'swr';
import { format } from 'date-fns';
import { api } from '@/lib/api';
import { Card, PageHeader, LoadingState, EmptyState } from '@/components/ui';

interface Customer {
  id: string;
  fullName: string;
  email: string | null;
  createdAt: string;
}
interface Paged<T> { items: T[]; total: number }

const fetcher = (path: string) => api.get<Paged<Customer>>(path);

export default function CustomersPage() {
  const { data, isLoading } = useSWR('/admin/customers', fetcher);

  return (
    <div>
      <PageHeader title="Customers" subtitle={data ? `${data.total} registered households` : undefined} />

      {isLoading || !data ? (
        <LoadingState />
      ) : data.items.length === 0 ? (
        <EmptyState message="No customers yet." />
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-navy-900/5 text-left text-xs text-navy-700/50">
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Email</th>
                <th className="px-5 py-3 font-medium">Joined</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((c) => (
                <tr key={c.id} className="border-b border-navy-900/5 last:border-0 hover:bg-navy-900/[0.02]">
                  <td className="px-5 py-3 text-navy-900">{c.fullName}</td>
                  <td className="px-5 py-3 text-navy-700/70">{c.email ?? '—'}</td>
                  <td className="px-5 py-3 text-navy-700/50">{format(new Date(c.createdAt), 'dd MMM yyyy')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
}
