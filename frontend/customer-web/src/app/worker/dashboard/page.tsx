"use client";

import { useState } from "react";
import useSWR from "swr";
import { getWorkerDashboard, setAvailableNow, WorkerDashboardOverview, ApiError } from "@/lib/worker-api";
import { useWorkerAuth } from "@/lib/worker-auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Star, Briefcase, Wallet, IndianRupee, Clock, XCircle } from "lucide-react";

function StatCard({ icon: Icon, label, value, tone }: { icon: any; label: string; value: string; tone?: string }) {
  return (
    <Card>
      <CardContent className="p-5 flex items-center gap-4">
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tone || "bg-primary/10 text-primary"}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-lg font-semibold text-foreground truncate">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function WorkerDashboardPage() {
  const { worker, refreshWorker } = useWorkerAuth();
  const { data: overview, mutate } = useSWR<WorkerDashboardOverview>(
    "/workers/me/dashboard",
    () => getWorkerDashboard(),
    { refreshInterval: 15000, revalidateOnFocus: true }
  );
  const [togglingAvailability, setTogglingAvailability] = useState(false);
  const [availError, setAvailError] = useState<string | null>(null);

  async function handleToggleAvailability(checked: boolean) {
    setAvailError(null);
    setTogglingAvailability(true);
    try {
      await setAvailableNow(checked);
      await refreshWorker();
    } catch (e) {
      setAvailError(e instanceof ApiError ? e.message : "Couldn't update availability.");
    } finally {
      setTogglingAvailability(false);
    }
  }

  if (!overview) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Welcome back, {overview.full_name.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Here's how your work is going.</p>
        </div>
        {worker?.verification_status === "APPROVED" && (
          <Card className="px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-foreground">Available for new jobs</span>
              <Switch checked={worker.is_available_now} disabled={togglingAvailability} onCheckedChange={handleToggleAvailability} />
            </div>
            {availError && <p className="text-xs text-destructive mt-1">{availError}</p>}
          </Card>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={Star} label="Rating" value={overview.rating_count > 0 ? `${overview.rating_avg.toFixed(1)} (${overview.rating_count})` : "No ratings yet"} tone="bg-amber-500/10 text-amber-600" />
        <StatCard icon={Briefcase} label="Completed jobs" value={String(overview.completed_jobs)} />
        <StatCard icon={Clock} label="Upcoming bookings" value={String(overview.upcoming_bookings)} tone="bg-blue-500/10 text-blue-600" />
        <StatCard icon={XCircle} label="Cancelled / rejected" value={String(overview.cancelled_or_rejected)} tone="bg-red-500/10 text-red-600" />
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Earnings</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard icon={IndianRupee} label="Lifetime earnings" value={`₹${overview.total_lifetime_earnings.toLocaleString("en-IN")}`} tone="bg-emerald-500/10 text-emerald-600" />
          <StatCard icon={Wallet} label="Available balance" value={`₹${overview.available_balance.toLocaleString("en-IN")}`} tone="bg-emerald-500/10 text-emerald-600" />
          <StatCard icon={Clock} label="Pending payout" value={`₹${overview.pending_earnings.toLocaleString("en-IN")}`} tone="bg-amber-500/10 text-amber-600" />
          <StatCard icon={IndianRupee} label="Paid out" value={`₹${overview.paid_out_total.toLocaleString("en-IN")}`} />
        </div>
      </div>
    </div>
  );
}
