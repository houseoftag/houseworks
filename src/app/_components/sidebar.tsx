'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';

type SidebarProps = {
  onSelectBoard: (id: string) => void;
  selectedBoardId: string | null;
};

export function Sidebar({ onSelectBoard, selectedBoardId }: SidebarProps) {
  const { status } = useSession();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);

  const { data: workspaces } = trpc.workspaces.listMine.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const workspaceList = Array.isArray(workspaces) ? workspaces : [];

  const { data: boards } = trpc.boards.listByWorkspace.useQuery(
    { workspaceId: activeWorkspaceId! },
    { enabled: !!activeWorkspaceId }
  );

  const { data: unreadCount = 0 } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    {
      enabled: status === 'authenticated',
      refetchInterval: 10000
    }
  );

  return (
    <aside className="hidden w-64 flex-col gap-6 rounded-2xl bg-sidebar-bg p-6 text-sm text-slate-300 lg:flex shadow-xl">
      <div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-white font-bold text-xs">H</div>
          <p className="text-xs uppercase tracking-[0.3em] text-white/60">
            Houseworks
          </p>
        </div>
        <h1 className="mt-4 text-lg font-semibold text-white">
          Workspaces
        </h1>
      </div>

      <div className="space-y-4 flex-1 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 text-[10px] uppercase tracking-wider text-white/40">Your Workspaces</p>
          {workspaceList.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => setActiveWorkspaceId(workspace.id)}
              className={`w-full text-left rounded-xl px-3 py-2 transition-colors ${activeWorkspaceId === workspace.id
                ? 'bg-white/10 text-white'
                : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
            >
              {workspace.name}
            </button>
          ))}
          {workspaceList.length === 0 && status === 'authenticated' && (
            <p className="px-3 text-xs text-white/30 italic">No workspaces found</p>
          )}
        </div>

        {activeWorkspaceId && (
          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase tracking-wider text-white/40">Boards</p>
            <div className="space-y-1 pl-2">
              {boards?.map((board) => (
                <button
                  key={board.id}
                  onClick={() => onSelectBoard(board.id)}
                  className={`w-full text-left rounded-lg px-3 py-1.5 text-xs transition-colors ${selectedBoardId === board.id
                    ? 'bg-white/20 text-white'
                    : 'text-white/40 hover:text-white'
                    }`}
                >
                  {board.title}
                </button>
              ))}
              {boards?.length === 0 && (
                <p className="px-3 text-xs text-white/30 italic">No boards yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-white/10 space-y-3 text-xs text-white/40">
        <div className="flex items-center justify-between">
          <span>Notifications</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </aside>
  );
}
