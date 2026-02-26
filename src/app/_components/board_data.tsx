'use client';

import { useState } from 'react';
import Link from 'next/link';
import { skipToken } from '@tanstack/react-query';
import { trpc } from '@/trpc/react';
import { BoardTable } from './board_table';
import { AutomationPanel } from './automation_panel';
import { type BoardFilters, type BoardSort } from './board_filters';
import { BoardHeader } from './board_header';
import { SaveTemplateDialog } from './save_template_dialog';
import { DuplicateBoardDialog } from './duplicate_board_dialog';
import { useSession } from 'next-auth/react';
import { useToast } from './toast_provider';

const DEFAULT_FILTERS: BoardFilters = { status: null, person: null, priority: null, dueDateFrom: null, dueDateTo: null };
const DEFAULT_SORT: BoardSort = { field: 'manual', dir: 'asc' };

export function BoardData({ boardId, onRequestCreateBoard, onNavigateDashboard }: { boardId: string | null; onRequestCreateBoard?: () => void; onNavigateDashboard?: () => void }) {
  const { status } = useSession();
  const isAuthed = status === 'authenticated';
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<BoardSort>(DEFAULT_SORT);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showDuplicateBoard, setShowDuplicateBoard] = useState(false);
  const [showAutomationPanel, setShowAutomationPanel] = useState(false);
  const [showCreateGroup, setShowCreateGroup] = useState(false);
  // Refetch only when window gains focus (user returns to tab)
  // Don't poll constantly - mutations trigger invalidation for user's own changes
  const freshnessQueryOptions = {
    refetchOnWindowFocus: true,
    staleTime: 30_000, // Consider data fresh for 30s
  } as const;

  const {
    data: defaultBoard,
    isLoading: loadingDefault,
  } = trpc.boards.getDefault.useQuery(undefined, {
    ...freshnessQueryOptions,
    enabled: isAuthed && !boardId,
  });

  const specificBoardInput = isAuthed && boardId ? { id: boardId } : skipToken;
  const {
    data: specificBoard,
    isLoading: loadingSpecific,
  } = trpc.boards.getById.useQuery(specificBoardInput, freshnessQueryOptions);

  const data = boardId ? specificBoard : defaultBoard;

  const { data: members } = trpc.workspaces.members.useQuery(
    data?.workspaceId ? { workspaceId: data.workspaceId } : skipToken,
    { enabled: !!data?.workspaceId },
  );

  const isLoading = boardId ? loadingSpecific : loadingDefault;

  const deleteBoard = trpc.boards.delete.useMutation({
    onSuccess: async (_result, variables) => {
      await Promise.all([
        utils.boards.dashboardStats.invalidate(),
        utils.boards.getDefault.invalidate(),
        utils.boards.getById.invalidate({ id: variables.id }),
        data?.workspaceId
          ? utils.boards.listByWorkspace.invalidate({ workspaceId: data.workspaceId })
          : Promise.resolve(),
      ]);

      pushToast({ title: 'Board deleted', tone: 'success' });
      onNavigateDashboard?.();
      if (!onNavigateDashboard) {
        window.location.href = '/';
      }
    },
    onError: () => {
      pushToast({
        title: 'Delete failed',
        description: 'Unable to delete this board.',
        tone: 'error',
      });
    },
  });

  if (!isAuthed) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-slate-500 shadow-sm">
        <p>You need to sign in to access your workspace.</p>
        <Link
          className="mt-4 inline-flex rounded-md bg-primary px-6 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20"
          href="/sign-in"
        >
          Sign in
        </Link>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-40 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          <div className="mt-4 h-4 w-80 animate-pulse rounded bg-background" />
        </div>
        <div className="h-80 rounded-xl border border-border bg-card p-8 shadow-sm">
          <div className="h-4 w-32 animate-pulse rounded bg-muted" />
          <div className="mt-6 space-y-4">
            <div className="h-12 animate-pulse rounded bg-background" />
            <div className="h-12 animate-pulse rounded bg-background" />
            <div className="h-12 animate-pulse rounded bg-background" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-card p-8 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-background flex items-center justify-center text-slate-400">
            <span className="text-2xl">📋</span>
          </div>
          <h3 className="mt-4 text-sm font-bold text-foreground">No boards found</h3>
          <p className="mt-2 text-xs text-slate-500">
            Create your first board to get started. Use <span className="font-semibold">Workspace Management → BOARD</span> below.
          </p>
          <button
            className="mt-4 rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20"
            onClick={() => onRequestCreateBoard?.()}
            type="button"
          >
            Create your first board
          </button>
        </div>
      </div>
    );
  }

  const hasGroups = Array.isArray((data as { groups?: unknown } | undefined)?.groups);
  const hasColumns = Array.isArray((data as { columns?: unknown } | undefined)?.columns);

  if (!hasGroups || !hasColumns) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-6 text-sm text-rose-500">
          <p className="font-bold">Board configuration is incomplete.</p>
          <p className="mt-2 text-xs text-rose-600/80 leading-relaxed">
            Some essential data (groups or columns) could not be loaded for this board.
            Please try refreshing the page or contact support if the issue persists.
          </p>
        </div>
      </div>
    );
  }

  const memberOptions =
    members?.map((m) => ({
      id: m.user.id,
      name: m.user.name ?? m.user.email ?? 'Unknown',
    })) ?? [];

  const boardTitle = (data as { title?: string }).title ?? 'Untitled Board';
  const workspaceName = (data as { workspace?: { name?: string } }).workspace?.name ?? 'Workspace';

  return (
    <div className="h-full flex flex-col">
      {showAutomationPanel && (
        <AutomationPanel board={data} />
      )}

      <BoardTable
        seamlessTop={!showAutomationPanel}
        headerSlot={!showAutomationPanel ? (
          <BoardHeader
            borderless
            boardName={boardTitle}
            memberCount={memberOptions.length}
            onManageAutomations={() => setShowAutomationPanel((prev) => !prev)}
            onCreateGroup={() => setShowCreateGroup(true)}
            onSaveAsTemplate={() => setShowSaveTemplate(true)}
            onDuplicateBoard={() => setShowDuplicateBoard(true)}
            onDeleteBoard={() => {
              if (deleteBoard.isPending) return;
              if (window.confirm(`Delete board "${boardTitle}"? This cannot be undone.`)) {
                deleteBoard.mutate({ id: data.id });
              }
            }}
            isDeleting={deleteBoard.isPending}
          />
        ) : undefined}
        showCreateGroup={showCreateGroup}
        onCreateGroupChange={setShowCreateGroup}
        board={data}
        filters={filters}
        sort={sort}
        onFiltersChange={setFilters}
        onSortChange={setSort}
      />

      {showSaveTemplate && (
        <SaveTemplateDialog
          boardId={data.id}
          boardTitle={boardTitle}
          onClose={() => setShowSaveTemplate(false)}
        />
      )}

      {showDuplicateBoard && (
        <DuplicateBoardDialog
          boardId={data.id}
          boardTitle={boardTitle}
          onClose={() => setShowDuplicateBoard(false)}
          onDuplicated={(newId) => {
            // Navigate to the duplicated board if we have a way
            // For now just stay on current board
            void newId;
          }}
        />
      )}
    </div>
  );
}
