'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, ApiError } from '@/lib/api';
import { Card, PageHeader, Button, LoadingState } from '@/components/ui';

interface City {
  id: string;
  name: string;
  state: string;
  isActive: boolean;
}

interface Zone {
  id: string;
  name: string;
  pincodes: { id: string; code: string }[];
}

const fetcher = <T,>(path: string) => api.get<T>(path);

export default function CitiesPage() {
  const { data: cities, isLoading, mutate } = useSWR<City[]>('/catalog/cities?all=true', fetcher);
  const [showForm, setShowForm] = useState(false);
  const [expandedCityId, setExpandedCityId] = useState<string | null>(null);

  return (
    <div>
      <PageHeader
        title="Cities & service zones"
        subtitle="Launching a new city is a data operation here — no app release needed."
        action={
          <Button variant="secondary" onClick={() => setShowForm(true)}>
            Add city
          </Button>
        }
      />

      {isLoading || !cities ? (
        <LoadingState />
      ) : (
        <div className="grid gap-4">
          {cities.map((city) => (
            <Card key={city.id}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-base text-foreground">
                      {city.name}, {city.state}
                    </p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        city.isActive
                          ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                          : 'bg-muted text-muted-foreground border border-border'
                      }`}
                    >
                      {city.isActive ? 'Live' : 'Not yet live'}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Zone-level availability and pricing control active
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0 pt-2 sm:pt-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setExpandedCityId(expandedCityId === city.id ? null : city.id)}
                  >
                    {expandedCityId === city.id ? 'Hide zones' : 'Manage zones'}
                  </Button>
                  <Button
                    variant={city.isActive ? 'danger' : 'secondary'}
                    size="sm"
                    onClick={async () => {
                      await api.patch(`/catalog/cities/${city.id}/active`, { isActive: !city.isActive });
                      mutate();
                    }}
                  >
                    {city.isActive ? 'Pause city' : 'Launch city'}
                  </Button>
                </div>
              </div>
              {expandedCityId === city.id && <ZonesPanel cityId={city.id} />}
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <NewCityModal onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); mutate(); }} />
      )}
    </div>
  );
}

function ZonesPanel({ cityId }: { cityId: string }) {
  const { data: zones, isLoading, mutate } = useSWR<Zone[]>(`/catalog/cities/${cityId}/zones`, fetcher);
  const [zoneName, setZoneName] = useState('');
  const [pincodeByZone, setPincodeByZone] = useState<Record<string, string>>({});

  async function addZone() {
    if (!zoneName.trim()) return;
    await api.post('/catalog/zones', { cityId, name: zoneName.trim() });
    setZoneName('');
    mutate();
  }

  async function addPincode(zoneId: string) {
    const code = pincodeByZone[zoneId];
    if (!code || !/^\d{6}$/.test(code)) return;
    await api.post('/catalog/pincodes', { code, serviceZoneId: zoneId });
    setPincodeByZone((prev) => ({ ...prev, [zoneId]: '' }));
    mutate();
  }

  return (
    <div className="mt-4 pt-4 border-t border-navy-900/5">
      {isLoading || !zones ? (
        <LoadingState />
      ) : (
        <div className="grid gap-3">
          {zones.map((zone) => (
            <div key={zone.id} className="rounded-lg bg-navy-900/[0.02] px-4 py-3">
              <p className="text-sm font-medium text-navy-900">{zone.name}</p>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {zone.pincodes.map((p) => (
                  <span key={p.id} className="text-xs bg-white border border-navy-900/10 rounded-full px-2 py-0.5 text-navy-700/70">
                    {p.code}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <input
                  value={pincodeByZone[zone.id] ?? ''}
                  onChange={(e) => setPincodeByZone((prev) => ({ ...prev, [zone.id]: e.target.value }))}
                  placeholder="6-digit PIN"
                  className="text-xs rounded-lg border border-navy-900/10 px-2 py-1 outline-none focus:border-gold-500 w-32"
                />
                <Button variant="ghost" onClick={() => addPincode(zone.id)} className="text-xs py-1">
                  Add PIN
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2 mt-4">
        <input
          value={zoneName}
          onChange={(e) => setZoneName(e.target.value)}
          placeholder="New zone name, e.g. Siliguri - Bagdogra"
          className="text-sm rounded-lg border border-navy-900/10 px-3 py-2 outline-none focus:border-gold-500 flex-1"
        />
        <Button variant="secondary" onClick={addZone}>
          Add zone
        </Button>
      </div>
    </div>
  );
}

function NewCityModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [name, setName] = useState('');
  const [state, setState] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await api.post('/catalog/cities', { name, state });
      onCreated();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-navy-900/40 flex items-center justify-center p-6 z-50" onClick={onClose}>
      <div className="bg-white rounded-xl2 shadow-card max-w-sm w-full p-6" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-navy-900 mb-4">Add a city</h2>
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-navy-900">City name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} className="rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500" placeholder="Darjeeling" />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-navy-900">State</span>
            <input value={state} onChange={(e) => setState(e.target.value)} className="rounded-lg border border-navy-900/10 px-3 py-2 text-sm outline-none focus:border-gold-500" placeholder="West Bengal" />
          </label>
        </div>
        {error && <p className="text-sm text-red-600 mt-3">{error}</p>}
        <div className="flex gap-3 mt-5">
          <Button variant="secondary" disabled={submitting} onClick={submit}>
            {submitting ? 'Adding…' : 'Add city'}
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
