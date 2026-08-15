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
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const OPERATIONS_NAV = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/workers', label: 'Worker verification', icon: UserCheck },
  { href: '/bookings', label: 'Bookings & logistics', icon: CalendarClock },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/complaints', label: 'Complaints & disputes', icon: MessageSquareWarning },
  { href: '/categories', label: 'Service categories', icon: Tags },
  { href: '/cities', label: 'Cities & zones', icon: MapPin },
];

const GOVERNANCE_NAV = [
  { href: '/payouts', label: 'Worker Payouts', icon: CreditCard },
  { href: '/admins', label: 'Staff Management', icon: ShieldCheck, superOnly: true },
  { href: '/audit-logs', label: 'Security & Audit', icon: FileSpreadsheet, superOnly: true },
  { href: '/settings', label: 'Platform Settings', icon: Settings, superOnly: true },
];

export function Sidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';

  return (
    <aside className="w-64 shrink-0 bg-primary min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
        <div className="relative h-9 w-9 shrink-0">
          <Image src="/icon-gold-transparent.png" alt="MaidKaro" fill sizes="36px" className="object-contain" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm tracking-wide">MAIDKARO</p>
          <p className="text-white/40 text-[11px]">Operations & Governance</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-5 overflow-y-auto">
        {/* Operations Section */}
        <div>
          <p className="px-3 text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5">
            Field Operations
          </p>
          <div className="flex flex-col gap-1">
            {OPERATIONS_NAV.map(({ href, label, icon: Icon }) => {
              const isActive = pathname === href || pathname?.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground font-medium shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <Icon size={17} strokeWidth={2} />
                  <span>{label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Governance & Platform Section */}
        <div>
          <div className="flex items-center justify-between px-3 mb-1.5">
            <p className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
              Governance &amp; Finance
            </p>
            {isSuperAdmin && (
              <span className="text-[9px] bg-amber-500/20 text-amber-300 font-semibold px-1.5 py-0.2 rounded border border-amber-500/30">
                Super Admin
              </span>
            )}
          </div>
          <div className="flex flex-col gap-1">
            {GOVERNANCE_NAV.map(({ href, label, icon: Icon, superOnly }) => {
              const isActive = pathname === href || pathname?.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  className={clsx(
                    'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                    isActive
                      ? 'bg-secondary text-secondary-foreground font-medium shadow-sm'
                      : 'text-white/70 hover:bg-white/10 hover:text-white',
                  )}
                >
                  <div className="flex items-center gap-3">
                    <Icon size={17} strokeWidth={2} />
                    <span>{label}</span>
                  </div>
                  {superOnly && !isSuperAdmin && (
                    <span className="text-[10px] bg-white/10 text-white/50 px-1.5 py-0.5 rounded">Lock</span>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* User profile & Sign out */}
      <div className="px-3 py-4 border-t border-white/10 bg-black/10">
        <div className="flex items-center gap-3 px-2 py-2 mb-2">
          <Avatar className="h-9 w-9 bg-white/10 text-white border border-white/20 shrink-0">
            <AvatarFallback className="bg-white/10 text-white text-xs font-bold">
              {admin?.fullName?.charAt(0) ?? 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0 flex-1">
            <p className="text-white text-sm font-semibold truncate leading-tight">{admin?.fullName}</p>
            <div className="flex items-center gap-1.5 mt-1">
              {isSuperAdmin ? (
                <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                  <Crown size={10} /> Super Admin
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] font-medium text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded border border-blue-500/30">
                  <ShieldCheck size={10} /> Ops Admin
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
