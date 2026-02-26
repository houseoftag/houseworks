'use client';

import Link from 'next/link';
import { skipToken } from '@tanstack/react-query';
import { useSession } from 'next-auth/react';
import { trpc } from '@/trpc/react';
import type { DealStage } from '@prisma/client';

const STAGE_COLORS: Record<DealStage, string> = {
  LEAD: 'bg-slate-400',
  CONTACTED: 'bg-blue-400',
  PROPOSAL: 'bg-violet-400',
  NEGOTIATION: 'bg-amber-400',
  WON: 'bg-emerald-500',
  LOST: 'bg-red-400',
};

const ENTRY_ICONS: Record<string, string> = {
  NOTE: '📝',
  DOCUMENT: '📄',
  DELIVERABLE: '📦',
  EMAIL_IN: '📨',
  EMAIL_OUT: '📤',
  INVOICE: '💰',
  MEETING: '🤝',
  CALL: '📞',
};

function relativeTime(date: Date | string) {
  const d = typeof date === 'string' ? new Date(date) : date;
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function CrmDashboard({ workspaceId }: { workspaceId: string }) {
  const { status } = useSession();
  const { data: stats, isLoading, isError } = trpc.crm.dashboardStats.useQuery(
    status === 'authenticated' ? { workspaceId } : skipToken,
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-24 rounded-2xl bg-muted animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-background py-16 text-center">
        <p className="text-sm text-slate-500">No data yet. Add clients and deals to see your dashboard.</p>
      </div>
    );
  }

  const stageEntries = Object.entries(stats.dealsByStage) as [DealStage, number][];
  const totalDealsForBar = stageEntries.reduce((s, [, n]) => s + n, 0);

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Clients', value: stats.totalClients },
          { label: 'Open Deals', value: stats.dealsOpen },
          { label: 'Pipeline Value', value: `$${stats.pipelineValue.toLocaleString()}` },
          { label: 'Won / Lost', value: `${stats.dealsWon} / ${stats.dealsLost}` },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">{label}</p>
            <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>

      {/* Deals by stage bar */}
      {totalDealsForBar > 0 && (
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-3">Deals by Stage</h2>
          <div className="flex rounded-full overflow-hidden h-4">
            {stageEntries.map(([stage, count]) =>
              count > 0 ? (
                <div
                  key={stage}
                  className={`${STAGE_COLORS[stage]} transition-all`}
                  style={{ width: `${(count / totalDealsForBar) * 100}%` }}
                  title={`${stage}: ${count}`}
                />
              ) : null,
            )}
          </div>
          <div className="flex flex-wrap gap-3 mt-3">
            {stageEntries.map(([stage, count]) => (
              <div key={stage} className="flex items-center gap-1.5">
                <div className={`h-2.5 w-2.5 rounded-full ${STAGE_COLORS[stage]}`} />
                <span className="text-xs text-slate-500">{stage} ({count})</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent activity */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-3">Recent Activity</h2>
          {stats.recentActivity.length === 0 ? (
            <p className="text-xs text-slate-400">No recent activity.</p>
          ) : (
            <div className="space-y-3">
              {stats.recentActivity.map((entry) => (
                <div key={entry.id} className="flex items-start gap-2.5">
                  <span className="text-base flex-shrink-0">{ENTRY_ICONS[entry.type] ?? '🔔'}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{entry.title}</p>
                    <p className="text-xs text-slate-400">
                      <Link href={`/crm/${workspaceId}/client/${entry.client.id}`} className="hover:text-primary">
                        {entry.client.displayName}
                      </Link>
                      {' · '}
                      {relativeTime(entry.createdAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top clients */}
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-bold text-foreground mb-3">Top Clients</h2>
          {stats.topClients.length === 0 ? (
            <p className="text-xs text-slate-400">No closed deals yet.</p>
          ) : (
            <div className="space-y-2">
              {stats.topClients.map((client) => (
                <div key={client.clientId} className="flex items-center justify-between gap-2 py-1.5">
                  <div className="min-w-0">
                    <Link
                      href={`/crm/${workspaceId}/client/${client.clientId}`}
                      className="text-sm font-medium text-foreground hover:text-primary truncate block"
                    >
                      {client.name}
                    </Link>
                    {client.company && (
                      <p className="text-xs text-slate-400 truncate">{client.company}</p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold text-emerald-600">${client.value.toLocaleString()}</p>
                    {client.openDeals > 0 && (
                      <p className="text-xs text-slate-400">{client.openDeals} open</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
