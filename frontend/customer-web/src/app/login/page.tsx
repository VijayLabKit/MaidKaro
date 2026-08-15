"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const { requestOtp, verifyOtp } = useAuth();
  const router = useRouter();

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
      setStep("otp");
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
      await verifyOtp(phone, otp, fullName);
      router.push("/bookings");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "That code didn't work. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container flex items-center justify-center py-20 min-h-[70vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="relative h-24 w-36 mx-auto mb-2 flex items-center justify-center">
            <Image
              src="/logo-light-transparent.png"
              alt="MaidKaro"
              fill
              sizes="144px"
              className="object-contain"
              priority
            />
          </div>
          <CardTitle className="text-xl">
            {step === "phone" ? "Log in or sign up" : "Enter OTP"}
          </CardTitle>
          <CardDescription>
            {step === "phone"
              ? "We'll text you a one-time code."
              : `Sent to +91 ${phone}.`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {step === "phone" ? (
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

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setPhone("9876543210")}
                  className="w-full text-xs text-muted-foreground hover:text-primary transition-colors py-1 bg-muted/60 rounded-md"
                >
                  ⚡ Fill Demo Phone: <strong>9876543210</strong>
                </button>
              </div>
            </form>
          ) : (
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
                <Label htmlFor="name">Your name (first time only)</Label>
                <Input id="name" placeholder="e.g. Ananya Sharma" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Verify & continue
              </Button>
              <button
                type="button"
                onClick={() => setStep("phone")}
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
