import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function StarRating({ rating, count, size = "sm" }: { rating: number; count?: number; size?: "sm" | "md" }) {
  return (
    <div className="flex items-center gap-1">
      <Star className={cn("fill-gold-500 text-gold-500", size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4")} />
      <span className={cn("font-medium text-foreground", size === "sm" ? "text-xs" : "text-sm")}>{rating.toFixed(1)}</span>
      {typeof count === "number" && (
        <span className={cn("text-muted-foreground", size === "sm" ? "text-xs" : "text-sm")}>({count})</span>
      )}
    </div>
  );
}
