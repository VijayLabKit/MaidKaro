'use client';

import { useState } from 'react';
import useSWR from 'swr';
import { api, fetcher, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHeader, Card, Button, StatusBadge, LoadingState, EmptyState } from '@/components/ui';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ShieldCheck, Crown, UserPlus, Phone, Mail, Lock, ShieldAlert, X } from 'lucide-react';
import { STAFF_ROLE_LABELS, StaffRole, hasPermission } from '@/lib/permissions';

interface StaffMember {
  id: string;
  userId: string;
  fullName: string;
  email: string;
  phone: string;
  role: 'ADMIN' | 'SUPER_ADMIN';
  staffRole: StaffRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export default function StaffManagementPage() {
  const { admin } = useAuth();
  const canManageStaff = hasPermission(admin?.staffRole, 'staff_management');

  const { data: staff, isLoading, mutate } = useSWR<StaffMember[]>('/admin/staff', fetcher);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'ADMIN' | 'SUPER_ADMIN'>('ADMIN');
  const [staffRole, setStaffRole] = useState<StaffRole>('OPERATIONS');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!canManageStaff) {
    return (
      <div className="py-12">
        <PageHeader title="Staff & Admin Management" subtitle="Access is restricted to Super Admins." />
        <Card>
          <div className="flex items-center gap-4 py-6 text-center justify-center flex-col">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="font-semibold text-base text-foreground">Super Admin Permission Required</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Only executive accounts with the <strong className="text-foreground">SUPER_ADMIN</strong> role can provision, invite, or deactivate administrative staff.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  async function handleCreateStaff(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!fullName || !email || !phone || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/admin/staff', {
        full_name: fullName,
        email,
        phone: phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`,
        password,
        role,
        staff_role: staffRole,
      });
      setShowInviteModal(false);
      setFullName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setStaffRole('OPERATIONS');
      mutate();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create staff account.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleStatus(staffId: string, currentStatus: boolean) {
    try {
      await api.patch(`/admin/staff/${staffId}/status`, { is_active: !currentStatus });
      mutate();
    } catch (err) {
      alert(err instanceof ApiError ? err.message : 'Could not update staff status.');
    }
  }

  return (
    <div>
      <PageHeader
        title="Staff & Ops Team Management"
        subtitle="Manage administrative accounts, provision operations staff, and control permissions."
        action={
          <Button variant="secondary" onClick={() => setShowInviteModal(true)}>
            <UserPlus size={16} className="mr-1.5" /> Provision New Admin
          </Button>
        }
      />

      {isLoading || !staff ? (
        <LoadingState />
      ) : staff.length === 0 ? (
        <EmptyState message="No staff accounts found." />
      ) : (
        <div className="grid gap-4">
          {staff.map((s) => (
            <Card key={s.id}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <p className="font-semibold text-base text-foreground">{s.fullName}</p>
                    {s.role === 'SUPER_ADMIN' ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                        <Crown size={12} /> Super Admin
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/30">
                        <ShieldCheck size={12} /> Operations Admin
                      </span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        s.isActive
                          ? 'bg-emerald-500/10 text-emerald-700 border border-emerald-500/20'
                          : 'bg-destructive/10 text-destructive border border-destructive/20'
                      }`}
                    >
                      {s.isActive ? 'Active' : 'Deactivated'}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-primary/10 text-primary border border-primary/20">
                      {STAFF_ROLE_LABELS[s.staffRole] ?? s.staffRole}
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Mail size={13} /> {s.email}
                    </span>
                    <span className="flex items-center gap-1">
                      <Phone size={13} /> {s.phone}
                    </span>
                    <span>Created: {new Date(s.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0 pt-2 sm:pt-0">
                  {s.email !== admin?.email && (
                    <Button
                      variant={s.isActive ? 'danger' : 'secondary'}
                      size="sm"
                      onClick={() => handleToggleStatus(s.id, s.isActive)}
                    >
                      {s.isActive ? 'Deactivate Account' : 'Reactivate Account'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Provision Admin Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-navy-900/50 flex items-center justify-center p-6 z-50" onClick={() => setShowInviteModal(false)}>
          <div className="bg-card border border-border rounded-xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Provision Admin / Staff Account</h2>
              <button onClick={() => setShowInviteModal(false)} className="text-muted-foreground hover:text-foreground">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateStaff} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="s-name">Full Name</Label>
                <Input
                  id="s-name"
                  placeholder="e.g. Priyanka Sen"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-email">Work Email</Label>
                <Input
                  id="s-email"
                  type="email"
                  placeholder="e.g. priyanka.ops@maidkaro.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-phone">Phone Number (10 Digits)</Label>
                <Input
                  id="s-phone"
                  placeholder="e.g. 9876543210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-password">Initial Temporary Password</Label>
                <Input
                  id="s-password"
                  type="password"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-role">Administrative Role</Label>
                <select
                  id="s-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'ADMIN' | 'SUPER_ADMIN')}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="ADMIN">Operations Admin (Field verification, complaints, logistics)</option>
                  <option value="SUPER_ADMIN">Super Admin (Full financial, legal &amp; governance control)</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="s-staffrole">Permission Group</Label>
                <select
                  id="s-staffrole"
                  value={staffRole}
                  onChange={(e) => setStaffRole(e.target.value as StaffRole)}
                  className="w-full h-10 px-3 rounded-lg border border-input bg-background text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
                >
                  {(Object.keys(STAFF_ROLE_LABELS) as StaffRole[]).map((r) => (
                    <option key={r} value={r}>{STAFF_ROLE_LABELS[r]}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Controls what this account can access — worker verification, customer support/complaints, finance/payouts, or full super admin.
                </p>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-end gap-3 pt-2">
                <Button type="button" variant="ghost" onClick={() => setShowInviteModal(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create Account'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
