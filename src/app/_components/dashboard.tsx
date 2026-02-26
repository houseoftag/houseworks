'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';
import { ActivityFeed } from './activity_feed';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */
type DashboardProps = {
  onSelectBoard: (id: string) => void;
  onRequestCreateBoard: () => void;
  onSelectItem?: (itemId: string, boardId: string) => void;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const TYPE_CONFIG: Record<string, { icon: string; label: string }> = {
  COMMENT: { icon: '💬', label: 'commented' },
  STATUS_CHANGE: { icon: '🔄', label: 'changed status' },
  ASSIGNMENT: { icon: '👤', label: 'assigned' },
  FIELD_EDIT: { icon: '✏️', label: 'edited' },
  ITEM_CREATED: { icon: '✨', label: 'created item' },
  ITEM_DELETED: { icon: '🗑️', label: 'deleted item' },
  BOARD_CREATED: { icon: '📋', label: 'created board' },
  BOARD_UPDATED: { icon: '📝', label: 'updated board' },
  BOARD_DELETED: { icon: '🗑️', label: 'deleted board' },
  MEMBER_ADDED: { icon: '➕', label: 'added member' },
  MEMBER_REMOVED: { icon: '➖', label: 'removed member' },
  AUTOMATION_TRIGGERED: { icon: '⚡', label: 'automation ran' },
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


/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */
export function Dashboard({ onSelectBoard, onRequestCreateBoard, onSelectItem }: DashboardProps) {
  const { status } = useSession();
  const isAuthed = status === 'authenticated';
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');

  const { data: stats, isLoading, isError, refetch } = trpc.boards.dashboardStats.useQuery(undefined, {
    enabled: isAuthed,
  });

  if (!isAuthed) return null;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm font-semibold text-red-500">Unable to load dashboard data</p>
        <p className="mt-1 text-xs text-red-400">Something went wrong. Please try again.</p>
        <button
          className="mt-3 rounded-md bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700 transition-colors"
          onClick={() => refetch()}
          type="button"
        >
          Retry
        </button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
        <div className="h-28 animate-pulse rounded-xl bg-muted" />
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-6">
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`rounded-md px-4 min-h-[44px] text-xs font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-slate-500 hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`rounded-md px-4 min-h-[44px] text-xs font-semibold transition-colors ${
              activeTab === 'activity'
                ? 'bg-card text-foreground shadow-sm'
                : 'text-slate-500 hover:text-foreground'
            }`}
          >
            Activity
          </button>
        </div>
      </div>

      {/* Activity feed tab (full) */}
      {activeTab === 'activity' && stats.workspace && (
        <ActivityFeed
          workspaceId={stats.workspace.id}
          onNavigateToItem={onSelectItem}
        />
      )}

      {activeTab === 'overview' && (
        <>
          {/* Workspace header */}
          {stats.workspace && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-foreground">{stats.workspace.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {stats.workspace.memberCount} {stats.workspace.memberCount === 1 ? 'member' : 'members'}
                  </p>
                </div>
                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={onRequestCreateBoard}
                    className="rounded-md bg-primary px-3 min-h-[44px] text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                    type="button"
                  >
                    + New Board
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Board Summary Cards */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Boards</h3>
              <button
                className="rounded-md border border-border px-3 min-h-[44px] text-xs font-semibold text-primary hover:bg-background transition-colors"
                onClick={onRequestCreateBoard}
                type="button"
              >
                + New Board
              </button>
            </div>
            {stats.boardSummaries.length === 0 ? (
              <div className="mt-6 text-center">
                <p className="text-sm text-slate-500">No boards yet. Create your first board to get started.</p>
                <button
                  className="mt-3 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20"
                  onClick={onRequestCreateBoard}
                  type="button"
                >
                  Create your first board
                </button>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {stats.boardSummaries.map((board) => (
                  <button
                    key={board.id}
                    className="text-left rounded-xl border border-border p-4 transition-colors hover:bg-background hover:border-primary/30 group"
                    onClick={() => onSelectBoard(board.id)}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                      {board.title}
                    </p>
                    {board.description && (
                      <p className="mt-0.5 text-xs text-slate-400 truncate">
                        {board.description}
                      </p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <span className="text-xs text-slate-500">{board.itemCount} items</span>
                      <span className={`text-xs font-semibold ${board.completionPercent === 100 ? 'text-green-600' : 'text-foreground/70'}`}>
                        {board.completionPercent}% done
                      </span>
                    </div>
                    {/* Completion bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${board.completionPercent === 100 ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${board.completionPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-slate-300">
                      <span title={new Date(board.updatedAt).toLocaleString()}>Updated {formatTimeAgo(new Date(board.updatedAt))}</span>
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Recent Activity Timeline (inline, last 20) */}
          {stats.recentActivity.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Recent Activity</h3>
                <button
                  onClick={() => setActiveTab('activity')}
                  className="flex min-h-[44px] items-center text-xs font-medium text-primary hover:underline"
                >
                  View all activity
                </button>
              </div>
              <div className="space-y-1 max-h-[400px] overflow-y-auto">
                {stats.recentActivity.map((entry) => {
                  const cfg = TYPE_CONFIG[entry.type] ?? { icon: '📌', label: entry.type };
                  return (
                    <button
                      key={entry.id}
                      onClick={() => {
                        if (entry.item && entry.boardId && onSelectItem) {
                          onSelectItem(entry.item.id, entry.boardId);
                        } else if (entry.boardId) {
                          onSelectBoard(entry.boardId);
                        }
                      }}
                      className="w-full text-left flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-background"
                    >
                      <span className="text-sm flex-shrink-0">{cfg.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-foreground">
                          <span className="font-semibold">{entry.user.name ?? 'Unknown'}</span>{' '}
                          {cfg.label}
                          {entry.item && (
                            <>
                              {' '}on{' '}
                              <span className="font-medium text-primary">{entry.item.name}</span>
                            </>
                          )}
                          {entry.board && (
                            <span className="text-slate-400"> in {entry.board.title}</span>
                          )}
                        </p>
                        <p className="mt-0.5 text-[10px] text-slate-400">
                          <span title={new Date(entry.createdAt).toLocaleString()}>{formatTimeAgo(new Date(entry.createdAt))}</span>
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

        </>
      )}

    </div>
  );
}
