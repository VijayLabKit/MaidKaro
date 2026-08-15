'use client';

import { useState } from 'react';
import Image from 'next/image';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ApiError } from '@/lib/api';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

function LoginForm() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-primary flex flex-col items-center justify-center px-6 relative overflow-hidden">
      {/* Ambient background glow for seamless visual blending */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col items-center mb-8 relative z-10">
        <div className="relative h-28 w-40 mb-1">
          <Image
            src="/logo-transparent.png"
            alt="MaidKaro"
            fill
            className="object-contain drop-shadow-[0_4px_16px_rgba(0,0,0,0.25)]"
            priority
          />
        </div>
        <p className="text-white/70 text-xs tracking-widest uppercase font-semibold">Operations &amp; Trust Console</p>
      </div>

      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-lg">Admin sign in</CardTitle>
          <CardDescription>Access is restricted to MaidKaro staff.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@maidkaro.com"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
                {error}
              </div>
            )}

            <Button type="submit" disabled={isSubmitting} className="mt-1">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="text-white/30 text-xs mt-8">MaidKaro · Siliguri, West Bengal</p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <AuthProvider>
      <LoginForm />
    </AuthProvider>
  );
}
