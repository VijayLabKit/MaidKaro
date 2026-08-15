import Link from "next/link";
import { getCategories, getWorkers } from "@/lib/api";
import { toServiceCategory, toWorkerSummary } from "@/lib/mappers";
import { CategoryCard } from "@/components/category-card";
import { WorkerCard } from "@/components/worker-card";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Clock, BadgeIndianRupee, Star } from "lucide-react";

export default async function HomePage() {
  const [apiCategories, apiWorkers] = await Promise.all([getCategories(), getWorkers()]);
  const categories = apiCategories.map(toServiceCategory);
  const featuredWorkers = apiWorkers.slice(0, 3).map(toWorkerSummary);

  return (
    <div>
      <section className="relative overflow-hidden bg-primary">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(242,183,5,0.15),transparent_45%),radial-gradient(circle_at_80%_60%,rgba(242,183,5,0.1),transparent_40%)]" />
        <div className="container relative py-20 md:py-28">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-xs font-medium text-gold-300 mb-5">
              <Star className="h-3.5 w-3.5 fill-gold-400 text-gold-400" /> Rated 4.8 by 3,000+ Siliguri households
            </span>
            <h1 className="text-4xl md:text-5xl font-bold text-white text-balance leading-tight">
              Trusted household help,{" "}
              <span className="text-gold-400">booked in minutes</span>
            </h1>
            <p className="mt-5 text-lg text-white/70 leading-relaxed max-w-xl">
              Verified, background-checked maids, cooks, nannies and caregivers — available on-demand or on a
              schedule, across Siliguri.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button size="lg" variant="gold" asChild>
                <Link href="/services">Browse services</Link>
              </Button>
              <Button size="lg" variant="outline" className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white" asChild>
                <Link href="/workers">Find available help now</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border bg-muted/40">
        <div className="container py-8 grid grid-cols-1 sm:grid-cols-3 gap-6">
          <TrustPoint icon={ShieldCheck} title="Verified & background-checked" desc="Every worker completes KYC before going live." />
          <TrustPoint icon={Clock} title="Book in under 2 minutes" desc="Pick a service, pick a time, confirm — that's it." />
          <TrustPoint icon={BadgeIndianRupee} title="Transparent pricing" desc="See the exact rate before you book, no surprises." />
        </div>
      </section>

      <section className="container py-16">
        <div className="flex items-end justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold text-foreground">Explore services</h2>
            <p className="text-muted-foreground mt-1">What do you need help with today?</p>
          </div>
          <Link href="/services" className="text-sm font-medium text-primary hover:underline hidden sm:block">
            View all
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {categories.map((cat) => (
            <CategoryCard key={cat.id} category={cat} />
          ))}
        </div>
      </section>

      <section className="bg-muted/40 py-16">
        <div className="container">
          <div className="flex items-end justify-between mb-8">
            <div>
              <h2 className="text-2xl font-semibold text-foreground">Top-rated workers near you</h2>
              <p className="text-muted-foreground mt-1">Loved by families across Siliguri.</p>
            </div>
            <Link href="/workers" className="text-sm font-medium text-primary hover:underline hidden sm:block">
              View all
            </Link>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {featuredWorkers.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} />
            ))}
          </div>
        </div>
      </section>

      <section className="container py-20">
        <div className="rounded-2xl bg-primary px-8 py-14 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(242,183,5,0.18),transparent_60%)]" />
          <div className="relative">
            <h2 className="text-2xl md:text-3xl font-semibold text-white">Ready to get your time back?</h2>
            <p className="mt-3 text-white/70 max-w-lg mx-auto">
              Join thousands of households who trust MaidKaro for reliable, verified home help.
            </p>
            <Button size="lg" variant="gold" className="mt-7" asChild>
              <Link href="/services">Book your first service</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}

function TrustPoint({ icon: Icon, title, desc }: { icon: typeof ShieldCheck; title: string; desc: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <p className="font-medium text-foreground text-sm">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{desc}</p>
      </div>
    </div>
  );
}
