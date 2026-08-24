"use client";

import { useState } from "react";
import useSWR from "swr";
import {
  getWorkerEarnings, listWorkerPayouts, requestWorkerPayout,
  WorkerEarningsSummary, WorkerPayout, ApiError,
} from "@/lib/worker-api";
import { useWorkerAuth } from "@/lib/worker-auth-context";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, Wallet } from "lucide-react";

const PAYOUT_VARIANT: Record<string, "default" | "secondary" | "gold" | "success" | "info" | "warning" | "destructive" | "outline"> = {
  REQUESTED: "gold", PROCESSING: "info", PROCESSED: "success", FAILED: "destructive",
};

export default function WorkerEarningsPage() {
  const { worker } = useWorkerAuth();
  
  const { data: earnings, mutate: mutateEarnings } = useSWR<WorkerEarningsSummary>(
    "/workers/me/earnings",
    () => getWorkerEarnings(),
    { refreshInterval: 20000, revalidateOnFocus: true }
  );

  const { data: payouts, mutate: mutatePayouts } = useSWR<WorkerPayout[]>(
    "/workers/me/payouts",
    () => listWorkerPayouts(),
    { refreshInterval: 20000, revalidateOnFocus: true }
  );

  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRequestPayout() {
    setRequesting(true);
    setError(null);
    try {
      await requestWorkerPayout();
      await Promise.all([mutateEarnings(), mutatePayouts()]);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't request a payout.");
    } finally {
      setRequesting(false);
    }
  }

  if (!earnings || !payouts) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  const canRequestPayout = worker?.verification_status === "APPROVED" && earnings.pending_payout > 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Earnings & Payouts</h1>
        <p className="text-sm text-muted-foreground mt-0.5">See exactly how your earnings are calculated and request payouts.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Gross (lifetime)</p>
          <p className="text-lg font-semibold text-foreground mt-1">₹{earnings.gross_lifetime.toLocaleString("en-IN")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Platform commission</p>
          <p className="text-lg font-semibold text-red-600 mt-1">−₹{earnings.commission_lifetime.toLocaleString("en-IN")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Net earnings</p>
          <p className="text-lg font-semibold text-emerald-600 mt-1">₹{earnings.net_lifetime.toLocaleString("en-IN")}</p>
        </CardContent></Card>
        <Card><CardContent className="p-5">
          <p className="text-xs text-muted-foreground">Available balance</p>
          <p className="text-lg font-semibold text-foreground mt-1">₹{earnings.pending_payout.toLocaleString("en-IN")}</p>
        </CardContent></Card>
      </div>

      <Card>
        <CardContent className="p-5 flex items-center justify-between flex-wrap gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">Request a payout</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {canRequestPayout
                ? `₹${earnings.pending_payout.toLocaleString("en-IN")} is available to withdraw.`
                : worker?.verification_status !== "APPROVED"
                ? "Complete your verification before requesting a payout."
                : "No available earnings to pay out right now."}
            </p>
          </div>
          <Button variant="gold" disabled={!canRequestPayout || requesting} onClick={handleRequestPayout}>
            {requesting && <Loader2 className="h-4 w-4 animate-spin" />}
            Request payout
          </Button>
        </CardContent>
      </Card>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Payout history</h2>
        {payouts.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No payout requests yet.</CardContent></Card>
        ) : (
          <div className="space-y-2">
            {payouts.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Wallet className="h-4 w-4 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">₹{p.amount.toLocaleString("en-IN")}</p>
                      <p className="text-xs text-muted-foreground">
                        Requested {new Date(p.requested_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                        {p.processed_at && ` · Processed ${new Date(p.processed_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}`}
                      </p>
                    </div>
                  </div>
                  <Badge variant={PAYOUT_VARIANT[p.status]}>{p.status}</Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Earnings by booking</h2>
        {earnings.entries.length === 0 ? (
          <Card><CardContent className="p-8 text-center text-muted-foreground text-sm">No completed bookings yet.</CardContent></Card>
        ) : (
          <Card>
            <CardContent className="p-0 divide-y divide-border">
              {earnings.entries.map((entry) => (
                <div key={entry.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-foreground">Booking #{entry.booking_id.slice(0, 8)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Gross ₹{entry.gross_amount} · Commission −₹{entry.commission_amount} ·{" "}
                      {new Date(entry.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground">₹{entry.net_amount}</p>
                    <Badge variant={entry.is_paid_out ? "success" : "gold"} className="text-[10px] mt-0.5">
                      {entry.is_paid_out ? "Paid" : "Pending"}
                    </Badge>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
