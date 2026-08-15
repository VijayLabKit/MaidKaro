import { notFound } from "next/navigation";
import Link from "next/link";
import { getWorker, getWorkerReviews, ApiError } from "@/lib/api";
import { toWorkerSummary, toReview } from "@/lib/mappers";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { StarRating } from "@/components/star-rating";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ShieldCheck, Languages, Briefcase, MapPin, Quote } from "lucide-react";

export default async function WorkerProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let apiWorker;
  try {
    apiWorker = await getWorker(id);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }

  const worker = toWorkerSummary(apiWorker);
  const apiReviews = await getWorkerReviews(id);
  const reviews = apiReviews.map(toReview);

  return (
    <div className="container py-14">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
        <div className="lg:col-span-2">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <Avatar className="h-24 w-24 shrink-0">
              <AvatarImage src={worker.photoUrl} alt={worker.fullName} />
              <AvatarFallback className="text-2xl">{worker.fullName.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-semibold text-foreground">{worker.fullName}</h1>
                <Badge variant="success" className="gap-1">
                  <ShieldCheck className="h-3 w-3" /> Verified
                </Badge>
                {worker.isAvailableNow && <Badge variant="gold">Available now</Badge>}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4" /> {worker.city}</span>
                <span className="flex items-center gap-1.5"><Briefcase className="h-4 w-4" /> {worker.yearsExperience} yrs experience</span>
                {worker.languages.length > 0 && (
                  <span className="flex items-center gap-1.5"><Languages className="h-4 w-4" /> {worker.languages.join(", ")}</span>
                )}
              </div>
              <div className="mt-3">
                <StarRating rating={worker.ratingAvg} count={worker.ratingCount} size="md" />
              </div>
              {apiWorker.skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {apiWorker.skills.map((s) => (
                    <Badge key={s.category_id} variant="outline">{s.category_name} · ₹{s.hourly_rate}/hr</Badge>
                  ))}
                </div>
              )}
            </div>
          </div>

          {worker.bio && <p className="mt-6 text-foreground leading-relaxed">{worker.bio}</p>}

          <Separator className="my-8" />

          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Reviews ({reviews.length})
            </h2>
            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reviews yet — be the first to book and review.</p>
            ) : (
              <div className="space-y-4">
                {reviews.map((r) => (
                  <Card key={r.id}>
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm text-foreground">{r.customerName}</p>
                        <StarRating rating={r.rating} />
                      </div>
                      {r.comment && (
                        <p className="mt-2 text-sm text-muted-foreground flex gap-2">
                          <Quote className="h-3.5 w-3.5 shrink-0 mt-0.5 text-gold-500" />
                          {r.comment}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(r.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>

        <div>
          <Card className="sticky top-24">
            <CardContent className="p-6">
              <p className="text-sm text-muted-foreground">Hourly rate</p>
              <p className="text-3xl font-semibold text-primary mt-1">₹{worker.hourlyRate}<span className="text-base font-normal text-muted-foreground">/hr</span></p>
              <Separator className="my-5" />
              <ul className="space-y-2.5 text-sm text-muted-foreground">
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Background verified</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Free rescheduling up to 4 hrs before</li>
                <li className="flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-emerald-600" /> Secure in-app payments</li>
              </ul>
              <Button size="lg" variant="gold" className="w-full mt-6" asChild>
                <Link href={`/book/${worker.id}`}>Book {worker.fullName.split(" ")[0]}</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
