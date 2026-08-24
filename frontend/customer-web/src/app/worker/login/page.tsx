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
import { Loader2, Briefcase } from "lucide-react";

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
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-2">
            <Briefcase className="h-7 w-7 text-primary" />
          </div>
          <CardTitle className="text-xl">MaidKaro Worker Portal</CardTitle>
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
