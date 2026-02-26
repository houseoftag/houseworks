'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { Sidebar } from '../_components/sidebar';
import { Header } from '../_components/header';
import { WorkspaceActivityPage } from '../_components/workspace_activity_page';
import { NewItemDialog } from '../_components/new_item_dialog';
import { ShortcutHelpOverlay } from '../_components/shortcut_help_overlay';

export default function ActivityPage() {
  const router = useRouter();

  useEffect(() => { document.title = 'Activity — Houseworks'; }, []);

  const handleSelectBoard = (id: string) => {
    router.push(`/?board=${id}`);
  };

  return (
    <div className="h-screen overflow-hidden bg-background text-foreground flex">
      <Sidebar
        onSelectBoard={handleSelectBoard}
        selectedBoardId={null}
        onNavigateDashboard={() => router.push('/')}
        currentView="dashboard"
        useLinks
      />

      <div className="flex flex-col flex-1 min-w-0 h-full overflow-hidden">
        <Header
          onSelectBoard={handleSelectBoard}
          onSelectItem={(_, boardId) => handleSelectBoard(boardId)}
          breadcrumb="Houseworks — Activity"
          titleElement="p"
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">
          <WorkspaceActivityPage onSelectBoard={handleSelectBoard} />
        </main>
        <footer className="flex-shrink-0 border-t border-border px-4 py-3 text-[10px] text-slate-400 lg:px-6">
          Houseworks
        </footer>
      </div>

      <NewItemDialog />
      <ShortcutHelpOverlay />
    </div>
  );
}
