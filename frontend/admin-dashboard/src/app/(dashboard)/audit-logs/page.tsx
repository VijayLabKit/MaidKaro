'use client';

import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { PageHeader, Card, LoadingState, EmptyState } from '@/components/ui';
import { FileSpreadsheet, ShieldAlert, User, Clock, Globe } from 'lucide-react';

interface AuditLogItem {
  id: string;
  actorUserId?: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  metadataJson?: Record<string, any>;
  ipAddress?: string;
  createdAt: string;
}

export default function AuditLogsPage() {
  const { admin } = useAuth();
  const isSuperAdmin = admin?.role === 'SUPER_ADMIN';

  const { data: logs, isLoading } = useSWR<AuditLogItem[]>('/admin/audit-logs', fetcher);

  if (!isSuperAdmin) {
    return (
      <div className="py-12">
        <PageHeader title="System & Security Audit Logs" subtitle="Access is restricted to Super Admins." />
        <Card>
          <div className="flex items-center gap-4 py-6 text-center justify-center flex-col">
            <div className="h-12 w-12 rounded-full bg-destructive/10 text-destructive flex items-center justify-center">
              <ShieldAlert size={24} />
            </div>
            <div>
              <p className="font-semibold text-base text-foreground">Super Admin Permission Required</p>
              <p className="text-sm text-muted-foreground mt-1 max-w-md">
                Only executive accounts with the <strong className="text-foreground">SUPER_ADMIN</strong> role can inspect platform audit trails and compliance event logs.
              </p>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Security & System Audit Logs"
        subtitle="Immutable compliance audit trail tracking all KYC verifications, refund approvals, and configuration changes."
      />

      {isLoading || !logs ? (
        <LoadingState />
      ) : logs.length === 0 ? (
        <EmptyState message="No audit logs recorded yet." />
      ) : (
        <div className="grid gap-3">
          {logs.map((log) => (
            <Card key={log.id}>
              <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
                      {log.action}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      Target: <strong className="text-foreground font-medium">{log.entityType} #{log.entityId.slice(0, 8)}</strong>
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <User size={13} /> {log.actorName}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={13} /> {new Date(log.createdAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </span>
                    {log.ipAddress && (
                      <span className="flex items-center gap-1 font-mono">
                        <Globe size={13} /> {log.ipAddress}
                      </span>
                    )}
                  </div>

                  {log.metadataJson && Object.keys(log.metadataJson).length > 0 && (
                    <div className="mt-2 bg-muted/60 p-2.5 rounded text-xs font-mono text-muted-foreground border border-border/60 overflow-x-auto">
                      {JSON.stringify(log.metadataJson)}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
