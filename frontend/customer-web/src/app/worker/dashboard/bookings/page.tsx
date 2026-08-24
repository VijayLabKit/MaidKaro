"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import {
  listWorkerBookings, updateWorkerBookingStatus, ApiBookingFlat, ApiError,
} from "@/lib/worker-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, MapPin, Clock3, Loader2, ShieldAlert } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "gold" | "success" | "info" | "warning" | "destructive" | "outline"> = {
  PENDING: "gold", CONFIRMED: "info", IN_PROGRESS: "warning", COMPLETED: "success",
  CANCELLED: "secondary", REJECTED: "destructive", EXPIRED: "secondary",
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "PENDING", label: "New requests" },
  { key: "CONFIRMED", label: "Confirmed" },
  { key: "IN_PROGRESS", label: "In progress" },
  { key: "COMPLETED", label: "Completed" },
  { key: "CANCELLED,REJECTED", label: "Cancelled" },
];

export default function WorkerBookingsPage() {
  const [filter, setFilter] = useState("all");
  const statusParam = filter === "all" ? undefined : filter;
  
  const { data: bookings, error: swrError, mutate, isLoading } = useSWR<ApiBookingFlat[]>(
    `/bookings?worker_filter=${filter}`,
    () => listWorkerBookings(statusParam),
    { refreshInterval: 15000, revalidateOnFocus: true }
  );

  const [actingId, setActingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleAction(id: string, action: "ACCEPT" | "REJECT" | "START" | "COMPLETE") {
    setActingId(id);
    setError(null);
    try {
      await updateWorkerBookingStatus(id, action);
      await mutate();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't update this booking.");
    } finally {
      setActingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Bookings</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Accept new requests and manage jobs in progress.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filter === f.key ? "bg-primary text-primary-foreground border-primary" : "bg-background text-muted-foreground border-input hover:bg-accent"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {isLoading && !bookings ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}
        </div>
      ) : (!bookings || bookings.length === 0) ? (
        <Card><CardContent className="p-10 text-center text-muted-foreground">No bookings in this category.</CardContent></Card>
      ) : (
        <div className="space-y-3">
          {bookings.map((b) => {
            return (
              <Card key={b.id}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className="font-medium text-foreground">{b.category_name ?? "Service"}</span>
                        <Badge variant={STATUS_VARIANT[b.status] ?? "outline"}>{b.status.replaceAll("_", " ")}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {b.customer_first_name ? `Customer: ${b.customer_first_name}` : ""}
                      </p>
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground mt-2">
                        {b.scheduled_for && (
                          <span className="flex items-center gap-1"><CalendarClock className="h-3.5 w-3.5" />
                            {new Date(b.scheduled_for).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                          </span>
                        )}
                        <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {b.duration_hours}h</span>
                        {b.address_text && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" /> {b.address_text}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-semibold text-foreground">₹{b.price_quoted}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 mt-4 pt-2 border-t border-border/50">
                    <div className="flex gap-2">
                      {b.status === "PENDING" && (
                        <>
                          <Button size="sm" variant="gold" disabled={actingId === b.id} onClick={() => handleAction(b.id, "ACCEPT")}>
                            {actingId === b.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Accept
                          </Button>
                          <Button size="sm" variant="outline" disabled={actingId === b.id} onClick={() => handleAction(b.id, "REJECT")}>
                            Reject
                          </Button>
                        </>
                      )}
                      {b.status === "CONFIRMED" && (
                        <Button size="sm" variant="gold" disabled={actingId === b.id} onClick={() => handleAction(b.id, "START")}>
                          {actingId === b.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Mark as started
                        </Button>
                      )}
                      {b.status === "IN_PROGRESS" && (
                        <Button size="sm" variant="gold" disabled={actingId === b.id} onClick={() => handleAction(b.id, "COMPLETE")}>
                          {actingId === b.id && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Mark as completed
                        </Button>
                      )}
                    </div>

                    <Button variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-destructive gap-1" asChild>
                      <Link href="/worker/dashboard/support">
                        <ShieldAlert className="h-3.5 w-3.5" /> Report Issue
                      </Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
