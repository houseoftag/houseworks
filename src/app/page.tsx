'use client';

import { Suspense, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { trpc } from '@/trpc/react';
import { BoardData } from './_components/board_data';
import { Sidebar } from './_components/sidebar';
import { Header } from './_components/header';
import { Dashboard } from './_components/dashboard';
import { NewItemDialog } from './_components/new_item_dialog';
import { ShortcutHelpOverlay } from './_components/shortcut_help_overlay';

type ViewType = 'dashboard' | 'board' | 'settings';

function CreateBoardDialog({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (title: string, workspaceId: string) => void;
  isPending: boolean;
}) {
  const [title, setTitle] = useState('');
  const { data: stats } = trpc.boards.dashboardStats.useQuery();
  const workspaceId = stats?.workspace?.id;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/40" onClick={onClose} />
      <div
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">Create Board</h3>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (title.trim() && workspaceId) onSubmit(title.trim(), workspaceId);
          }}
          className="space-y-3"
        >
          <div>
            <label className="block text-xs font-medium text-slate-500 mb-1">Board name</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-md border border-border px-3 py-2 text-sm"
              placeholder="My new board"
              autoFocus
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
              disabled={isPending || !workspaceId}
              className="rounded-md bg-primary px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isPending ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-background" />}>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Derive view state from URL search params
  const selectedBoardId = searchParams?.get('board') ?? null;
  const currentView: 'dashboard' | 'board' | 'settings' =
    selectedBoardId ? 'board' : 'dashboard';

  const [showCreateBoard, setShowCreateBoard] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });

  useEffect(() => {
    localStorage.setItem('sidebar-collapsed', String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  const utils = trpc.useUtils();
  const createBoard = trpc.boards.create.useMutation({
    onSuccess: (board) => {
      utils.boards.dashboardStats.invalidate();
      utils.boards.listByWorkspace.invalidate({ workspaceId: board.workspaceId });
      setShowCreateBoard(false);
      handleSelectBoard(board.id);
    },
  });

  const handleRequestCreateBoard = useCallback(() => {
    setShowCreateBoard(true);
  }, []);

  const navigateDashboard = useCallback(() => {
    router.push('/');
  }, [router]);

  const handleSelectBoard = useCallback((id: string) => {
    router.push(`/?board=${id}`);
  }, [router]);

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      <Sidebar
        onSelectBoard={handleSelectBoard}
        selectedBoardId={selectedBoardId}
        onNavigateDashboard={navigateDashboard}
        currentView={currentView}
        useLinks
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed((v) => !v)}
        onNavigateSettings={() => router.push('/settings')}
      />

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header onSelectBoard={handleSelectBoard} onSelectItem={(_, boardId) => handleSelectBoard(boardId)} />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          {currentView === 'dashboard' ? (
            <Dashboard
              onSelectBoard={handleSelectBoard}
              onRequestCreateBoard={handleRequestCreateBoard}
            />
          ) : (
            <BoardData
              boardId={selectedBoardId}
              onRequestCreateBoard={handleRequestCreateBoard}
              onNavigateDashboard={navigateDashboard}
            />
          )}
        </main>
      </div>

      <NewItemDialog />
      <ShortcutHelpOverlay />
      {showCreateBoard && (
        <CreateBoardDialog
          onClose={() => setShowCreateBoard(false)}
          onSubmit={(title, workspaceId) => {
            createBoard.mutate({ workspaceId, title });
          }}
          isPending={createBoard.isPending}
        />
      )}
    </div>
  );
}
