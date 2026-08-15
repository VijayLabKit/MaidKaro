"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/use-require-auth";
import { listBookings, ApiBooking } from "@/lib/api";
import { toBooking } from "@/lib/mappers";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, MapPin } from "lucide-react";

export default function BookingsPage() {
  const { user, isLoading } = useRequireAuth();
  const [apiBookings, setApiBookings] = useState<ApiBooking[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);

  useEffect(() => {
    if (!user) return;
    listBookings()
      .then(setApiBookings)
      .finally(() => setLoadingBookings(false));
  }, [user]);

  if (isLoading || !user || loadingBookings) {
    return (
      <div className="container py-14 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  const bookings = apiBookings.map(toBooking);

  return (
    <div className="container py-14">
      <h1 className="text-2xl font-semibold text-foreground mb-8">My bookings</h1>

      {bookings.length === 0 ? (
        <p className="text-muted-foreground">No bookings yet.</p>
      ) : (
        <div className="space-y-4">
          {bookings.map((b) => (
            <Link key={b.id} href={`/bookings/${b.id}`}>
              <Card className="hover:shadow-popover hover:-translate-y-0.5 transition-all duration-200">
                <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center gap-4">
                  <Avatar className="h-12 w-12 shrink-0">
                    <AvatarImage src={b.workerPhotoUrl} alt={b.workerName ?? ""} />
                    <AvatarFallback>{b.workerName?.charAt(0) ?? "?"}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-foreground">{b.categoryName}</p>
                      <BookingStatusBadge status={b.status} />
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {b.workerName ? `with ${b.workerName}` : "Awaiting worker assignment"}
                    </p>
                    <div className="flex flex-wrap gap-4 mt-2 text-xs text-muted-foreground">
                      {b.scheduledFor && (
                        <span className="flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" />
                          {new Date(b.scheduledFor).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      {b.address && (
                        <span className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {b.address.split(",")[0]}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-foreground">₹{b.priceQuoted}</p>
                    <p className="text-xs text-muted-foreground">{b.durationHours} hrs</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
