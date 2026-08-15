import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-primary text-primary-foreground/80 mt-24">
      <div className="container py-12 grid gap-10 sm:grid-cols-2 md:grid-cols-4">
        <div>
          <div className="mb-3">
            <span className="relative block h-10 w-32">
              <Image src="/logo-full-dark.png" alt="MaidKaro" fill sizes="130px" className="object-contain object-left" />
            </span>
          </div>
          <p className="text-sm leading-relaxed">
            Verified household help — cleaning, cooking, childcare and more — booked in minutes across Siliguri.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Services</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/services/home-cleaning" className="hover:text-white">Home Cleaning</Link></li>
            <li><Link href="/services/cooking" className="hover:text-white">Cooking</Link></li>
            <li><Link href="/services/baby-care" className="hover:text-white">Baby Care</Link></li>
            <li><Link href="/services/elderly-care" className="hover:text-white">Elderly Care</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Company</p>
          <ul className="space-y-2 text-sm">
            <li><Link href="/how-it-works" className="hover:text-white">How it works</Link></li>
            <li><Link href="/workers" className="hover:text-white">Become a worker</Link></li>
            <li><Link href="#" className="hover:text-white">Trust & safety</Link></li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-white/50 mb-3">Get the app</p>
          <p className="text-sm">Siliguri, West Bengal · Support: +91 90000 00000</p>
        </div>
      </div>
      <div className="border-t border-white/10">
        <div className="container py-4 text-xs text-white/40 flex flex-col sm:flex-row justify-between gap-2">
          <span>© {new Date().getFullYear()} MaidKaro. All rights reserved.</span>
          <span>Made for households in Siliguri.</span>
        </div>
      </div>
    </footer>
  );
}
