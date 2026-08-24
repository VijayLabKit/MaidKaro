"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Send, ShieldAlert, MessageSquare, Clock, User, ShieldCheck } from "lucide-react";
import {
  getWorkerComplaintDetail,
  addWorkerComplaintMessage,
  WorkerComplaintDetail,
} from "@/lib/worker-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "gold" }> = {
  OPEN: { label: "Open", variant: "gold" },
  IN_REVIEW: { label: "Under Staff Review", variant: "secondary" },
  AWAITING_INFO: { label: "Action Required / Awaiting Info", variant: "destructive" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CLOSED: { label: "Closed", variant: "outline" },
  DISMISSED: { label: "Dismissed", variant: "outline" },
};

export default function WorkerComplaintDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [detail, setDetail] = useState<WorkerComplaintDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const res = await getWorkerComplaintDetail(id);
      setDetail(res);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) loadData();
  }, [id]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim()) return;
    setSending(true);
    try {
      await addWorkerComplaintMessage(id, reply.trim());
      setReply("");
      await loadData();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return <div className="py-12 text-center text-sm text-muted-foreground">Loading dispute details...</div>;
  }

  if (!detail) {
    return (
      <div className="py-12 text-center space-y-3">
        <p className="text-muted-foreground text-sm">Dispute record not found.</p>
        <Button variant="outline" size="sm" asChild>
          <Link href="/worker/dashboard/support">Back to support</Link>
        </Button>
      </div>
    );
  }

  const badge = STATUS_BADGES[detail.status] || { label: detail.status, variant: "outline" };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-1" /> Back
        </Button>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-foreground">Dispute #{detail.id.slice(0, 8)}</h1>
            <Badge variant={badge.variant}>{badge.label}</Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Type: {detail.type} • Booking ID: {detail.booking_id}
          </p>
        </div>
      </div>

      {/* Initial Claim */}
      <Card className="p-5 space-y-3 border-l-4 border-l-primary">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Original Issue Description</h3>
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{detail.description}</p>
        {detail.resolution_note && (
          <div className="mt-3 p-3 rounded-lg bg-success/10 border border-success/20 text-xs space-y-1">
            <p className="font-semibold text-success">Resolution Outcome</p>
            <p className="text-foreground">{detail.resolution_note}</p>
          </div>
        )}
      </Card>

      {/* Conversation Thread */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" /> Dispute Message History ({detail.messages?.length || 0})
        </h3>

        <div className="space-y-3">
          {(!detail.messages || detail.messages.length === 0) ? (
            <p className="text-xs text-muted-foreground italic py-3">No messages yet. Send an update below.</p>
          ) : (
            detail.messages.map((m) => {
              const isStaff = m.sender_role === "STAFF";
              const isWorker = m.sender_role === "WORKER";
              return (
                <div
                  key={m.id}
                  className={cn(
                    "p-3.5 rounded-xl text-xs space-y-1 max-w-[85%]",
                    isWorker
                      ? "ml-auto bg-primary text-primary-foreground"
                      : isStaff
                      ? "mr-auto bg-blue-500/10 border border-blue-500/20 text-foreground"
                      : "mr-auto bg-card border border-border text-foreground"
                  )}
                >
                  <div className="flex items-center justify-between gap-4 font-semibold opacity-80">
                    <span className="flex items-center gap-1">
                      {isStaff ? <ShieldCheck className="h-3 w-3" /> : <User className="h-3 w-3" />}
                      {isWorker ? "You (Worker)" : isStaff ? "MaidKaro Staff Support" : "Customer"}
                    </span>
                    <span className="text-[10px] font-normal">
                      {new Date(m.created_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{m.body}</p>
                </div>
              );
            })
          )}
        </div>

        {/* Reply Box */}
        {detail.status !== "CLOSED" && detail.status !== "DISMISSED" && (
          <form onSubmit={handleSend} className="space-y-3 pt-2">
            <Textarea
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder="Type your response to support staff or provide additional details..."
              rows={3}
              required
            />
            <div className="flex justify-end">
              <Button type="submit" variant="gold" size="sm" disabled={sending || !reply.trim()}>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {sending ? "Sending..." : "Send response"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
