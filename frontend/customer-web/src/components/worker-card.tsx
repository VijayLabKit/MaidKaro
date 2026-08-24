import Link from "next/link";
import { WorkerSummary } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ShieldCheck } from "lucide-react";

export function WorkerCard({ worker }: { worker: WorkerSummary }) {
  return (
    <Card className="transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5 border-border/80 group">
      <CardContent className="p-5 flex gap-4">
        <Avatar className="h-16 w-16 shrink-0 ring-2 ring-primary/10">
          <AvatarImage src={worker.photoUrl} alt={worker.fullName} />
          <AvatarFallback className="bg-primary/5 text-primary font-semibold">{worker.fullName.charAt(0)}</AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-1.5">
                <p className="font-semibold text-foreground truncate group-hover:text-primary transition-colors">{worker.fullName}</p>
                <span title="Verified Background Checked Worker" className="inline-flex items-center text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-4 w-4 fill-emerald-500/20 text-emerald-600" />
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{worker.yearsExperience} yrs exp · {worker.city}</p>
            </div>
            {worker.isAvailableNow && (
              <Badge variant="success" className="shrink-0 text-[11px] font-medium">Available now</Badge>
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
