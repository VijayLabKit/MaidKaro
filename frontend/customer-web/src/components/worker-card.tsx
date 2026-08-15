import Link from "next/link";
import { WorkerSummary } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function WorkerCard({ worker }: { worker: WorkerSummary }) {
  return (
    <Card className="transition-all duration-200 hover:shadow-popover hover:-translate-y-0.5">
      <CardContent className="p-5 flex gap-4">
        <Avatar className="h-16 w-16 shrink-0">
          <AvatarImage src={worker.photoUrl} alt={worker.fullName} />
          <AvatarFallback>{worker.fullName.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="font-semibold text-foreground truncate">{worker.fullName}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{worker.yearsExperience} yrs experience · {worker.city}</p>
            </div>
            {worker.isAvailableNow && (
              <Badge variant="success" className="shrink-0">Available now</Badge>
            )}
          </div>

          <p className="mt-2 text-sm text-muted-foreground line-clamp-2">{worker.bio}</p>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <StarRating rating={worker.ratingAvg} count={worker.ratingCount} />
              <span className="text-sm font-semibold text-primary">₹{worker.hourlyRate}/hr</span>
            </div>
            <Button size="sm" variant="gold" asChild>
              <Link href={`/workers/${worker.id}`}>View profile</Link>
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
