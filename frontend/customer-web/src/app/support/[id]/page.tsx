"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useRequireAuth } from "@/lib/use-require-auth";
import { getComplaintDetail, addComplaintMessage, ApiComplaintDetail, ApiError } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Loader2, ShieldCheck, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "gold" | "success" | "info" | "warning" | "destructive" | "outline"> = {
  OPEN: "gold", IN_REVIEW: "info", AWAITING_INFO: "warning", RESOLVED: "success", CLOSED: "secondary", DISMISSED: "secondary",
};

const STATUS_COPY: Record<string, string> = {
  OPEN: "We've received your report and it's in the queue for review.",
  IN_REVIEW: "Our team is actively reviewing this.",
  AWAITING_INFO: "We need a bit more information from you — please reply below.",
  RESOLVED: "This has been resolved.",
  CLOSED: "This has been closed.",
  DISMISSED: "This was reviewed and did not require further action.",
};

export default function ComplaintDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, isLoading } = useRequireAuth();
  const [complaint, setComplaint] = useState<ApiComplaintDetail | null>(null);
  const [loadingComplaint, setLoadingComplaint] = useState(true);
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    getComplaintDetail(params.id).then(setComplaint).finally(() => setLoadingComplaint(false));
  }, [user, params.id]);

  async function handleSend() {
    if (!complaint || reply.trim().length < 1) return;
    setSending(true);
    setError(null);
    try {
      const msg = await addComplaintMessage(complaint.id, reply);
      setComplaint({ ...complaint, messages: [...complaint.messages, msg], status: complaint.status === "AWAITING_INFO" ? "IN_REVIEW" : complaint.status });
      setReply("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send your message.");
    } finally {
      setSending(false);
    }
  }

  if (isLoading || !user || loadingComplaint) {
    return (
      <div className="container py-14 max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!complaint) {
    return <div className="container py-20 text-center text-muted-foreground">Report not found.</div>;
  }

  const closed = complaint.status === "RESOLVED" || complaint.status === "CLOSED" || complaint.status === "DISMISSED";

  return (
    <div className="container py-14 max-w-2xl">
      <Link href="/support" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to complaints & disputes
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-2 mb-2">
            <Badge variant="outline" className="text-xs">{complaint.type === "DISPUTE" ? "Billing dispute" : "Complaint"}</Badge>
            <Badge variant={STATUS_VARIANT[complaint.status]}>{complaint.status.replaceAll("_", " ")}</Badge>
          </div>
          <p className="text-sm text-muted-foreground mb-4">{STATUS_COPY[complaint.status]}</p>

          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <p className="text-foreground">{complaint.description}</p>
            <p className="text-xs text-muted-foreground mt-2">
              Reported {new Date(complaint.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
            </p>
          </div>

          {complaint.resolution_note && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-sm mt-3">
              <p className="font-medium text-emerald-700 mb-1">Resolution</p>
              <p className="text-foreground">{complaint.resolution_note}</p>
              {complaint.refund_issued != null && (
                <p className="text-emerald-700 font-semibold mt-1.5">Refund issued: ₹{complaint.refund_issued}</p>
              )}
            </div>
          )}

          {complaint.messages.length > 0 && (
            <>
              <Separator className="my-5" />
              <div className="space-y-3">
                {complaint.messages.map((m) => (
                  <div key={m.id} className={cn("flex gap-2.5", m.sender_role === "STAFF" ? "" : "flex-row-reverse")}>
                    <div className={cn(
                      "h-7 w-7 rounded-full flex items-center justify-center shrink-0",
                      m.sender_role === "STAFF" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                    )}>
                      {m.sender_role === "STAFF" ? <ShieldCheck className="h-3.5 w-3.5" /> : <UserIcon className="h-3.5 w-3.5" />}
                    </div>
                    <div className={cn(
                      "rounded-lg px-3.5 py-2.5 text-sm max-w-[80%]",
                      m.sender_role === "STAFF" ? "bg-muted text-foreground" : "bg-primary/10 text-foreground"
                    )}>
                      <p>{m.body}</p>
                      <p className="text-[10px] text-muted-foreground mt-1">
                        {m.sender_role === "STAFF" ? "MaidKaro Support" : "You"} ·{" "}
                        {new Date(m.created_at).toLocaleString("en-IN", { dateStyle: "short", timeStyle: "short" })}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!closed && (
            <>
              <Separator className="my-5" />
              <div className="space-y-2">
                <Textarea
                  placeholder="Add more information or reply to support…"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  rows={3}
                />
                {error && <p className="text-sm text-destructive">{error}</p>}
                <Button variant="gold" onClick={handleSend} disabled={sending || reply.trim().length < 1}>
                  {sending && <Loader2 className="h-4 w-4 animate-spin" />}
                  Send
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
