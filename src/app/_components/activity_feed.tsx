'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';

const TYPE_CONFIG: Record<string, { icon: string; label: string; color: string }> = {
  COMMENT: { icon: '💬', label: 'commented', color: 'bg-green-500/15' },
  STATUS_CHANGE: { icon: '🔄', label: 'changed status', color: 'bg-amber-500/15' },
  ASSIGNMENT: { icon: '👤', label: 'assigned', color: 'bg-blue-500/15' },
  FIELD_EDIT: { icon: '✏️', label: 'edited', color: 'bg-muted' },
  ITEM_CREATED: { icon: '✨', label: 'created item', color: 'bg-emerald-500/15' },
  ITEM_DELETED: { icon: '🗑️', label: 'deleted item', color: 'bg-red-500/10' },
  BOARD_CREATED: { icon: '📋', label: 'created board', color: 'bg-indigo-500/15' },
  BOARD_UPDATED: { icon: '📝', label: 'updated board', color: 'bg-indigo-500/15' },
  BOARD_DELETED: { icon: '🗑️', label: 'deleted board', color: 'bg-red-500/10' },
  MEMBER_ADDED: { icon: '➕', label: 'added member', color: 'bg-teal-500/15' },
  MEMBER_REMOVED: { icon: '➖', label: 'removed member', color: 'bg-orange-500/15' },
  AUTOMATION_TRIGGERED: { icon: '⚡', label: 'automation ran', color: 'bg-purple-500/15' },
  ITEM_MOVED: { icon: '↕️', label: 'moved item', color: 'bg-cyan-500/15' },
  BOARD_DUPLICATED: { icon: '📋', label: 'duplicated board', color: 'bg-indigo-500/15' },
  ATTACHMENT_ADDED: { icon: '📎', label: 'attached file', color: 'bg-sky-500/15' },
  ATTACHMENT_DELETED: { icon: '📎', label: 'removed attachment', color: 'bg-red-500/10' },
};

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

type ActivityFeedProps = {
  workspaceId: string;
  onNavigateToItem?: (itemId: string, boardId: string) => void;
};

export function ActivityFeed({ workspaceId, onNavigateToItem }: ActivityFeedProps) {
  const { status } = useSession();
  const [boardFilter, setBoardFilter] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    trpc.activity.list.useInfiniteQuery(
      {
        workspaceId,
        limit: 30,
        ...(boardFilter && { boardId: boardFilter }),
        ...(typeFilter && { type: typeFilter as never }),
      },
      {
        enabled: status === 'authenticated' && !!workspaceId,
        getNextPageParam: (lastPage) => lastPage.nextCursor,
      },
    );

  const { data: boards } = trpc.boards.listByWorkspace.useQuery(
    { workspaceId },
    { enabled: status === 'authenticated' && !!workspaceId },
  );

  const allItems = data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center justify-between border-b border-border px-5 py-4">
        <p className="text-sm font-semibold text-foreground">Activity Feed</p>
        <div className="flex gap-2">
          <select
            value={boardFilter}
            onChange={(e) => setBoardFilter(e.target.value)}
            aria-label="Filter by board"
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground bg-card"
          >
            <option value="">All boards</option>
            {boards?.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title}
              </option>
            ))}
          </select>
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            aria-label="Filter by type"
            className="rounded-md border border-border px-2 py-1 text-xs text-foreground bg-card"
          >
            <option value="">All types</option>
            {Object.entries(TYPE_CONFIG).map(([key, cfg]) => (
              <option key={key} value={key}>
                {cfg.icon} {cfg.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="max-h-[600px] overflow-y-auto p-4">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ) : allItems.length === 0 ? (
          <div className="py-12 text-center">
            <div className="text-3xl mb-2">📋</div>
            <p className="text-sm text-slate-400">No activity yet</p>
          </div>
        ) : (
          <div className="space-y-1">
            {allItems.map((entry) => {
              const cfg = TYPE_CONFIG[entry.type] ?? {
                icon: '📌',
                label: entry.type,
                color: 'bg-background',
              };
              return (
                <button
                  key={entry.id}
                  onClick={() => {
                    if (entry.item && entry.boardId && onNavigateToItem) {
                      onNavigateToItem(entry.item.id, entry.boardId);
                    }
                  }}
                  className="w-full text-left flex items-start gap-3 rounded-lg p-3 transition-colors hover:bg-background"
                >
                  <div
                    className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${cfg.color} text-sm`}
                  >
                    {cfg.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-foreground">
                      <span className="font-semibold">
                        {entry.user.name ?? 'Unknown'}
                      </span>{' '}
                      {cfg.label}
                      {entry.field && (
                        <span className="text-slate-500"> ({entry.field})</span>
                      )}
                      {entry.item && (
                        <>
                          {' '}
                          on{' '}
                          <span className="font-medium text-primary">
                            {entry.item.name}
                          </span>
                        </>
                      )}
                      {entry.board && (
                        <span className="text-slate-400">
                          {' '}
                          in {entry.board.title}
                        </span>
                      )}
                    </p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      <span title={new Date(entry.createdAt).toLocaleString()}>{formatTimeAgo(new Date(entry.createdAt))}</span>
                    </p>
                  </div>
                </button>
              );
            })}

            {hasNextPage && (
              <div className="pt-2 text-center">
                <button
                  onClick={() => fetchNextPage()}
                  disabled={isFetchingNextPage}
                  className="rounded-md border border-border px-4 py-2 text-xs font-medium text-primary hover:bg-background transition-colors disabled:opacity-50 min-h-[44px]"
                >
                  {isFetchingNextPage ? 'Loading...' : 'Load more'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
