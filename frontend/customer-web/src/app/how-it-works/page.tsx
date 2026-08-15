import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Search, CalendarCheck, ShieldCheck, Smile } from "lucide-react";

const STEPS = [
  { icon: Search, title: "Choose a service", desc: "Pick from cleaning, cooking, baby care, elderly care and more." },
  { icon: CalendarCheck, title: "Pick a worker & time", desc: "Browse verified profiles, ratings and reviews, then book a slot that works for you." },
  { icon: ShieldCheck, title: "We verify everything", desc: "Every worker on MaidKaro completes ID and background verification before going live." },
  { icon: Smile, title: "Relax — it's handled", desc: "Track your booking in real time and pay securely in the app once the job's done." },
];

export default function HowItWorksPage() {
  return (
    <div className="container py-16">
      <div className="max-w-xl mb-12">
        <h1 className="text-3xl font-semibold text-foreground">How MaidKaro works</h1>
        <p className="mt-2 text-muted-foreground">From browsing to booked help, in four simple steps.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {STEPS.map((step, i) => (
          <div key={step.title} className="relative">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-secondary mb-4">
              <step.icon className="h-5 w-5" />
            </span>
            <p className="text-xs font-semibold text-gold-600 mb-1">STEP {i + 1}</p>
            <h3 className="font-semibold text-foreground">{step.title}</h3>
            <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{step.desc}</p>
          </div>
        ))}
      </div>

      <div className="mt-16 text-center">
        <Button size="lg" variant="gold" asChild>
          <Link href="/services">Get started</Link>
        </Button>
      </div>
    </div>
  );
}
