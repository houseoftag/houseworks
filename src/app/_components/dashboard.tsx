'use client';

import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';

type DashboardProps = {
  onSelectBoard: (id: string) => void;
  onRequestCreateBoard: () => void;
};

export function Dashboard({ onSelectBoard, onRequestCreateBoard }: DashboardProps) {
  const { status } = useSession();
  const isAuthed = status === 'authenticated';

  const { data: stats, isLoading, isError, refetch } = trpc.boards.dashboardStats.useQuery(undefined, {
    enabled: isAuthed,
  });

  if (!isAuthed) return null;

  if (isError) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
        <p className="text-sm font-semibold text-red-700">Unable to load dashboard data</p>
        <p className="mt-1 text-xs text-red-500">Something went wrong. Please try again.</p>
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
        <div className="h-32 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-24 animate-pulse rounded-xl bg-slate-100" />
        </div>
      </div>
    );
  }

  if (!stats) return null;

  const statusEntries = Object.entries(stats.statusCounts).sort(
    ([, a], [, b]) => b - a,
  );

  return (
    <div className="space-y-6">
      {/* Workspace header */}
      {stats.workspace && (
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <h2 className="text-xl font-bold text-foreground">{stats.workspace.name}</h2>
          <p className="mt-1 text-sm text-slate-500">
            {stats.workspace.memberCount} {stats.workspace.memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
      )}

      {/* Stats cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Total Boards
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {stats.totalBoards}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Total Items
          </p>
          <p className="mt-2 text-3xl font-bold text-foreground">
            {stats.totalItems}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            Items by Status
          </p>
          <div className="mt-2 space-y-1">
            {statusEntries.length === 0 && (
              <p className="text-xs text-slate-400 italic">No items yet</p>
            )}
            {statusEntries.map(([status, count]) => (
              <div key={status} className="flex items-center justify-between text-xs">
                <span className="text-slate-600 truncate">{status}</span>
                <span className="font-semibold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent boards */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Recent Boards</h3>
          <button
            className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-slate-50 transition-colors"
            onClick={onRequestCreateBoard}
            type="button"
          >
            + New Board
          </button>
        </div>
        {stats.recentBoards.length === 0 ? (
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
          <div className="mt-4 space-y-2">
            {stats.recentBoards.map((board) => (
              <button
                key={board.id}
                className="w-full text-left rounded-xl border border-border px-4 py-3 transition-colors hover:bg-slate-50 group"
                onClick={() => onSelectBoard(board.id)}
                type="button"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      {board.title}
                    </p>
                    {board.description && (
                      <p className="mt-0.5 text-xs text-slate-400 truncate max-w-md">
                        {board.description}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-400">{board.itemCount} items</p>
                    <p className="text-[10px] text-slate-300">
                      {board.workspaceName}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
