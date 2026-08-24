"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import {
  Briefcase,
  Wallet,
  Clock,
  ShieldCheck,
  User,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  MapPin,
  CheckCircle2,
  Loader2,
  ArrowRight,
  Sparkles,
  Star,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useWorkerAuth } from "@/lib/worker-auth-context";
import { getCitiesPublic, ApiCity, ApiError } from "@/lib/worker-api";

const WORKER_PERKS = [
  {
    icon: Wallet,
    title: "Earn Up to ₹35,000 / month",
    desc: "Direct-to-bank weekly payouts with 100% tip retention and transparent commission rates.",
  },
  {
    icon: Clock,
    title: "Choose Your Own Hours & Area",
    desc: "Full flexibility to toggle your availability and accept bookings close to your neighborhood.",
  },
  {
    icon: ShieldCheck,
    title: "Insurance & Safety First",
    desc: "Work exclusively for verified customer households with 24/7 dedicated partner assistance.",
  },
];

const LANGUAGE_OPTIONS = ["Hindi", "English", "Bengali", "Marathi", "Kannada", "Tamil", "Telugu", "Nepali"];

export default function WorkerRegisterPage() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [cityId, setCityId] = useState("");
  const [cities, setCities] = useState<ApiCity[]>([]);
  const [yearsExperience, setYearsExperience] = useState("2");
  const [languages, setLanguages] = useState<string[]>(["Hindi"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { registerWorker } = useWorkerAuth();
  const router = useRouter();

  useEffect(() => {
    getCitiesPublic().then(setCities).catch(() => setCities([]));
  }, []);

  function toggleLanguage(lang: string) {
    setLanguages((prev) =>
      prev.includes(lang) ? prev.filter((l) => l !== lang) : [...prev, lang]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{10}$/.test(phone)) {
      setError("Please enter a valid 10-digit mobile number.");
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
    if (!cityId) {
      setError("Please select your operational city.");
      return;
    }
    if (languages.length === 0) {
      setError("Please select at least one language you can communicate in.");
      return;
    }
    setLoading(true);
    try {
      await registerWorker({
        full_name: fullName,
        email,
        phone: `+91${phone}`,
        password,
        confirm_password: confirmPassword,
        city_id: cityId,
        years_experience: Number(yearsExperience) || 0,
        languages,
      });
      router.push("/worker/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't create your account. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-amber-500/[0.02] to-background py-10 px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-6xl grid lg:grid-cols-12 gap-8 items-center">
        {/* Left Side: Worker Partner Hero Showcase */}
        <div className="hidden lg:flex lg:col-span-5 flex-col justify-between p-8 rounded-3xl bg-gradient-to-br from-slate-900 via-primary/95 to-slate-900 text-white shadow-2xl relative overflow-hidden min-h-[700px]">
          {/* Decorative glows */}
          <div className="absolute -right-20 -top-20 w-72 h-72 rounded-full bg-amber-400/20 blur-3xl pointer-events-none" />
          <div className="absolute -left-20 -bottom-20 w-72 h-72 rounded-full bg-blue-500/15 blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="relative z-10 space-y-6">
            <Link href="/" className="inline-flex items-center gap-2">
              <div className="relative h-10 w-36">
                <Image
                  src="/logo-full-light.png"
                  alt="MaidKaro"
                  fill
                  sizes="144px"
                  className="object-contain object-left brightness-0 invert"
                  priority
                />
              </div>
            </Link>

            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-400/15 backdrop-blur border border-amber-400/30 text-xs font-semibold text-amber-300">
              <Sparkles className="h-3.5 w-3.5" /> MaidKaro Partner Network
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-bold tracking-tight leading-tight">
                Grow your earnings on your own schedule.
              </h2>
              <p className="text-white/80 text-sm leading-relaxed">
                Join 2,500+ verified professionals getting steady household bookings in Bangalore, Mumbai & Delhi.
              </p>
            </div>

            {/* Perks list */}
            <div className="space-y-4 pt-4">
              {WORKER_PERKS.map((perk, i) => {
                const Icon = perk.icon;
                return (
                  <div key={i} className="flex items-start gap-3.5 p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm">
                    <div className="h-9 w-9 rounded-xl bg-amber-400/20 text-amber-300 flex items-center justify-center shrink-0 mt-0.5">
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-semibold text-white">{perk.title}</h4>
                      <p className="text-xs text-white/70 leading-relaxed mt-0.5">{perk.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Partner Trust Metrics */}
          <div className="relative z-10 pt-6 mt-6 border-t border-white/15 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="flex text-amber-400">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-xs font-semibold text-white ml-1">4.8/5 Satisfaction</span>
            </div>
            <span className="text-xs text-white/70">2,500+ Active Partners</span>
          </div>
        </div>

        {/* Right Side: Registration Form Card */}
        <div className="lg:col-span-7 flex justify-center">
          <div className="w-full max-w-xl bg-card border border-border/80 rounded-3xl p-6 sm:p-10 shadow-xl relative backdrop-blur">
            {/* Header for mobile */}
            <div className="lg:hidden flex items-center justify-center mb-6">
              <div className="h-12 w-12 rounded-2xl bg-amber-500/15 text-amber-600 flex items-center justify-center">
                <Briefcase className="h-6 w-6" />
              </div>
            </div>

            <div className="space-y-2 mb-6">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                  Register as a worker
                </h1>
              </div>
              <p className="text-sm text-muted-foreground">
                Join our network of verified home-service professionals and start receiving bookings.
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
                  Full name (as per Aadhaar / Gov ID)
                </Label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="fullName"
                    placeholder="e.g. Ramesh Kumar"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="pl-10 h-11 bg-background/50 border-input/80 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl"
                    required
                  />
                </div>
              </div>

              {/* Email & Phone */}
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
                      placeholder="ramesh@example.com"
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

              {/* Password & Confirm */}
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

              {/* City & Experience */}
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground/90">City</Label>
                  <Select value={cityId} onValueChange={setCityId}>
                    <SelectTrigger className="h-11 bg-background/50 border-input/80 rounded-xl">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Select primary city" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="years" className="text-xs font-semibold text-foreground/90">
                    Years of experience
                  </Label>
                  <Input
                    id="years"
                    type="number"
                    min={0}
                    max={50}
                    value={yearsExperience}
                    onChange={(e) => setYearsExperience(e.target.value)}
                    className="h-11 bg-background/50 border-input/80 focus:border-primary focus:ring-2 focus:ring-primary/20 rounded-xl font-medium"
                    required
                  />
                </div>
              </div>

              {/* Languages Spoken */}
              <div className="space-y-2">
                <Label className="text-xs font-semibold text-foreground/90">
                  Languages you speak
                </Label>
                <div className="flex flex-wrap gap-2 pt-0.5">
                  {LANGUAGE_OPTIONS.map((lang) => {
                    const selected = languages.includes(lang);
                    return (
                      <button
                        key={lang}
                        type="button"
                        onClick={() => toggleLanguage(lang)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-150 ${
                          selected
                            ? "bg-primary text-primary-foreground border-primary shadow-sm"
                            : "bg-background/80 text-muted-foreground border-input/80 hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {selected && <Check className="h-3 w-3" />}
                        {lang}
                      </button>
                    );
                  })}
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
                      <Loader2 className="h-4 w-4 animate-spin mr-2" /> Creating worker account...
                    </>
                  ) : (
                    <>
                      Create worker account <ArrowRight className="h-4 w-4 ml-1.5" />
                    </>
                  )}
                </Button>
              </div>

              {/* Trust Micro-copy */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                <span>Quick KYC approval • Start accepting jobs within 24 hours</span>
              </div>

              {/* Footer Links */}
              <div className="border-t border-border/80 pt-4 space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  Already registered as a partner?{" "}
                  <Link href="/worker/login" className="text-primary font-semibold hover:underline">
                    Log in
                  </Link>
                </p>
                <p className="text-xs text-muted-foreground">
                  Looking to hire help instead?{" "}
                  <Link href="/register" className="text-primary font-medium hover:underline inline-flex items-center gap-1">
                    Register as a customer &rarr;
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
