"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { Bell, Check, ExternalLink } from "lucide-react";
import {
  listWorkerNotifications,
  getWorkerUnreadNotificationCount,
  markWorkerNotificationRead,
  markAllWorkerNotificationsRead,
  WorkerNotification,
} from "@/lib/worker-api";
import { cn } from "@/lib/utils";

export function WorkerNotificationBell({ className }: { className?: string }) {
  const [unreadCount, setUnreadCount] = useState(0);
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchUnread = async () => {
    try {
      const res = await getWorkerUnreadNotificationCount();
      setUnreadCount(res.unread_count);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchUnread();
    const interval = setInterval(fetchUnread, 15000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleOpen = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      setLoading(true);
      try {
        const data = await listWorkerNotifications(1, 10);
        setNotifications(data.items);
        setUnreadCount(data.unread_count);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarkRead = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await markWorkerNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read_at: new Date().toISOString() } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await markAllWorkerNotificationsRead();
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, read_at: new Date().toISOString() }))
      );
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  return (
    <div className={cn("relative inline-block", className)} ref={dropdownRef}>
      <button
        onClick={handleOpen}
        className="relative p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
        aria-label="Worker Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-2 w-80 sm:w-88 rounded-xl border border-border bg-card p-3.5 shadow-2xl z-50 text-card-foreground animate-in fade-in-50 zoom-in-95">
          <div className="flex items-center justify-between border-b border-border pb-2 mb-2">
            <h4 className="text-sm font-semibold">Worker Alerts</h4>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-primary hover:underline flex items-center gap-1 font-medium"
              >
                <Check className="h-3 w-3" /> Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto space-y-2 divide-y divide-border/40">
            {loading ? (
              <p className="text-center text-xs text-muted-foreground py-6">Loading updates...</p>
            ) : notifications.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                No alerts right now.
              </div>
            ) : (
              notifications.map((n) => {
                const isUnread = !n.read_at;
                return (
                  <div
                    key={n.id}
                    onClick={(e) => isUnread && handleMarkRead(n.id, e)}
                    className={cn(
                      "pt-2 first:pt-0 pb-1 cursor-pointer transition-colors rounded-lg px-2 hover:bg-accent/50",
                      isUnread && "bg-primary/5 font-medium"
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground">{n.title}</p>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>
                    <div className="flex items-center justify-between mt-1 text-[10px] text-muted-foreground/70">
                      <span>{new Date(n.created_at).toLocaleDateString("en-IN", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="border-t border-border pt-2 mt-2 text-center">
            <Link
              href="/worker/dashboard/notifications"
              onClick={() => setIsOpen(false)}
              className="text-xs text-primary hover:underline font-medium inline-flex items-center gap-1"
            >
              View all alerts <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
