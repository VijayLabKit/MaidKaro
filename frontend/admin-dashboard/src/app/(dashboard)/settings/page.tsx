'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { api, fetcher, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHeader, Card, Button, LoadingState } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Settings, ShieldAlert, CheckCircle2, PhoneCall, Percent, Flame, MessageSquare } from 'lucide-react';

interface PlatformSettings {
  defaultCommissionPct: number;
  surgeMultiplier: number;
  otpExpirySeconds: number;
  sosEmergencyPhone: string;
  smsProvider: string;
  environment: string;
}

export default function PlatformSettingsPage() {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';

  const { data: config, isLoading, mutate } = useSWR<PlatformSettings>('/admin/settings', fetcher);

  const [commission, setCommission] = useState<string>('15');
  const [surge, setSurge] = useState<string>('1.0');
  const [sosPhone, setSosPhone] = useState<string>('+911800123456');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (config) {
      setCommission(String(config.defaultCommissionPct));
      setSurge(String(config.surgeMultiplier));
      setSosPhone(config.sosEmergencyPhone);
    }
  }, [config]);

  if (!isSuperAdmin) {
    return (
      <div className="py-12">
        <PageHeader title="Platform Global Settings" subtitle="Access is restricted to Super Admins." />
        <Card>
          <div className="flex items-center gap-4 py-6 text-center justify-center flex-col">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="font-semibold text-base text-foreground">Super Admin Permission Required</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Only executive accounts with the <strong className="text-foreground">SUPER_ADMIN</strong> role can modify global commission rates, surge algorithms, and emergency safety hotlines.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.patch('/admin/settings', {
        default_commission_pct: Number(commission),
        surge_multiplier: Number(surge),
        sos_emergency_phone: sosPhone,
      });
      setSuccess(true);
      mutate();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not update settings.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader
        title="Platform Global Settings"
        subtitle="Configure system take-rates, dynamic surge thresholds, and emergency response parameters."
      />

      {isLoading || !config ? (
        <LoadingState />
      ) : (
        <form onSubmit={handleSave} className="space-y-5">
          <Card>
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="h-9 w-9 rounded-lg bg-amber-500/10 text-amber-700 flex items-center justify-center">
                  <Percent size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Monetization &amp; Commission</h3>
                  <p className="text-xs text-muted-foreground">Default marketplace take-rate deducted from bookings before worker payout.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="comm">Default Platform Commission (%)</Label>
                  <Input
                    id="comm"
                    type="number"
                    min={0}
                    max={50}
                    step={0.5}
                    value={commission}
                    onChange={(e) => setCommission(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Applies to all categories unless overridden individually.</p>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="surge">Peak Hours Surge Multiplier</Label>
                  <Input
                    id="surge"
                    type="number"
                    min={1.0}
                    max={3.0}
                    step={0.1}
                    value={surge}
                    onChange={(e) => setSurge(e.target.value)}
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Multiplier applied to instant requests during peak household hours.</p>
                </div>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-5">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="h-9 w-9 rounded-lg bg-destructive/10 text-destructive flex items-center justify-center">
                  <PhoneCall size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">Trust &amp; Safety / SOS Hotline</h3>
                  <p className="text-xs text-muted-foreground">24x7 emergency escalation number dialed when worker or customer triggers in-app SOS.</p>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="sos">Emergency Response Helpline</Label>
                <Input
                  id="sos"
                  value={sosPhone}
                  onChange={(e) => setSosPhone(e.target.value)}
                  placeholder="+911800123456"
                  required
                />
                <p className="text-[11px] text-muted-foreground">Routed immediately through MaidKaro's rapid trust &amp; safety operations desk.</p>
              </div>
            </div>
          </Card>

          <Card>
            <div className="space-y-4">
              <div className="flex items-center gap-3 border-b border-border pb-3">
                <div className="h-9 w-9 rounded-lg bg-blue-500/10 text-blue-700 flex items-center justify-center">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h3 className="font-semibold text-foreground">System Engine Environment</h3>
                  <p className="text-xs text-muted-foreground">Core infrastructural telemetry and SMS gateway status.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-muted-foreground">SMS Provider:</span>
                  <p className="font-mono font-semibold text-foreground mt-0.5">{config.smsProvider}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50 border border-border">
                  <span className="text-muted-foreground">OTP Validity Window:</span>
                  <p className="font-mono font-semibold text-foreground mt-0.5">{config.otpExpirySeconds / 60} minutes ({config.otpExpirySeconds}s)</p>
                </div>
              </div>
            </div>
          </Card>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {success && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 text-sm flex items-center gap-2">
              <CheckCircle2 size={16} /> Platform configuration saved and active across all instances.
            </div>
          )}

          <Button type="submit" variant="gold" disabled={saving}>
            {saving ? 'Saving...' : 'Save Global Settings'}
          </Button>
        </form>
      )}
    </div>
  );
}
