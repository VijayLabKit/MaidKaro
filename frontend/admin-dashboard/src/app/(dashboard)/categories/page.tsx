'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@/lib/api';
import { Card, PageHeader, Button, LoadingState } from '@/components/ui';

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string;
  baseHourlyRate: string;
  commissionPct: string;
  isActive: boolean;
}

const fetcher = (path: string) => api.get<Category[]>(path);

export default function CategoriesPage() {
  const { data, isLoading, mutate } = useSWR('/catalog/categories?all=true', fetcher);
  const [showForm, setShowForm] = useState(false);

  return (
    <div>
      <PageHeader
        title="Service categories"
        subtitle="Pricing and commission for kitchen help, cleaning, babysitting, elder care, and nursing."
        action={
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Add category
          </Button>
        }
      />

      {isLoading || !data ? (
        <LoadingState />
      ) : (
        <div className="grid gap-3">
          {data.map((c) => (
            <CategoryRow key={c.id} category={c} onUpdated={mutate} />
          ))}
        </div>
      )}

      {showForm && (
        <NewCategoryModal onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); mutate(); }} />
      )}
    </div>
  );
}

function CategoryRow({ category, onUpdated }: { category: Category; onUpdated: () => void }) {
  const [commission, setCommission] = useState(category.commissionPct);
  const [saving, setSaving] = useState(false);

  async function saveCommission() {
    setSaving(true);
    try {
      await api.patch(`/admin/categories/${category.id}/commission`, { commissionPct: Number(commission) });
      onUpdated();
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive() {
    await api.patch(`/catalog/categories/${category.id}`, { isActive: !category.isActive });
    onUpdated();
  }

  return (
    <Card className="flex items-center justify-between">
      <div>
        <p className="font-medium text-navy-900">{category.name}</p>
        <p className="text-sm text-navy-700/50 mt-0.5">{category.description}</p>
        <p className="text-xs text-navy-700/40 mt-1">Base rate ₹{Number(category.baseHourlyRate).toFixed(0)}/hr</p>
      </div>
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-sm text-navy-700/70">
          Commission
          <input
            type="number"
            min={0}
            max={50}
            value={commission}
            onChange={(e) => setCommission(e.target.value)}
            className="w-16 rounded-lg border border-navy-900/10 px-2 py-1 text-sm outline-none focus:border-gold-500"
          />
          %
        </label>
        <Button variant="ghost" disabled={saving} onClick={saveCommission}>
          Save
        </Button>
        <Button variant={category.isActive ? 'danger' : 'secondary'} onClick={toggleActive}>
          {category.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    </Card>
  );
}

function NewCategoryModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [description, setDescription] = useState('');
  const [baseHourlyRate, setBaseHourlyRate] = useState('150');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/catalog/categories', {
        name,
        slug,
        description,
        baseHourlyRate: Number(baseHourlyRate),
      });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy-900/40 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl2 shadow-card max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy-900 mb-4">New service category</h2>

        <div className="flex flex-col gap-4">
          <Field label="Name" value={name} onChange={(v) => { setName(v); setSlug(v.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-')); }} placeholder="Deep Cleaning" />
          <Field label="Slug" value={slug} onChange={setSlug} placeholder="deep-cleaning" />
          <Field label="Description" value={description} onChange={setDescription} placeholder="One-time thorough home cleaning" textarea />
          <Field label="Base hourly rate (₹)" value={baseHourlyRate} onChange={setBaseHourlyRate} type="number" />
        </div>

        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}

        <div className="flex gap-3 mt-5">
          <Button variant="secondary" disabled={submitting} onClick={submit}>
            {submitting ? 'Creating…' : 'Create category'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  textarea,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  textarea?: boolean;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-navy-900">{label}</span>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={2}
          className="rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500"
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500"
        />
      )}
    </label>
  );
}
