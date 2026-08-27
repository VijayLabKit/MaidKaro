"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { useWorkerAuth } from "@/lib/worker-auth-context";
import { ApiError } from "@/lib/worker-api";
import { Loader2, Briefcase, User } from "lucide-react";
import Image from "next/image";

export default function WorkerLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login } = useWorkerAuth();
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      router.push("/worker/dashboard");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't log you in. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
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
            <Link
              href="/login"
              className="py-2 text-center rounded-lg text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-1.5"
            >
              <User className="h-3.5 w-3.5" />
              Customer
            </Link>
            <div className="py-2 text-center rounded-lg bg-background text-foreground shadow-xs flex items-center justify-center gap-1.5 font-bold">
              <Briefcase className="h-3.5 w-3.5 text-primary" />
              Partner / Worker
            </div>
          </div>

          <CardTitle className="text-xl">Worker Partner Log In</CardTitle>
          <CardDescription>Log in to manage your bookings, earnings, and schedule.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input id="email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link href="/worker/forgot-password" className="text-xs text-primary hover:underline">Forgot password?</Link>
              </div>
              <Input id="password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" variant="gold" className="w-full" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Log in
            </Button>
            <p className="text-center text-sm text-muted-foreground">
              New to MaidKaro?{" "}
              <Link href="/worker/register" className="text-primary font-medium hover:underline">Register as a worker</Link>
            </p>
            <p className="text-center text-xs text-muted-foreground pt-1">
              Looking to book a service instead?{" "}
              <Link href="/login" className="text-primary hover:underline">Customer login</Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
