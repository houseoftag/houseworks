'use client';

import { useState } from 'react';
import { BoardData } from './_components/board_data';
import { WorkspaceControls } from './_components/workspace_controls';
import { Sidebar } from './_components/sidebar';
import { Header } from './_components/header';

export default function Home() {
  const [selectedBoardId, setSelectedBoardId] = useState<string | null>(null);
  const [workspaceControlsTab, setWorkspaceControlsTab] = useState<
    'WORKSPACE' | 'BOARD' | 'TEAM'
  >('WORKSPACE');

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen w-full gap-8 px-8 py-10">
        <Sidebar onSelectBoard={setSelectedBoardId} selectedBoardId={selectedBoardId} />

        <main className="flex-1 space-y-8">
          <Header />

          <BoardData
            boardId={selectedBoardId}
            onRequestCreateBoard={() => {
              setWorkspaceControlsTab('BOARD');
              document.getElementById('workspace-controls-section')?.scrollIntoView({
                behavior: 'smooth',
                block: 'start',
              });
            }}
          />

          <section className="grid gap-6 lg:grid-cols-[1.2fr_2fr]">
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">
                Today&apos;s Focus
              </h3>
              <p className="mt-2 text-sm text-slate-500">
                Track editorial progress, delivery dates, and ownership across
                your workspace. Drag and drop, automations, and updates will
                come online as we build out the flow.
              </p>
              <div className="mt-6 space-y-4 text-xs text-slate-500">
                <div className="flex items-center justify-between">
                  <span>Overdue items</span>
                  <span className="font-semibold text-rose-500">2</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Items in review</span>
                  <span className="font-semibold text-amber-500">4</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Ready to deliver</span>
                  <span className="font-semibold text-emerald-500">1</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">
                Automations (Preview)
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-slate-500">
                <li>When status changes to Done → notify producer</li>
                <li>When due date arrives → create follow-up task</li>
                <li>When item created → set status to Backlog</li>
              </ul>
              <button className="mt-6 rounded-full border border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary hover:bg-slate-50 transition-colors">
                Build Automation
              </button>
            </div>
          </section>

          <section id="workspace-controls-section">
            <WorkspaceControls requestedTab={workspaceControlsTab} />
          </section>
        </main>
      </div>
    </div>
  );
}
