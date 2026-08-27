"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Loader2, Briefcase, User } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [mode, setMode] = useState<"password" | "otp-phone" | "otp-code">("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [otpEmail, setOtpEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const { requestOtp, verifyOtp, login } = useAuth();
  const router = useRouter();

  async function handlePasswordLogin(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/bookings");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't log you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!/^\d{10}$/.test(phone)) {
      setError("Enter a valid 10-digit phone number.");
      return;
    }
    setLoading(true);
    try {
      const result = await requestOtp(phone);
      setDevOtp(result.devOtp);
      setMode("otp-code");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't send the OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (otp.length !== 4 && otp.length !== 6) {
      setError("Enter the OTP sent to your phone.");
      return;
    }
    setLoading(true);
    try {
      await verifyOtp(phone, otp, fullName || undefined, otpEmail || undefined);
      router.push("/bookings");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That code didn't work. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container flex items-center justify-center py-16 min-h-[70vh]">
      <Card className="w-full max-w-sm shadow-lg border-border">
        <CardHeader className="items-center text-center pb-3">
          <div className="relative h-20 w-36 mx-auto mb-1 flex items-center justify-center">
            <Image
              src="/logo-light-transparent.png"
              alt="MaidKaro"
              fill
              sizes="144px"
              className="object-contain"
              priority
            />
          </div>

          {/* Role Toggle Switcher */}
          <div className="grid grid-cols-2 p-1 bg-muted rounded-xl w-full text-xs font-semibold my-2">
            <div className="py-2 text-center rounded-lg bg-background text-foreground shadow-xs flex items-center justify-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" />
              Customer
            </div>
            <Link
              href="/worker/login"
              className="py-2 text-center rounded-lg text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Partner / Worker
            </Link>
          </div>

          <CardTitle className="text-xl">
            {mode === "password" ? "Customer Log In" : mode === "otp-phone" ? "Log in with OTP" : "Enter OTP"}
          </CardTitle>
          <CardDescription>
            {mode === "password"
              ? "Book & manage household services."
              : mode === "otp-phone"
              ? "We'll text you a one-time code."
              : `Sent to +91 ${phone}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mode === "password" && (
            <form onSubmit={handlePasswordLogin} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Log in as Customer
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                New to MaidKaro?{" "}
                <Link href="/register" className="text-primary font-medium hover:underline">
                  Create customer account
                </Link>
              </p>

              <button
                type="button"
                onClick={() => { setError(null); setMode("otp-phone"); }}
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground pt-1"
              >
                Log in with phone OTP instead
              </button>

              <p className="text-center text-xs text-muted-foreground pt-1">
                Are you a service partner?{" "}
                <Link href="/worker/login" className="text-primary hover:underline">
                  Worker login
                </Link>
              </p>
            </form>
          )}

          {mode === "otp-phone" && (
            <form onSubmit={handleSendOtp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone number</Label>
                <div className="flex items-center gap-2">
                  <span className="flex h-11 items-center rounded-lg border border-input bg-muted px-3 text-sm text-muted-foreground">+91</span>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    placeholder="98765 43210"
                    value={phone}
                    maxLength={10}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
                  />
                </div>
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send OTP
              </Button>
              <button
                type="button"
                onClick={() => { setError(null); setMode("password"); }}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Back to email login
              </button>
            </form>
          )}

          {mode === "otp-code" && (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="otp">One-time code</Label>
                <Input
                  id="otp"
                  inputMode="numeric"
                  placeholder="••••"
                  value={otp}
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                />
                {devOtp && (
                  <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs flex items-center justify-between mt-1">
                    <span>Dev mode OTP: <strong className="font-mono text-sm">{devOtp}</strong></span>
                    <button
                      type="button"
                      onClick={() => setOtp(devOtp)}
                      className="underline font-semibold hover:text-amber-950 px-2 py-0.5 rounded bg-amber-500/20"
                    >
                      Auto-fill
                    </button>
                  </div>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="name">Your name (optional)</Label>
                <Input id="name" placeholder="e.g. Ananya Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="otpEmail">Email address (optional)</Label>
                <Input id="otpEmail" type="email" placeholder="e.g. ananya@example.com" value={otpEmail} onChange={(e) => setOtpEmail(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify & continue
              </Button>
              <button
                type="button"
                onClick={() => setMode("otp-phone")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Change phone number
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
