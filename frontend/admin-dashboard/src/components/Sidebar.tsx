'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import {
  LayoutDashboard,
  Users,
  UserCheck,
  CalendarClock,
  MessageSquareWarning,
  Tags,
  MapPin,
  ShieldCheck,
  CreditCard,
  FileSpreadsheet,
  Settings,
  LogOut,
  Crown,
  Lock,
  Briefcase,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission, STAFF_ROLE_LABELS } from '@/lib/permissions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const OPERATIONS_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard, capability: null },
  { href: '/worker-directory', label: 'Worker Directory', icon: Briefcase, capability: null },
  { href: '/workers', label: 'Worker Verification', icon: UserCheck, capability: 'verification' as const },
  { href: '/bookings', label: 'Bookings & Dispatch', icon: CalendarClock, capability: null },
  { href: '/customers', label: 'Customer Directory', icon: Users, capability: null },
  { href: '/complaints', label: 'Complaints & Disputes', icon: MessageSquareWarning, capability: 'support' as const },
  { href: '/categories', label: 'Service Categories', icon: Tags, capability: 'operations' as const },
  { href: '/cities', label: 'Cities & Zones', icon: MapPin, capability: 'operations' as const },
];

const GOVERNANCE_NAV = [
  { href: '/payouts', label: 'Worker Payouts', icon: CreditCard, capability: 'finance' as const },
  { href: '/admins', label: 'Staff Management', icon: ShieldCheck, capability: 'staff_management' as const },
  { href: '/audit-logs', label: 'Security & Audit Logs', icon: FileSpreadsheet, capability: null },
  { href: '/settings', label: 'Platform Settings', icon: Settings, capability: null, superOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';

  return (
    <aside className="w-64 shrink-0 bg-primary min-h-screen flex flex-col border-r border-white/5 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="relative h-9 w-9 shrink-0">
          <Image src="/icon-gold-transparent.png" alt="MaidKaro" fill sizes="36px" className="object-contain" />
        </div>
        <div className="min-w-0">
          <p className="text-white font-bold text-sm tracking-wider leading-none">MAIDKARO</p>
          <p className="text-white/45 text-[11px] font-medium tracking-tight mt-1 truncate">Admin &amp; Ops Control</p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-6 overflow-y-auto">
        {/* Operations Section */}
        <div>
          <p className="px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-2">
            Field Operations
          </p>
          <div className="flex flex-col gap-0.5">
            {OPERATIONS_NAV.map(({ href, label, icon: Icon, capability }) => {
              const isActive = pathname === href || pathname?.startsWith(`${href}/`);
              const locked = capability ? !hasPermission(admin?.staffRole, capability) : false;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all',
                    isActive
                      ? 'bg-secondary text-secondary-foreground font-semibold shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={17} strokeWidth={2} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                  {locked && (
                    <span className="text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                      <Lock size={10} />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Governance & Platform Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-2">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Governance &amp; Finance
            </p>
            {isSuperAdmin && (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/15 px-2 py-0.5 rounded border border-amber-500/25">
                <Crown size={10} /> Super
              </span>
            )}
          </div>
          <div className="flex flex-col gap-0.5">
            {GOVERNANCE_NAV.map(({ href, label, icon: Icon, capability, superOnly }) => {
              const isActive = pathname === href || pathname?.startsWith(`${href}/`);
              const locked = superOnly ? !isSuperAdmin : capability ? !hasPermission(admin?.staffRole, capability) : false;
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-all',
                    isActive
                      ? 'bg-secondary text-secondary-foreground font-semibold shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon size={17} strokeWidth={2} className="shrink-0" />
                    <span className="truncate">{label}</span>
                  </div>
                  {locked && (
                    <span className="text-[10px] bg-white/10 text-white/40 px-1.5 py-0.5 rounded flex items-center gap-0.5 shrink-0">
                      <Lock size={10} />
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User profile & Sign out */}
      <div className="px-3 py-4 border-t border-white/10 bg-black/15">
        <div className="flex items-center gap-3 px-2 py-1.5 mb-2">
          <Avatar className="h-9 w-9 bg-white/10 text-white border border-white/20 shrink-0">
            <AvatarFallback className="bg-white/10 text-white text-xs font-bold">
              {admin?.fullName?.charAt(0) ?? 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate leading-tight">{admin?.fullName}</p>
            <div className="mt-1">
              {isSuperAdmin ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  <Crown size={10} /> Super Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                  <ShieldCheck size={10} /> {admin?.staffRole ? STAFF_ROLE_LABELS[admin.staffRole] : 'Operations Admin'}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-white/60 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={16} />
          <span>Sign out</span>
        </button>
      </div>
    </aside>
  );
}
