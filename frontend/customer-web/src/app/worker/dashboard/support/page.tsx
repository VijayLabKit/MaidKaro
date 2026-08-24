"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, Plus, MessageSquare, Clock, ArrowRight } from "lucide-react";
import {
  listWorkerComplaints,
  listWorkerBookings,
  raiseWorkerComplaint,
  WorkerComplaint,
  ApiBookingFlat,
} from "@/lib/worker-api";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const STATUS_BADGES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" | "success" | "gold" }> = {
  OPEN: { label: "Open", variant: "gold" },
  IN_REVIEW: { label: "In Review", variant: "secondary" },
  AWAITING_INFO: { label: "Awaiting Your Info", variant: "destructive" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CLOSED: { label: "Closed", variant: "outline" },
  DISMISSED: { label: "Dismissed", variant: "outline" },
};

export default function WorkerSupportPage() {
  const [complaints, setComplaints] = useState<WorkerComplaint[]>([]);
  const [bookings, setBookings] = useState<ApiBookingFlat[]>([]);
  const [loading, setLoading] = useState(true);

  // New complaint dialog state
  const [open, setOpen] = useState(false);
  const [selectedBookingId, setSelectedBookingId] = useState("");
  const [type, setType] = useState<"COMPLAINT" | "DISPUTE">("COMPLAINT");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const loadData = async () => {
    try {
      setLoading(true);
      const [compRes, bookRes] = await Promise.all([
        listWorkerComplaints(),
        listWorkerBookings(),
      ]);
      setComplaints(compRes);
      setBookings(bookRes);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBookingId || !description.trim()) {
      setError("Please select a booking and describe the issue.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await raiseWorkerComplaint({
        booking_id: selectedBookingId,
        type,
        description: description.trim(),
      });
      setOpen(false);
      setDescription("");
      setSelectedBookingId("");
      await loadData();
    } catch (err: any) {
      setError(err?.message || "Failed to submit report");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <ShieldAlert className="h-6 w-6 text-primary" /> Support & Disputes
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Report issues regarding unfair cancellations, unsafe working conditions, or non-payments.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="gold" size="sm">
              <Plus className="h-4 w-4 mr-1.5" /> Report an issue
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Report a Problem or Dispute</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4 pt-2">
              {error && (
                <div className="p-3 text-xs rounded-lg bg-destructive/10 text-destructive border border-destructive/20">
                  {error}
                </div>
              )}

              <div className="space-y-1.5">
                <Label>Select Booking</Label>
                <Select value={selectedBookingId} onValueChange={setSelectedBookingId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose relevant job..." />
                  </SelectTrigger>
                  <SelectContent>
                    {bookings.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.category_name || "Service"} ({new Date(b.created_at).toLocaleDateString()}) - ₹{b.price_quoted}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Issue Type</Label>
                <Select value={type} onValueChange={(v: "COMPLAINT" | "DISPUTE") => setType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPLAINT">Complaint (Customer Behavior / Safety / Address Issue)</SelectItem>
                    <SelectItem value="DISPUTE">Payment / Hours Dispute</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Detailed Description</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Explain what happened clearly so our support team can help arbitrate..."
                  rows={4}
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" variant="gold" disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit report"}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="py-12 text-center text-sm text-muted-foreground">Loading complaints...</div>
      ) : complaints.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center mb-3">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No active complaints or disputes</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
            You have not submitted any disputes. If you encounter an issue on a job, click Report an issue above.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {complaints.map((c) => {
            const badge = STATUS_BADGES[c.status] || { label: c.status, variant: "outline" };
            return (
              <Card key={c.id} className="p-4 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant={badge.variant} className="text-xs">
                        {badge.label}
                      </Badge>
                      <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {c.type}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {c.description}
                    </p>
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground/70">
                      <Clock className="h-3.5 w-3.5" />
                      <span>
                        Filed on{" "}
                        {new Date(c.created_at).toLocaleDateString("en-IN", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </div>

                  <Button variant="outline" size="sm" asChild className="shrink-0">
                    <Link href={`/worker/dashboard/support/${c.id}`}>
                      <MessageSquare className="h-3.5 w-3.5 mr-1.5" /> View Thread
                      <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
