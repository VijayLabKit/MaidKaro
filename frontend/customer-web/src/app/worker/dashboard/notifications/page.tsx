"use client";

import { useEffect, useState } from "react";
import { Bell, Check, Clock, ShieldAlert } from "lucide-react";
import {
  listWorkerNotifications,
  markWorkerNotificationRead,
  markAllWorkerNotificationsRead,
  WorkerNotification,
} from "@/lib/worker-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export default function WorkerNotificationsPage() {
  const [notifications, setNotifications] = useState<WorkerNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await listWorkerNotifications(1, 50);
      setNotifications(res.items);
      setUnreadCount(res.unread_count);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleMarkRead = async (id: string) => {
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

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading alerts...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Bell className="h-6 w-6 text-primary" /> Worker Alerts & Notifications
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Real-time updates regarding your job requests, KYC approvals, and payments.
          </p>
        </div>
        {unreadCount > 0 && (
          <Button variant="outline" size="sm" onClick={handleMarkAllRead}>
            <Check className="h-4 w-4 mr-1.5" /> Mark all read
          </Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
            <Bell className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No alerts right now</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            You will receive instant alerts when customers book your service, KYC updates occur, or payouts are processed.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {notifications.map((n) => {
            const isUnread = !n.read_at;
            return (
              <Card
                key={n.id}
                onClick={() => isUnread && handleMarkRead(n.id)}
                className={cn(
                  "p-4 transition-all duration-200 cursor-pointer hover:shadow-md",
                  isUnread
                    ? "border-primary/40 bg-primary/[0.02]"
                    : "bg-card"
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-foreground">{n.title}</h4>
                      {isUnread && (
                        <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{n.body}</p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70 pt-1">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        {new Date(n.created_at).toLocaleString("en-IN", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>

                  {isUnread && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleMarkRead(n.id);
                      }}
                      className="text-xs text-muted-foreground hover:text-foreground shrink-0"
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
