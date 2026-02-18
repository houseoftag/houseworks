'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';
import { TemplateGallery } from './template_gallery';
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
/*  Quick Action: Create Item (board selector + item name)             */
/* ------------------------------------------------------------------ */
function CreateItemDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (boardId: string) => void;
}) {
  const [selectedBoard, setSelectedBoard] = useState('');
  const [itemName, setItemName] = useState('');
  const { data: stats } = trpc.boards.dashboardStats.useQuery();
  const { data: boardDetail } = trpc.boards.getById.useQuery(
    { id: selectedBoard },
    { enabled: !!selectedBoard },
  );
  const createItem = trpc.items.create.useMutation();
  const utils = trpc.useUtils();

  if (!open) return null;

  const boards = stats?.boardSummaries ?? [];
  const firstGroupId = boardDetail?.groups?.[0]?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBoard || !itemName.trim() || !firstGroupId) return;

    try {
      await createItem.mutateAsync({
        groupId: firstGroupId,
        name: itemName.trim(),
      });
      await utils.boards.dashboardStats.invalidate();
      onCreated(selectedBoard);
      setItemName('');
      setSelectedBoard('');
      onClose();
    } catch {
      // handled by tRPC
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">Create Item</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Board</label>
            <select
              value={selectedBoard}
              onChange={(e) => setSelectedBoard(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm bg-white"
              required
            >
              <option value="">Select a board…</option>
              {boards.map((b) => (
                <option key={b.id} value={b.id}>{b.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Item name</label>
            <input
              type="text"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="Enter item name"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createItem.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {createItem.isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Quick Action: Invite Member                                        */
/* ------------------------------------------------------------------ */
function InviteMemberDialog({
  open,
  onClose,
  workspaceId,
}: {
  open: boolean;
  onClose: () => void;
  workspaceId: string;
}) {
  const [email, setEmail] = useState('');
  const invite = trpc.invites.create.useMutation();

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    try {
      await invite.mutateAsync({ workspaceId, email: email.trim(), role: 'MEMBER' });
      setEmail('');
      onClose();
    } catch {
      // handled by tRPC
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">Invite Member</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Email address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="colleague@example.com"
              required
            />
          </div>
          {invite.isSuccess && (
            <p className="text-xs text-green-600 font-medium">Invite sent!</p>
          )}
          {invite.isError && (
            <p className="text-xs text-red-600 font-medium">Failed to send invite</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={invite.isPending}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {invite.isPending ? 'Sending…' : 'Send Invite'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Dashboard                                                     */
/* ------------------------------------------------------------------ */
export function Dashboard({ onSelectBoard, onRequestCreateBoard, onSelectItem }: DashboardProps) {
  const { status } = useSession();
  const isAuthed = status === 'authenticated';
  const [activeTab, setActiveTab] = useState<'overview' | 'activity'>('overview');
  const [showCreateItem, setShowCreateItem] = useState(false);
  const [showInvite, setShowInvite] = useState(false);

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
        <div className="h-20 animate-pulse rounded-xl bg-slate-100" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-slate-100" />
          ))}
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
      {/* Tab switcher */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
          <button
            onClick={() => setActiveTab('overview')}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'bg-white text-foreground shadow-sm'
                : 'text-slate-500 hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            onClick={() => setActiveTab('activity')}
            className={`rounded-md px-4 py-1.5 text-xs font-semibold transition-colors ${
              activeTab === 'activity'
                ? 'bg-white text-foreground shadow-sm'
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
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 transition-colors"
                    type="button"
                  >
                    + New Board
                  </button>
                  <button
                    onClick={() => setShowCreateItem(true)}
                    className="rounded-md border border-primary px-3 py-1.5 text-xs font-semibold text-primary hover:bg-blue-50 transition-colors"
                    type="button"
                  >
                    + New Item
                  </button>
                  <button
                    onClick={() => setShowInvite(true)}
                    className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
                    type="button"
                  >
                    👤 Invite Member
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Stats cards */}
          <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
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
                Completed This Week
              </p>
              <p className="mt-2 text-3xl font-bold text-green-600">
                {stats.completedThisWeek}
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Overdue
              </p>
              <p className={`mt-2 text-3xl font-bold ${stats.overdueCount > 0 ? 'text-red-600' : 'text-foreground'}`}>
                {stats.overdueCount}
              </p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-xl border border-border bg-card p-5 shadow-sm">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Items by Status
              </p>
              <div className="mt-2 space-y-1">
                {statusEntries.length === 0 && (
                  <p className="text-xs text-slate-400 italic">No items yet</p>
                )}
                {statusEntries.map(([s, count]) => (
                  <div key={s} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600 truncate">{s}</span>
                    <span className="font-semibold text-foreground">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Board Summary Cards */}
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-foreground">Boards</h3>
              <button
                className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-primary hover:bg-slate-50 transition-colors"
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
                    className="text-left rounded-xl border border-border p-4 transition-colors hover:bg-slate-50 hover:border-primary/30 group"
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
                      <span className={`text-xs font-semibold ${board.completionPercent === 100 ? 'text-green-600' : 'text-slate-600'}`}>
                        {board.completionPercent}% done
                      </span>
                    </div>
                    {/* Completion bar */}
                    <div className="mt-2 h-1.5 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${board.completionPercent === 100 ? 'bg-green-500' : 'bg-primary'}`}
                        style={{ width: `${board.completionPercent}%` }}
                      />
                    </div>
                    <p className="mt-2 text-[10px] text-slate-300">
                      Updated {formatTimeAgo(new Date(board.updatedAt))}
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
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View all →
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
                      className="w-full text-left flex items-start gap-3 rounded-lg p-2.5 transition-colors hover:bg-slate-50"
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
                          {formatTimeAgo(new Date(entry.createdAt))}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Template Gallery */}
          {stats.workspace && (
            <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
              <TemplateGallery
                workspaceId={stats.workspace.id}
                onBoardCreated={onSelectBoard}
              />
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <CreateItemDialog
        open={showCreateItem}
        onClose={() => setShowCreateItem(false)}
        onCreated={onSelectBoard}
      />
      {stats?.workspace && (
        <InviteMemberDialog
          open={showInvite}
          onClose={() => setShowInvite(false)}
          workspaceId={stats.workspace.id}
        />
      )}
    </div>
  );
}
