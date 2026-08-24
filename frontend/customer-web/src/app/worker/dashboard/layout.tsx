"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRequireWorkerAuth } from "@/lib/use-require-worker-auth";
import { useWorkerAuth } from "@/lib/worker-auth-context";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard, CalendarDays, Wallet, ShieldCheck, ListChecks, LogOut, Briefcase, Menu, ShieldAlert,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { WorkerNotificationBell } from "@/components/worker-notification-bell";

const NAV = [
  { href: "/worker/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/worker/dashboard/bookings", label: "Bookings", icon: ListChecks },
  { href: "/worker/dashboard/calendar", label: "Calendar", icon: CalendarDays },
  { href: "/worker/dashboard/earnings", label: "Earnings & Payouts", icon: Wallet },
  { href: "/worker/dashboard/support", label: "Support & Disputes", icon: ShieldAlert },
  { href: "/worker/dashboard/kyc", label: "Verification (KYC)", icon: ShieldCheck },
];

const VERIFICATION_BANNER: Record<string, { tone: string; text: string }> = {
  NOT_SUBMITTED: {
    tone: "bg-amber-500/10 border-amber-500/30 text-amber-900",
    text: "Your account is currently under verification. Please complete your profile and submit the required documents to start receiving bookings.",
  },
  PENDING_REVIEW: {
    tone: "bg-blue-500/10 border-blue-500/30 text-blue-900",
    text: "Your documents are currently being reviewed by the MaidKaro verification team. This usually takes 1–2 business days.",
  },
  NEEDS_RESUBMISSION: {
    tone: "bg-red-500/10 border-red-500/30 text-red-900",
    text: "Some of your documents need to be resubmitted. Please check the Verification tab for details.",
  },
  REJECTED: {
    tone: "bg-red-500/10 border-red-500/30 text-red-900",
    text: "Your verification was not approved. Please review the reason in the Verification tab and contact support if you believe this is an error.",
  },
};

export default function WorkerDashboardLayout({ children }: { children: React.ReactNode }) {
  const { worker, isLoading } = useRequireWorkerAuth();
  const { logout } = useWorkerAuth();
  const pathname = usePathname();
  const router = useRouter();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  if (isLoading || !worker) {
    return (
      <div className="p-8 max-w-md mx-auto space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const banner = worker.verification_status !== "APPROVED" ? VERIFICATION_BANNER[worker.verification_status] : null;

  function handleLogout() {
    logout();
    router.push("/worker/login");
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar (desktop) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-border bg-background">
        <div className="h-16 flex items-center justify-between px-5 border-b border-border">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <span className="font-semibold text-foreground">Worker Portal</span>
          </div>
          <WorkerNotificationBell />
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href} href={item.href}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  active ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="px-3 py-2 mb-1">
            <p className="text-sm font-medium text-foreground truncate">{worker.full_name}</p>
            <Badge variant={worker.verification_status === "APPROVED" ? "success" : "gold"} className="mt-1 text-[10px]">
              {worker.verification_status.replaceAll("_", " ")}
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 inset-x-0 z-40 h-14 border-b border-border bg-background flex items-center justify-between px-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-5 w-5 text-primary" />
          <span className="font-semibold text-sm">Worker Portal</span>
        </div>
        <button onClick={() => setMobileNavOpen((v) => !v)} aria-label="Menu">
          <Menu className="h-5 w-5" />
        </button>
      </div>
      {mobileNavOpen && (
        <div className="md:hidden fixed top-14 inset-x-0 z-30 bg-background border-b border-border p-3 space-y-1">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} onClick={() => setMobileNavOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent">
                <Icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2 text-muted-foreground" onClick={handleLogout}>
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      )}

      <main className="flex-1 min-w-0 pt-14 md:pt-0">
        {banner && (
          <div className={cn("border-b px-6 py-3 text-sm", banner.tone)}>
            {banner.text}
          </div>
        )}
        <div className="p-5 md:p-8 max-w-5xl mx-auto">{children}</div>
      </main>
    </div>
  );
}
