'use client';

import { useRouter } from 'next/navigation';
import { Sidebar } from '../_components/sidebar';
import { Header } from '../_components/header';
import { WorkspaceActivityPage } from '../_components/workspace_activity_page';
import { NewItemDialog } from '../_components/new_item_dialog';
import { ShortcutHelpOverlay } from '../_components/shortcut_help_overlay';

export default function ActivityPage() {
  const router = useRouter();

  const handleSelectBoard = (id: string) => {
    router.push(`/?board=${id}`);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen w-full gap-8 px-4 pt-16 pb-10 lg:px-8 lg:pt-10">
        <Sidebar
          onSelectBoard={handleSelectBoard}
          selectedBoardId={null}
          onNavigateDashboard={() => router.push('/')}
          onNavigateActivity={() => {}}
          currentView="activity"
        />

        <main className="flex-1 space-y-8">
          <Header onSelectBoard={handleSelectBoard} onSelectItem={(_, boardId) => handleSelectBoard(boardId)} />
          <WorkspaceActivityPage onSelectBoard={handleSelectBoard} />
        </main>
      </div>

      <NewItemDialog />
      <ShortcutHelpOverlay />
    </div>
  );
}
