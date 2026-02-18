'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { skipToken } from '@tanstack/react-query';
import { trpc } from '@/trpc/react';
import { BoardTable } from './board_table';
import { BoardKanban } from './board_kanban';
import { BoardTimeline } from './board_timeline';
import { BoardFiltersBar, type BoardFilters, type BoardSort } from './board_filters';
import { BoardHeader } from './board_header';
import { Breadcrumbs } from './breadcrumbs';
import { SaveTemplateDialog } from './save_template_dialog';
import { DuplicateBoardDialog } from './duplicate_board_dialog';
import { useSession } from 'next-auth/react';

const BOARD_FRESHNESS_POLL_MS = 5_000;

type ViewMode = 'table' | 'board' | 'timeline';

function useUrlViewMode(): [ViewMode, (mode: ViewMode) => void] {
  const [viewMode, setViewModeState] = useState<ViewMode>(() => {
    if (typeof window === 'undefined') return 'table';
    const params = new URLSearchParams(window.location.search);
    const v = params.get('view');
    if (v === 'board' || v === 'timeline') return v;
    return 'table';
  });

  const setViewMode = useCallback((mode: ViewMode) => {
    setViewModeState(mode);
    const url = new URL(window.location.href);
    if (mode === 'table') {
      url.searchParams.delete('view');
    } else {
      url.searchParams.set('view', mode);
    }
    window.history.replaceState({}, '', url.toString());
  }, []);

  return [viewMode, setViewMode];
}

const DEFAULT_FILTERS: BoardFilters = { status: null, person: null, priority: null, dueDateFrom: null, dueDateTo: null };
const DEFAULT_SORT: BoardSort = { field: 'created', dir: 'desc' };

export function BoardData({ boardId, onRequestCreateBoard, onNavigateDashboard }: { boardId: string | null; onRequestCreateBoard?: () => void; onNavigateDashboard?: () => void }) {
  const { status } = useSession();
  const isAuthed = status === 'authenticated';
  const [viewMode, setViewMode] = useUrlViewMode();
  const [filters, setFilters] = useState<BoardFilters>(DEFAULT_FILTERS);
  const [sort, setSort] = useState<BoardSort>(DEFAULT_SORT);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showDuplicateBoard, setShowDuplicateBoard] = useState(false);
  const freshnessQueryOptions = {
    refetchInterval: BOARD_FRESHNESS_POLL_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
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

  if (!isAuthed) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 text-sm text-slate-500 shadow-sm">
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
        <div className="h-40 rounded-xl border border-border bg-white p-8 shadow-sm">
          <div className="h-5 w-48 animate-pulse rounded bg-slate-100" />
          <div className="mt-4 h-4 w-80 animate-pulse rounded bg-slate-50" />
        </div>
        <div className="h-80 rounded-xl border border-border bg-white p-8 shadow-sm">
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
          <div className="mt-6 space-y-4">
            <div className="h-12 animate-pulse rounded bg-slate-50" />
            <div className="h-12 animate-pulse rounded bg-slate-50" />
            <div className="h-12 animate-pulse rounded bg-slate-50" />
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-400">
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
        <div className="rounded-xl border border-rose-100 bg-rose-50 p-6 text-sm text-rose-700">
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
    <div className="space-y-6 pb-20">
      <Breadcrumbs
        items={[
          { label: workspaceName, onClick: onNavigateDashboard },
          { label: boardTitle, onClick: undefined },
          { label: viewMode === 'table' ? 'Table View' : viewMode === 'timeline' ? 'Timeline View' : 'Board View' },
        ]}
      />

      <BoardHeader
        boardName={boardTitle}
        memberCount={memberOptions.length}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onSaveAsTemplate={() => setShowSaveTemplate(true)}
        onDuplicateBoard={() => setShowDuplicateBoard(true)}
      />

      <BoardFiltersBar
        board={data}
        filters={filters}
        sort={sort}
        onChange={setFilters}
        onSortChange={setSort}
        memberOptions={memberOptions}
      />

      {viewMode === 'table' ? (
        <BoardTable board={data} filters={filters} sort={sort} />
      ) : viewMode === 'timeline' ? (
        <BoardTimeline board={data} filters={filters} sort={sort} />
      ) : (
        <BoardKanban board={data} filters={filters} sort={sort} />
      )}

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
