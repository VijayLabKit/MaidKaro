"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X, CalendarClock, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/services", label: "Services" },
  { href: "/workers", label: "Find help" },
  { href: "/how-it-works", label: "How it works" },
];

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { user } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="container flex h-16 items-center justify-between">
        <Link href="/" className="flex items-center shrink-0" onClick={() => setOpen(false)}>
          <span className="relative h-10 w-32">
            <Image src="/logo-full-light.png" alt="MaidKaro — Reliable help at your doorstep" fill className="object-contain object-left" priority />
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "px-3 py-2 rounded-md text-sm font-medium transition-colors",
                pathname === item.href ? "text-primary bg-accent" : "text-muted-foreground hover:text-primary hover:bg-accent",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/bookings">
                  <CalendarClock className="h-4 w-4" />
                  My bookings
                </Link>
              </Button>
              <Link href="/profile" className="ml-1">
                <Avatar className="h-9 w-9">
                  <AvatarFallback>{user.fullName.charAt(0)}</AvatarFallback>
                </Avatar>
              </Link>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/login">Log in</Link>
              </Button>
              <Button variant="gold" size="sm" asChild>
                <Link href="/services">Book a service</Link>
              </Button>
            </>
          )}
        </div>

        <button className="md:hidden p-2 -mr-2" onClick={() => setOpen((v) => !v)} aria-label="Toggle menu">
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <div className="md:hidden border-t border-border bg-background">
          <nav className="container py-3 flex flex-col gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="px-3 py-2.5 rounded-md text-sm font-medium text-foreground hover:bg-accent"
              >
                {item.label}
              </Link>
            ))}
            <div className="h-px bg-border my-2" />
            {user ? (
              <>
                <Link href="/bookings" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-md text-sm font-medium hover:bg-accent flex items-center gap-2">
                  <CalendarClock className="h-4 w-4" /> My bookings
                </Link>
                <Link href="/profile" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-md text-sm font-medium hover:bg-accent flex items-center gap-2">
                  <User className="h-4 w-4" /> Profile
                </Link>
              </>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)} className="px-3 py-2.5 rounded-md text-sm font-medium hover:bg-accent">
                  Log in
                </Link>
                <Link href="/services" onClick={() => setOpen(false)}>
                  <Button variant="gold" className="w-full mt-1">Book a service</Button>
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
