"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import { ApiError } from "@/lib/api";
import { Loader2, CheckCircle2 } from "lucide-react";
import Image from "next/image";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [devToken, setDevToken] = useState<string | null>(null);
  const { forgotPassword } = useAuth();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await forgotPassword(email);
      setDevToken(result.devToken);
      setSent(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container flex items-center justify-center py-20 min-h-[70vh]">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="relative h-24 w-36 mx-auto mb-2 flex items-center justify-center">
            <Image src="/logo-light-transparent.png" alt="MaidKaro" fill sizes="144px" className="object-contain" priority />
          </div>
          <CardTitle className="text-xl">Reset your password</CardTitle>
          <CardDescription>Enter your registered email and we'll send you a reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto" />
              <p className="text-sm text-muted-foreground">
                If an account exists for <strong>{email}</strong>, a password reset link has been sent. It's valid for 30 minutes.
              </p>
              {devToken && (
                <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 text-xs text-left space-y-1.5">
                  <p className="font-medium">Dev mode — email provider isn't configured, so here's your reset link directly:</p>
                  <Link href={`/reset-password?token=${devToken}`} className="underline font-mono break-all block">
                    /reset-password?token={devToken}
                  </Link>
                </div>
              )}
              <Link href="/login" className="text-sm text-primary hover:underline block">Back to login</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email address</Label>
                <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
              </div>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <Button type="submit" variant="gold" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Send reset link
              </Button>
              <Link href="/login" className="w-full text-center text-sm text-muted-foreground hover:text-foreground block">
                Back to login
              </Link>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
