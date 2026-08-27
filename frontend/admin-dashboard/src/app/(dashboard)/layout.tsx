'use client';

import { ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Menu } from 'lucide-react';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { Sidebar } from '@/components/Sidebar';

function Guarded({ children }: { children: ReactNode }) {
  const { admin, isLoading } = useAuth();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!isLoading && !admin) router.replace('/login');
  }, [isLoading, admin, router]);

  if (isLoading || !admin) {
    return <div className="min-h-screen flex items-center justify-center text-navy-700/50 text-sm">Loading…</div>;
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* Mobile Top App Bar */}
      <div className="lg:hidden fixed top-0 inset-x-0 z-30 h-14 bg-primary text-white flex items-center justify-between px-4 border-b border-white/10 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="relative h-7 w-7 shrink-0">
            <Image src="/icon-gold-transparent.png" alt="MaidKaro" fill sizes="28px" className="object-contain" />
          </div>
          <span className="font-bold text-xs tracking-wider">MAIDKARO OPS</span>
        </div>
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10"
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>

      {/* Sidebar with mobile drawer support */}
      <Sidebar mobileOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />

      {/* Main Content Area with responsive padding */}
      <main className="flex-1 min-w-0 pt-16 lg:pt-0 px-4 py-5 sm:px-6 sm:py-6 lg:px-10 lg:py-8 max-w-6xl">
        {children}
      </main>
    </div>
  );
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <Guarded>{children}</Guarded>
    </AuthProvider>
  );
}
