import { Badge } from "@/components/ui/badge";
import { BookingStatus } from "@/lib/types";

const VARIANT: Record<BookingStatus, "default" | "secondary" | "gold" | "success" | "info" | "warning" | "destructive" | "outline"> = {
  PENDING: "gold",
  CONFIRMED: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "success",
  CANCELLED: "secondary",
  REJECTED: "destructive",
  EXPIRED: "secondary",
};

export function BookingStatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={VARIANT[status]}>{status.replaceAll("_", " ")}</Badge>;
}
