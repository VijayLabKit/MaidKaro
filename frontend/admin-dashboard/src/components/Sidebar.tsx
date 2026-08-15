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
  LogOut,
} from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Overview', icon: LayoutDashboard },
  { href: '/workers', label: 'Worker verification', icon: UserCheck },
  { href: '/bookings', label: 'Bookings', icon: CalendarClock },
  { href: '/customers', label: 'Customers', icon: Users },
  { href: '/complaints', label: 'Complaints & disputes', icon: MessageSquareWarning },
  { href: '/categories', label: 'Service categories', icon: Tags },
  { href: '/cities', label: 'Cities & zones', icon: MapPin },
];

export function Sidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAuth();

  return (
    <aside className="w-64 shrink-0 bg-primary min-h-screen flex flex-col">
      <div className="flex items-center gap-3 px-6 py-6 border-b border-white/10">
        <div className="relative h-10 w-10 shrink-0">
          <Image src="/icon-gold.png" alt="MaidKaro" fill className="object-contain" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm tracking-wide">MAIDKARO</p>
          <p className="text-white/40 text-[11px]">Admin console</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname?.startsWith(`${href}/`);
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
                isActive
                  ? 'bg-secondary text-secondary-foreground font-medium shadow-sm'
                  : 'text-white/70 hover:bg-white/10 hover:text-white',
              )}
            >
              <Icon size={18} strokeWidth={2} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="px-3 py-4 border-t border-white/10">
        <div className="flex items-center gap-3 px-3 py-2 mb-2">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-white/10 text-white text-xs">
              {admin?.fullName?.charAt(0) ?? 'A'}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium truncate">{admin?.fullName}</p>
            <p className="text-white/40 text-xs truncate">{admin?.email}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-white/70 hover:bg-white/10 hover:text-white transition-colors"
        >
          <LogOut size={18} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
