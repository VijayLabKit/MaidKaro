"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getBooking, updateBookingStatus, createReview, ApiBooking, ApiError } from "@/lib/api";
import { toBooking } from "@/lib/mappers";
import { useRequireAuth } from "@/lib/use-require-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { BookingStatusBadge } from "@/components/booking-status-badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CalendarClock, MapPin, Clock3, Receipt, ArrowLeft, Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function BookingDetailPage() {
  const params = useParams<{ id: string }>();
  const { user, isLoading } = useRequireAuth();
  const [apiBooking, setApiBooking] = useState<ApiBooking | null>(null);
  const [loadingBooking, setLoadingBooking] = useState(true);
  const [actionError, setActionError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [showReview, setShowReview] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewSubmitted, setReviewSubmitted] = useState(false);

  useEffect(() => {
    if (!user) return;
    getBooking(params.id)
      .then(setApiBooking)
      .finally(() => setLoadingBooking(false));
  }, [user, params.id]);

  async function handleCancel() {
    if (!apiBooking) return;
    setCancelling(true);
    setActionError(null);
    try {
      const updated = await updateBookingStatus(apiBooking.id, "CANCEL", "Cancelled by customer");
      setApiBooking(updated);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Couldn't cancel this booking.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleSubmitReview() {
    if (!apiBooking) return;
    setSubmittingReview(true);
    setActionError(null);
    try {
      await createReview({ booking_id: apiBooking.id, rating, comment: comment || undefined });
      setShowReview(false);
      setReviewSubmitted(true);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Couldn't submit your review.");
    } finally {
      setSubmittingReview(false);
    }
  }

  if (isLoading || !user || loadingBooking) {
    return (
      <div className="container py-14 space-y-4 max-w-2xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!apiBooking) {
    return <div className="container py-20 text-center text-muted-foreground">Booking not found.</div>;
  }

  const booking = toBooking(apiBooking);

  return (
    <div className="container py-14 max-w-2xl">
      <Link href="/bookings" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to bookings
      </Link>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Booking #{booking.id.slice(0, 8)}</p>
              <h1 className="text-xl font-semibold text-foreground mt-0.5">{booking.categoryName}</h1>
            </div>
            <BookingStatusBadge status={booking.status} />
          </div>

          <Separator className="my-5" />

          <div className="flex items-center gap-4">
            <Avatar className="h-14 w-14">
              <AvatarImage src={booking.workerPhotoUrl} alt={booking.workerName ?? ""} />
              <AvatarFallback>{booking.workerName?.charAt(0) ?? "?"}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-medium text-foreground">{booking.workerName ?? "Not yet assigned"}</p>
              <p className="text-sm text-muted-foreground">Assigned worker</p>
            </div>
          </div>

          <Separator className="my-5" />

          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-3">
              <CalendarClock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Scheduled for</p>
                <p className="text-foreground font-medium">
                  {booking.scheduledFor
                    ? new Date(booking.scheduledFor).toLocaleString("en-IN", { dateStyle: "full", timeStyle: "short" })
                    : "Not scheduled"}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Clock3 className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Duration</p>
                <p className="text-foreground font-medium">{booking.durationHours} hours</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Address</p>
                <p className="text-foreground font-medium">{booking.address || "—"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Receipt className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-muted-foreground">Total</p>
                <p className="text-foreground font-medium">₹{booking.priceQuoted}</p>
              </div>
            </div>
          </div>

          {actionError && <p className="text-sm text-destructive mt-4">{actionError}</p>}

          {(booking.status === "PENDING" || booking.status === "CONFIRMED") && (
            <>
              <Separator className="my-5" />
              <div className="flex gap-3">
                <Button variant="destructive" className="flex-1" onClick={handleCancel} disabled={cancelling}>
                  {cancelling && <Loader2 className="h-4 w-4 animate-spin" />}
                  Cancel booking
                </Button>
              </div>
            </>
          )}

          {booking.status === "COMPLETED" && !reviewSubmitted && (
            <>
              <Separator className="my-5" />
              <Button variant="gold" className="w-full" onClick={() => setShowReview(true)}>Leave a review</Button>
            </>
          )}

          {reviewSubmitted && (
            <>
              <Separator className="my-5" />
              <p className="text-sm text-muted-foreground text-center">Thanks for your review!</p>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={showReview} onOpenChange={setShowReview}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rate {booking.workerName ?? "your worker"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex items-center justify-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} star`}>
                  <Star className={cn("h-8 w-8", n <= rating ? "fill-gold-500 text-gold-500" : "text-muted-foreground")} />
                </button>
              ))}
            </div>
            <Textarea
              placeholder="How was your experience? (optional)"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="gold" onClick={handleSubmitReview} disabled={submittingReview}>
              {submittingReview && <Loader2 className="h-4 w-4 animate-spin" />}
              Submit review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
