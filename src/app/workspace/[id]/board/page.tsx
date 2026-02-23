'use client';

import { use, useState } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { skipToken } from '@tanstack/react-query';
import { trpc } from '@/trpc/react';
import { BoardTable } from '@/app/_components/board_table';
import { AutomationPanel } from '@/app/_components/automation_panel';
import { type BoardFilters, type BoardSort } from '@/app/_components/board_filters';
import { BoardHeader } from '@/app/_components/board_header';
import { Breadcrumbs } from '@/app/_components/breadcrumbs';
import { useToast } from '@/app/_components/toast_provider';

export default function WorkspaceBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: boardId } = use(params);
  const router = useRouter();
  const { status } = useSession();
  const isAuthed = status === 'authenticated';
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [filters, setFilters] = useState<BoardFilters>({
    status: null,
    person: null,
    priority: null,
    dueDateFrom: null,
    dueDateTo: null,
  });
  const [sort, setSort] = useState<BoardSort>({ field: 'manual', dir: 'asc' });
  const [showAutomationPanel, setShowAutomationPanel] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);

  const { data: board, isLoading } = trpc.boards.getById.useQuery(
    isAuthed ? { id: boardId } : skipToken,
  );

  const deleteBoard = trpc.boards.delete.useMutation({
    onSuccess: async (_result, variables) => {
      await Promise.all([
        utils.boards.dashboardStats.invalidate(),
        utils.boards.getDefault.invalidate(),
        utils.boards.getById.invalidate({ id: variables.id }),
        board?.workspaceId
          ? utils.boards.listByWorkspace.invalidate({ workspaceId: board.workspaceId })
          : Promise.resolve(),
      ]);

      pushToast({ title: 'Board deleted', tone: 'success' });
      router.push('/');
      router.refresh();
    },
    onError: () => {
      pushToast({
        title: 'Delete failed',
        description: 'Unable to delete this board.',
        tone: 'error',
      });
    },
  });

  const { data: members } = trpc.workspaces.members.useQuery(
    board?.workspaceId ? { workspaceId: board.workspaceId } : skipToken,
    { enabled: !!board?.workspaceId },
  );

  const { data: boardViews } = trpc.boardViews.list.useQuery(
    isAuthed ? { boardId } : skipToken,
  );

  const createView = trpc.boardViews.create.useMutation({
    onSuccess: async () => {
      await utils.boardViews.list.invalidate({ boardId });
    },
  });

  const deleteView = trpc.boardViews.delete.useMutation({
    onSuccess: async (_, variables) => {
      if (activeViewId === variables.id) setActiveViewId(null);
      await utils.boardViews.list.invalidate({ boardId });
    },
  });

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
      <div className="mx-auto max-w-7xl px-2 py-3 sm:px-4 sm:py-6 lg:px-8 space-y-4 sm:space-y-6 overflow-x-hidden">
        <Breadcrumbs
          items={[
            { label: workspaceName, onClick: undefined },
            { label: boardTitle, onClick: undefined },
            { label: 'Table View' },
          ]}
        />

        <BoardHeader
          boardName={boardTitle}
          memberCount={memberOptions.length}
          onManageAutomations={() => setShowAutomationPanel((prev) => !prev)}
          onDeleteBoard={() => {
            if (deleteBoard.isPending) return;
            if (window.confirm(`Delete board "${boardTitle}"? This cannot be undone.`)) {
              deleteBoard.mutate({ id: board.id });
            }
          }}
          isDeleting={deleteBoard.isPending}
          onOpenSearch={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
          }}
          views={boardViews ?? []}
          activeViewId={activeViewId}
          onViewSelect={(viewId) => {
            setActiveViewId(viewId);
            if (viewId === null) {
              setFilters({ status: null, person: null, priority: null, dueDateFrom: null, dueDateTo: null });
              setSort({ field: 'manual', dir: 'asc' });
            } else {
              const view = boardViews?.find((v) => v.id === viewId);
              if (view) {
                const f = view.filters as typeof filters;
                const s = view.sort as typeof sort;
                setFilters({ status: null, person: null, priority: null, dueDateFrom: null, dueDateTo: null, ...f });
                setSort({ field: 'manual', dir: 'asc', ...s });
              }
            }
          }}
          onViewDelete={(viewId) => deleteView.mutate({ id: viewId })}
          onSaveView={(name) => {
            createView.mutate({ boardId, name, filters, sort });
          }}
        />

        <AutomationPanel
          board={board}
          open={showAutomationPanel}
          onClose={() => setShowAutomationPanel(false)}
        />

        <BoardTable
          board={board}
          filters={filters}
          sort={sort}
          onFiltersChange={setFilters}
          onSortChange={setSort}
        />
      </div>
    </div>
  );
}
