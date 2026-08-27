"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  ShieldCheck,
  Zap,
  Lock,
  Eye,
  EyeOff,
  User,
  Mail,
  Phone,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
  Star,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";

const PERKS = [
  {
    icon: ShieldCheck,
    title: "100% Background-Checked Staff",
    desc: "Every housekeeper, cook, and cleaner undergoes strict Aadhaar and police verification.",
  },
  {
    icon: Zap,
    title: "Instant & Scheduled Dispatch",
    desc: "Book help in under 60 seconds with upfront, transparent pricing and no surge surprises.",
  },
  {
    icon: Lock,
    title: "Secure Escrow Protection",
    desc: "Your payment is safeguarded and only released once you are satisfied with the service.",
  },
];

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { registerCustomer } = useAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^[6-9]\d{9}$/.test(phone)) {
      setError("Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }
    setLoading(true);
    try {
      await registerCustomer(fullName, email, phone, password, confirmPassword);
      router.push("/bookings");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-amber-500/[0.02] to-background py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-5xl grid lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Brand Promise Hero */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-primary/95 to-slate-900 text-white shadow-2xl relative overflow-hidden min-h-[600px]">
          {/* Decorative glows */}
          <div className="absolute -right-20 -top-20 w-64 h-64 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-64 h-64 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 space-y-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="relative h-10 w-40">
                <Image
                  src="/logo-full-dark.png"
                  alt="MaidKaro"
                  fill
                  sizes="160px"
                  className="object-contain"
                  priority
                />
              </div>
            </Link>

            <div>
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                <Sparkles className="h-3.5 w-3.5" /> India's Premium Home Help
              </span>
              <h2 className="text-2xl font-bold mt-3 leading-snug">
                Experience reliable help you can truly trust.
              </h2>
            </div>

            {/* Perks */}
            <div className="space-y-4 pt-2">
              {PERKS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <div key={i} className="flex items-start gap-3.5">
                    <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0 border border-white/10">
                      <Icon className="h-4 w-4 text-amber-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white leading-tight">{p.title}</p>
                      <p className="text-xs text-white/70 mt-0.5 leading-relaxed">{p.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Social Proof Footer */}
          <div className="relative z-10 pt-6 mt-6 border-t border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-300">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-300 text-amber-300" />
                ))}
              </div>
              <span className="text-xs font-semibold text-white ml-1">4.9/5 Rating</span>
            </div>
            <span className="text-xs text-white/70">15,000+ Reviews</span>
          </div>
        </div>

        {/* Right Side: Registration Form Card */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-xl bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-xl relative backdrop-blur">
            {/* Header badge for mobile */}
            <div className="lg:hidden flex items-center justify-center mb-6">
              <div className="relative h-10 w-36">
                <Image
                  src="/logo-full-light.png"
                  alt="MaidKaro"
                  fill
                  sizes="144px"
                  className="object-contain"
                  priority
                />
              </div>
            </div>

            {/* Role Toggle Switcher */}
            <div className="grid grid-cols-2 p-1 bg-muted rounded-xl w-full text-xs font-semibold mb-6">
              <div className="py-2.5 text-center rounded-lg bg-background text-foreground shadow-xs flex items-center justify-center gap-1.5 font-bold">
                <User className="h-3.5 w-3.5 text-primary" />
                Customer Account
              </div>
              <Link
                href="/worker/register"
                className="py-2.5 text-center rounded-lg text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
              >
                <Briefcase className="h-3.5 w-3.5" />
                Partner / Worker
              </Link>
            </div>

            <div className="space-y-2 mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                Create customer account
              </h1>
              <p className="text-sm text-muted-foreground">
                Book verified home-service professionals in under 2 minutes.
              </p>
            </div>

            {error && (
              <div className="mb-6 p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2.5 animate-in fade-in-50">
                <span className="h-2 w-2 rounded-full bg-destructive shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Full Name */}
              <div className="space-y-1.5">
                <Label htmlFor="fullName" className="text-xs font-semibold text-foreground/90">
                  Full name
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="e.g. Ananya Sharma"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 h-11 bg-background/50 border-input/80 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* Email and Phone Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs font-semibold text-foreground/90">
                    Email address
                  </Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10 h-11 bg-background/50 border-input/80 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-foreground/90">
                    Mobile number
                  </Label>
                  <div className="flex items-center gap-2">
                    <span className="flex h-11 items-center rounded-xl border border-input/80 bg-muted/60 px-3 text-xs font-semibold text-foreground shrink-0">
                      +91
                    </span>
                    <div className="relative flex-1">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        inputMode="numeric"
                        placeholder="98765 43210"
                        value={phone}
                        maxLength={10}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                        className="pl-9 h-11 bg-background/50 border-input/80 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl font-medium"
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Passwords Grid */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs font-semibold text-foreground/90">
                    Password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="At least 8 chars"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 bg-background/50 border-input/80 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs font-semibold text-foreground/90">
                    Confirm password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 bg-background/50 border-input/80 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit CTA */}
              <div className="pt-2">
                <Button
                  type="submit"
                  variant="gold"
                  className="w-full h-12 rounded-xl text-base font-semibold shadow-md hover:shadow-lg transition-all duration-200"
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating your account...
                    </>
                  ) : (
                    <>
                      Create customer account <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>

              {/* Trust Micro-copy */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Zero hidden fees • Free cancellation up to 2 hrs before</span>
              </div>

              {/* Footer navigation */}
              <div className="border-t border-border/80 pt-4 space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <Link href="/login" className="text-primary font-semibold hover:underline">
                    Log in
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  Looking to work as a service partner?{" "}
                  <Link href="/worker/register" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                    Register as a worker &rarr;
                  </Link>
                </p>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
