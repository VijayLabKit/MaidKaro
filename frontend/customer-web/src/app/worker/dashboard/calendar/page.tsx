"use client";

import { useMemo, useState } from "react";
import useSWR from "swr";
import { getWorkerCalendar, WorkerCalendarDay, ApiError } from "@/lib/worker-api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Clock3, MapPin, CalendarX } from "lucide-react";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "gold" | "success" | "info" | "warning" | "destructive" | "outline"> = {
  PENDING: "gold", CONFIRMED: "info", IN_PROGRESS: "warning", COMPLETED: "success",
  CANCELLED: "secondary", REJECTED: "destructive", EXPIRED: "secondary",
};

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10);
}

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export default function WorkerCalendarPage() {
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const rangeStart = useMemo(() => startOfMonth(monthAnchor), [monthAnchor]);
  const rangeEnd = useMemo(() => endOfMonth(monthAnchor), [monthAnchor]);
  const startStr = toISODate(rangeStart);
  const endStr = toISODate(rangeEnd);

  const { data: days, error: swrError } = useSWR<WorkerCalendarDay[]>(
    `/workers/me/calendar?from=${startStr}&to=${endStr}`,
    () => getWorkerCalendar(startStr, endStr),
    { refreshInterval: 30000, revalidateOnFocus: true }
  );

  const error = swrError instanceof ApiError ? swrError.message : null;

  const byDate = useMemo(() => {
    const map = new Map<string, WorkerCalendarDay>();
    (days ?? []).forEach((d: WorkerCalendarDay) => map.set(d.date, d));
    return map;
  }, [days]);

  const calendarCells = useMemo(() => {
    const firstWeekday = rangeStart.getDay();
    const totalDays = rangeEnd.getDate();
    const cells: (string | null)[] = Array.from({ length: firstWeekday }, () => null);
    for (let d = 1; d <= totalDays; d++) {
      cells.push(toISODate(new Date(rangeStart.getFullYear(), rangeStart.getMonth(), d)));
    }
    return cells;
  }, [rangeStart, rangeEnd]);

  const selectedDay = selectedDate ? byDate.get(selectedDate) : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Calendar</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Your bookings for the month, at a glance.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => { setSelectedDate(null); setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() - 1, 1)); }}
            className="h-8 w-8 rounded-lg border border-input flex items-center justify-center hover:bg-accent"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm font-medium w-32 text-center">
            {monthAnchor.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}
          </span>
          <button
            onClick={() => { setSelectedDate(null); setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 1)); }}
            className="h-8 w-8 rounded-lg border border-input flex items-center justify-center hover:bg-accent"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {days === null ? (
        <Skeleton className="h-96 w-full" />
      ) : (
        <div className="grid md:grid-cols-[1fr_320px] gap-6">
          <Card>
            <CardContent className="p-4">
              <div className="grid grid-cols-7 gap-1 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-1.5">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {calendarCells.map((dateStr, i) => {
                  if (!dateStr) return <div key={i} />;
                  const day = byDate.get(dateStr);
                  const isToday = dateStr === toISODate(new Date());
                  const isSelected = dateStr === selectedDate;
                  return (
                    <button
                      key={dateStr}
                      onClick={() => setSelectedDate(dateStr)}
                      className={`aspect-square rounded-lg border text-xs flex flex-col items-center justify-center gap-0.5 transition-colors ${
                        isSelected ? "border-primary bg-primary/10" : isToday ? "border-primary/50" : "border-transparent hover:bg-accent"
                      }`}
                    >
                      <span className={isToday ? "font-semibold text-primary" : "text-foreground"}>{Number(dateStr.slice(-2))}</span>
                      {day && day.bookings.length > 0 && (
                        <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                      )}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <h2 className="text-sm font-semibold text-foreground mb-3">
                {selectedDate
                  ? new Date(selectedDate).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })
                  : "Select a date"}
              </h2>
              {!selectedDate ? (
                <p className="text-sm text-muted-foreground">Tap a date on the calendar to see bookings for that day.</p>
              ) : !selectedDay || selectedDay.bookings.length === 0 ? (
                <div className="text-center text-muted-foreground py-6">
                  <CalendarX className="h-6 w-6 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No bookings on this day.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedDay.bookings.map((b) => (
                    <div key={b.id} className="border-b border-border pb-3 last:border-0 last:pb-0">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-sm font-medium text-foreground">{b.category_name ?? "Service"}</span>
                        <Badge variant={STATUS_VARIANT[b.status] ?? "outline"} className="text-[10px]">{b.status.replaceAll("_", " ")}</Badge>
                      </div>
                      {b.customer_first_name && <p className="text-xs text-muted-foreground">Customer: {b.customer_first_name}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground mt-1">
                        {b.scheduled_for && <span>{new Date(b.scheduled_for).toLocaleTimeString("en-IN", { timeStyle: "short" })}</span>}
                        <span className="flex items-center gap-1"><Clock3 className="h-3 w-3" /> {b.duration_hours}h</span>
                      </div>
                      {b.service_address_text && (
                        <p className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                          <MapPin className="h-3 w-3" /> {b.service_address_text}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
