"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRequireAuth } from "@/lib/use-require-auth";
import { listMyComplaints, ApiComplaint } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquareWarning } from "lucide-react";

const STATUS_VARIANT: Record<ApiComplaint["status"], "default" | "secondary" | "gold" | "success" | "info" | "warning" | "destructive" | "outline"> = {
  OPEN: "gold",
  IN_REVIEW: "info",
  AWAITING_INFO: "warning",
  RESOLVED: "success",
  CLOSED: "secondary",
  DISMISSED: "secondary",
};

export default function SupportPage() {
  const { user, isLoading } = useRequireAuth();
  const [complaints, setComplaints] = useState<ApiComplaint[] | null>(null);

  useEffect(() => {
    if (!user) return;
    listMyComplaints().then(setComplaints);
  }, [user]);

  if (isLoading || !user || complaints === null) {
    return (
      <div className="container py-14 max-w-2xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="container py-14 max-w-2xl">
      <h1 className="text-2xl font-semibold text-foreground mb-1">Complaints & disputes</h1>
      <p className="text-sm text-muted-foreground mb-6">Track the status of issues you've reported and see responses from our support team.</p>

      {complaints.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <MessageSquareWarning className="h-8 w-8 mx-auto mb-3 opacity-50" />
            <p>You haven't reported any issues yet.</p>
            <p className="text-sm mt-1">You can report an issue from any completed or in-progress booking.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => (
            <Link key={c.id} href={`/support/${c.id}`}>
              <Card className="hover:border-primary/50 transition-colors">
                <CardContent className="p-5 flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="text-xs">{c.type === "DISPUTE" ? "Billing dispute" : "Complaint"}</Badge>
                      <Badge variant={STATUS_VARIANT[c.status]}>{c.status.replaceAll("_", " ")}</Badge>
                    </div>
                    <p className="text-sm text-foreground line-clamp-2">{c.description}</p>
                    <p className="text-xs text-muted-foreground mt-1.5">
                      Reported {new Date(c.created_at).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                    </p>
                  </div>
                  {c.refund_issued != null && (
                    <div className="text-right shrink-0">
                      <p className="text-xs text-muted-foreground">Refund</p>
                      <p className="text-sm font-semibold text-emerald-600">₹{c.refund_issued}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
