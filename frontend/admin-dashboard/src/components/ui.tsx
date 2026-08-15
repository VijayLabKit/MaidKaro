import clsx from 'clsx';
import { ReactNode } from 'react';
import { Card as ShadCard, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button as ShadButton, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

// Thin, backward-compatible wrappers around the shadcn/ui primitives so every
// existing page (which imports { Card, PageHeader, StatusBadge, Button, ... }
// from '@/components/ui') keeps working unchanged after the shadcn migration.

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <ShadCard className={className}>
      <CardContent className="p-6">{children}</CardContent>
    </ShadCard>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-foreground">{title}</h1>
        {subtitle && <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

type BadgeVariant = 'default' | 'secondary' | 'gold' | 'success' | 'info' | 'warning' | 'destructive' | 'outline';

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  APPROVED: 'success',
  PENDING_REVIEW: 'gold',
  REJECTED: 'destructive',
  NEEDS_RESUBMISSION: 'warning',
  NOT_SUBMITTED: 'secondary',
  PENDING: 'gold',
  CONFIRMED: 'info',
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'secondary',
  EXPIRED: 'secondary',
  OPEN: 'gold',
  IN_REVIEW: 'info',
  RESOLVED: 'success',
  DISMISSED: 'secondary',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge variant={STATUS_VARIANT[status] ?? 'secondary'}>{status.replaceAll('_', ' ')}</Badge>;
}

const VARIANT_MAP: Record<'primary' | 'secondary' | 'danger' | 'ghost', 'default' | 'gold' | 'destructive' | 'ghost'> = {
  primary: 'default',
  secondary: 'gold',
  danger: 'destructive',
  ghost: 'ghost',
};

export function Button({
  children,
  variant = 'primary',
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  return (
    <ShadButton variant={VARIANT_MAP[variant]} className={clsx(className)} {...props}>
      {children}
    </ShadButton>
  );
}

export { buttonVariants };

export function EmptyState({ message }: { message: string }) {
  return <div className="text-center py-16 text-sm text-muted-foreground">{message}</div>;
}

export function LoadingState() {
  return (
    <div className="space-y-3 py-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
    </div>
  );
}
