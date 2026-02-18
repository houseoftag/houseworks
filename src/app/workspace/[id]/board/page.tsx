'use client';

import { use, useState, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { skipToken } from '@tanstack/react-query';
import { trpc } from '@/trpc/react';
import { BoardKanbanFull } from '@/app/_components/board_kanban_full';
import { BoardTable } from '@/app/_components/board_table';
import { BoardTimeline } from '@/app/_components/board_timeline';

type ViewMode = 'table' | 'board' | 'timeline';
import { BoardFiltersBar, type BoardFilters, type BoardSort } from '@/app/_components/board_filters';
import { BoardHeader } from '@/app/_components/board_header';
import { Breadcrumbs } from '@/app/_components/breadcrumbs';

export default function WorkspaceBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: boardId } = use(params);
  const { status } = useSession();
  const isAuthed = status === 'authenticated';
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'board';
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v === 'table' || v === 'board' || v === 'timeline') return v;
    return 'board';
  });
  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    const url = new URL(window.location.href);
    if (mode === 'board') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', mode);
    }
    window.history.replaceState({}, '', url.toString());
  }, []);
  const [filters, setFilters] = useState<BoardFilters>({ status: null, person: null });
  const [sort, setSort] = useState<BoardSort>({ field: 'created', dir: 'desc' });

  const { data: board, isLoading } = trpc.boards.getById.useQuery(
    isAuthed ? { id: boardId } : skipToken,
  );

  const { data: members } = trpc.workspaces.members.useQuery(
    board?.workspaceId ? { workspaceId: board.workspaceId } : skipToken,
    { enabled: !!board?.workspaceId },
  );

  if (!isAuthed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-white p-6 text-sm text-slate-500 shadow-sm">
          <p>You need to sign in to access this board.</p>
          <Link
            className="mt-4 inline-flex rounded-md bg-primary px-6 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20"
            href="/sign-in"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="h-12 w-64 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-96 animate-pulse rounded-2xl bg-slate-50" />
        </div>
      </div>
    );
  }

  if (!board) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
          <h3 className="text-sm font-bold text-foreground">Board not found</h3>
          <p className="mt-2 text-xs text-slate-500">This board may have been deleted or you don&apos;t have access.</p>
          <Link href="/" className="mt-4 inline-flex rounded-md bg-primary px-6 py-2 text-xs font-semibold text-white">
            Go to dashboard
          </Link>
        </div>
      </div>
    );
  }

  const memberOptions =
    members?.map((m) => ({
      id: m.user.id,
      name: m.user.name ?? m.user.email ?? 'Unknown',
    })) ?? [];

  const boardTitle = board.title ?? 'Untitled Board';
  const workspaceName = board.workspace?.name ?? 'Workspace';

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 space-y-6">
        <Breadcrumbs
          items={[
            { label: workspaceName, onClick: undefined },
            { label: boardTitle, onClick: undefined },
            { label: viewMode === 'table' ? 'Table View' : viewMode === 'timeline' ? 'Timeline View' : 'Board View' },
          ]}
        />

        <BoardHeader
          boardName={boardTitle}
          memberCount={memberOptions.length}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <BoardFiltersBar
          board={board}
          filters={filters}
          sort={sort}
          onChange={setFilters}
          onSortChange={setSort}
          memberOptions={memberOptions}
        />

        {viewMode === 'table' ? (
          <BoardTable board={board} filters={filters} sort={sort} />
        ) : viewMode === 'timeline' ? (
          <BoardTimeline board={board} filters={filters} sort={sort} />
        ) : (
          <BoardKanbanFull board={board} filters={filters} memberOptions={memberOptions} />
        )}
      </div>
    </div>
  );
}
