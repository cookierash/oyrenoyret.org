'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Select, SelectItem } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { extractErrorMessage, formatErrorToast } from '@/src/lib/error-toast';
import { useI18n } from '@/src/i18n/i18n-provider';

type UserLite = {
  id: string;
  publicId: string | null;
  email: string;
  firstName: string | null;
  lastName: string | null;
};

type UserReportRow = {
  id: string;
  targetType: string;
  targetId: string | null;
  reason: string;
  details: string | null;
  contextUrl: string | null;
  status: string;
  createdAt: string;
  resolvedAt: string | null;
  reporter: UserLite;
  reportedUser: UserLite;
  resolvedBy: UserLite | null;
};

export function UserReportsAdminPanel() {
  const { messages } = useI18n();
  const panelCopy = messages.admin.reportsPanel;
  const reportCopy = messages.userReports;

  const [status, setStatus] = useState<'PENDING' | 'RESOLVED' | 'DISMISSED' | 'ALL'>('PENDING');
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<UserReportRow[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('take', '200');
      if (status !== 'ALL') params.set('status', status);
      const res = await fetch(`/api/user-reports?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(panelCopy.toasts.loadFailed, extractErrorMessage(data)));
        setRows([]);
        return;
      }
      setRows(Array.isArray(data) ? (data as UserReportRow[]) : []);
    } catch (error) {
      toast.error(
        formatErrorToast(panelCopy.toasts.loadFailed, error instanceof Error ? error.message : null),
      );
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const updateStatus = async (id: string, next: 'PENDING' | 'RESOLVED' | 'DISMISSED') => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/user-reports/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(formatErrorToast(panelCopy.toasts.updateFailed, extractErrorMessage(data)));
        return;
      }
      toast.success(panelCopy.updatedToast);
      await load();
    } catch (error) {
      toast.error(
        formatErrorToast(panelCopy.toasts.updateFailed, error instanceof Error ? error.message : null),
      );
    } finally {
      setBusyId(null);
    }
  };

  const counts = useMemo(() => {
    const pending = rows.filter((r) => r.status === 'PENDING').length;
    return { pending, total: rows.length };
  }, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{panelCopy.statusLabel}</span>
          <Select value={status} onChange={(e) => setStatus(e.target.value as any)} className="w-[180px]">
            <SelectItem value="PENDING">{panelCopy.statuses.PENDING}</SelectItem>
            <SelectItem value="RESOLVED">{panelCopy.statuses.RESOLVED}</SelectItem>
            <SelectItem value="DISMISSED">{panelCopy.statuses.DISMISSED}</SelectItem>
            <SelectItem value="ALL">{panelCopy.statusAll}</SelectItem>
          </Select>
        </div>
        <Button size="sm" variant="outline" onClick={load}>
          {panelCopy.refresh}
        </Button>
      </div>

      {loading ? (
        <div className="card-frame bg-card p-5 space-y-3">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-4 w-56" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card-frame border-dashed bg-muted/20 px-5 py-10 text-center">
          <p className="text-sm font-medium text-muted-foreground">{panelCopy.emptyTitle}</p>
          <p className="mt-1 text-xs text-muted-foreground/70">{panelCopy.emptySubtitle}</p>
        </div>
      ) : (
        <div className="card-frame bg-card">
          <div className="flex items-center justify-between border-b border-border/70 px-5 py-3">
            <h2 className="text-sm font-medium text-foreground">{panelCopy.title}</h2>
            <p className="text-xs text-muted-foreground">
              {status === 'PENDING'
                ? panelCopy.pendingCount.replace('{{count}}', String(counts.pending))
                : panelCopy.shownCount.replace('{{count}}', String(counts.total))}
            </p>
          </div>
          <div className="overflow-x-auto pb-1">
            <table className="min-w-[1200px] w-max table-auto border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 text-left text-xs tracking-wide text-muted-foreground whitespace-nowrap">
                  <th className="w-[160px] py-2 pl-5 pr-4 font-medium">{panelCopy.headers.created}</th>
                  <th className="w-[140px] py-2 pr-4 font-medium">{panelCopy.headers.location}</th>
                  <th className="w-[110px] py-2 pr-4 font-medium">{panelCopy.headers.reason}</th>
                  <th className="w-[200px] py-2 pr-4 font-medium">{panelCopy.headers.reporter}</th>
                  <th className="w-[200px] py-2 pr-4 font-medium">{panelCopy.headers.reported}</th>
                  <th className="py-2 pr-4 font-medium">{panelCopy.headers.details}</th>
                  <th className="w-[100px] py-2 pr-4 font-medium">{panelCopy.headers.status}</th>
                  <th className="w-[180px] py-2 pr-5 font-medium">{panelCopy.headers.actions}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const busy = busyId === row.id;
                  const resolvedTargetLabel =
                    (reportCopy.targetsAdmin as any)?.[row.targetType] ??
                    (reportCopy.targets as any)?.[row.targetType] ??
                    row.targetType;
                  const resolvedReasonLabel =
                    (reportCopy.reasons as any)?.[row.reason] ?? row.reason;
                  const resolvedStatusLabel =
                    (panelCopy.statuses as any)?.[row.status] ?? row.status;
                  const reporterName =
                    [row.reporter.firstName, row.reporter.lastName].filter(Boolean).join(' ').trim() ||
                    row.reporter.email.split('@')[0] ||
                    panelCopy.unknownUser;
                  const reportedName =
                    [row.reportedUser.firstName, row.reportedUser.lastName].filter(Boolean).join(' ').trim() ||
                    row.reportedUser.email.split('@')[0] ||
                    panelCopy.unknownUser;

                  return (
                    <tr key={row.id} className="border-t border-border/70 align-top">
                      <td className="py-3 pl-5 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {new Date(row.createdAt).toLocaleString()}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        <div className="font-medium text-foreground">{resolvedTargetLabel}</div>
                        {row.contextUrl ? (
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="mt-1 h-7 justify-start px-2 font-mono text-[11px] text-muted-foreground/80"
                          >
                            <a href={row.contextUrl} target="_blank" rel="noreferrer">
                              {panelCopy.openContext}
                            </a>
                          </Button>
                        ) : row.targetId ? (
                          <div className="mt-1 block truncate font-mono text-[11px] text-muted-foreground/70">
                            {row.targetId}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">{resolvedReasonLabel}</td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground">{reporterName}</div>
                        <div className="text-xs text-muted-foreground truncate">{row.reporter.email}</div>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="font-medium text-foreground">{reportedName}</div>
                        <div className="text-xs text-muted-foreground truncate">{row.reportedUser.email}</div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground">
                        <div className="max-h-24 overflow-y-auto whitespace-pre-wrap break-words pr-2">
                          {row.details ?? panelCopy.dash}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-muted-foreground whitespace-nowrap">
                        {resolvedStatusLabel}
                      </td>
                      <td className="py-3 pr-5">
                        <div className="flex flex-nowrap gap-2 whitespace-nowrap">
                          {row.status !== 'RESOLVED' ? (
                            <Button
                              size="sm"
                              variant="secondary-primary"
                              disabled={busy}
                              onClick={() => updateStatus(row.id, 'RESOLVED')}
                            >
                              {panelCopy.actions.resolve}
                            </Button>
                          ) : null}
                          {row.status !== 'DISMISSED' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => updateStatus(row.id, 'DISMISSED')}
                            >
                              {panelCopy.actions.dismiss}
                            </Button>
                          ) : null}
                          {row.status !== 'PENDING' ? (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => updateStatus(row.id, 'PENDING')}
                            >
                              {panelCopy.actions.reopen}
                            </Button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
