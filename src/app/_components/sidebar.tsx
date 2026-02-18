'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';

/* ------------------------------------------------------------------ */
/*  SVG Icons (replacing emoji for cross-platform consistency)         */
/* ------------------------------------------------------------------ */
function DashboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="1" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
      <rect x="9" y="9" width="6" height="6" rx="1" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BoardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="2" width="14" height="12" rx="2" stroke="currentColor" strokeWidth="1.5" />
      <path d="M5.5 2v12M10.5 2v12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 13a2 2 0 004 0M3.5 6.5a4.5 4.5 0 019 0c0 2.5 1 4 1.5 5H2c.5-1 1.5-2.5 1.5-5z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ActivityIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1 8h3l2-5 3 10 2-5h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 10a2 2 0 100-4 2 2 0 000 4z" stroke="currentColor" strokeWidth="1.5" />
      <path d="M13.7 6.3l-.7-.4a4.9 4.9 0 00-.5-.9l.1-.8a.5.5 0 00-.2-.5l-1-1a.5.5 0 00-.5-.1l-.8.1a4.9 4.9 0 00-.9-.5l-.4-.7a.5.5 0 00-.4-.3H7.1a.5.5 0 00-.4.3l-.4.7c-.3.1-.6.3-.9.5l-.8-.1a.5.5 0 00-.5.2l-1 1a.5.5 0 00-.1.5l.1.8c-.2.3-.4.6-.5.9l-.7.4a.5.5 0 00-.3.4v1.4a.5.5 0 00.3.4l.7.4c.1.3.3.6.5.9l-.1.8a.5.5 0 00.2.5l1 1a.5.5 0 00.5.1l.8-.1c.3.2.6.4.9.5l.4.7a.5.5 0 00.4.3h1.4a.5.5 0 00.4-.3l.4-.7c.3-.1.6-.3.9-.5l.8.1a.5.5 0 00.5-.2l1-1a.5.5 0 00.1-.5l-.1-.8c.2-.3.4-.6.5-.9l.7-.4a.5.5 0 00.3-.4V6.7a.5.5 0 00-.3-.4z" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

type SidebarProps = {
  onSelectBoard: (id: string) => void;
  selectedBoardId: string | null;
  onNavigateDashboard: () => void;
  onNavigateActivity?: () => void;
  currentView: 'dashboard' | 'board' | 'settings' | 'activity';
};

export function Sidebar({ onSelectBoard, selectedBoardId, onNavigateDashboard, onNavigateActivity, currentView }: SidebarProps) {
  const { status } = useSession();
  const pathname = usePathname();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSettingsPage = pathname === '/settings';

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

  const sidebarContent = (
    <>
      <div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary flex items-center justify-center text-white font-bold text-xs">H</div>
          <p className="text-xs uppercase tracking-wider text-white/80">
            Houseworks
          </p>
        </div>
      </div>

      {/* Dashboard link */}
      <button
        onClick={() => { onNavigateDashboard(); setMobileOpen(false); }}
        className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
          currentView === 'dashboard'
            ? 'bg-white/10 text-white'
            : 'text-white/70 hover:bg-white/5 hover:text-white'
        }`}
        type="button"
      >
        <DashboardIcon className="flex-shrink-0" />
        Dashboard
      </button>

      {/* Activity feed link */}
      {onNavigateActivity && (
        <button
          onClick={() => { onNavigateActivity(); setMobileOpen(false); }}
          className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
            currentView === 'activity'
              ? 'bg-white/10 text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
          type="button"
        >
          <ActivityIcon className="flex-shrink-0" />
          Activity
        </button>
      )}

      <div className="space-y-4 flex-1 overflow-y-auto">
        <div className="space-y-1">
          <p className="px-3 text-[10px] uppercase tracking-wider text-white/70">Your workspaces</p>
          {workspaceList.map((workspace) => (
            <button
              key={workspace.id}
              onClick={() => setActiveWorkspaceId(workspace.id)}
              className={`w-full text-left rounded-xl px-3 py-2 transition-colors ${activeWorkspaceId === workspace.id
                ? 'bg-white/10 text-white'
                : 'text-white/70 hover:bg-white/5 hover:text-white'
                }`}
            >
              {workspace.name}
            </button>
          ))}
          {workspaceList.length === 0 && status === 'authenticated' && (
            <p className="px-3 text-xs text-white/70 italic">No workspaces found</p>
          )}
        </div>

        {activeWorkspaceId && (
          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase tracking-wider text-white/70">Boards</p>
            <div className="space-y-1 pl-2">
              {boards?.map((board) => (
                <button
                  key={board.id}
                  onClick={() => { onSelectBoard(board.id); setMobileOpen(false); }}
                  className={`w-full text-left rounded-lg px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${selectedBoardId === board.id
                    ? 'bg-white/20 text-white font-semibold'
                    : 'text-white/70 hover:text-white'
                    }`}
                >
                  <BoardIcon className="flex-shrink-0" />
                  {board.title}
                </button>
              ))}
              {boards?.length === 0 && (
                <p className="px-3 text-xs text-white/70 italic">No boards yet</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mt-auto pt-4 border-t border-white/10 space-y-3 text-xs text-white/70">
        <Link
          href="/settings"
          onClick={() => setMobileOpen(false)}
          className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
            isSettingsPage
              ? 'bg-white/10 text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
        >
          <SettingsIcon className="flex-shrink-0" />
          Settings
        </Link>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <BellIcon className="flex-shrink-0" />
            Notifications
          </span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {unreadCount}
            </span>
          )}
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile hamburger button */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed left-4 top-4 z-40 flex h-10 w-10 items-center justify-center rounded-lg bg-sidebar-bg text-white shadow-lg lg:hidden"
        aria-label="Open navigation menu"
        type="button"
      >
        <MenuIcon />
      </button>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative flex w-64 h-full flex-col gap-6 bg-sidebar-bg p-6 text-sm text-slate-300 shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-white/70 hover:text-white"
              aria-label="Close navigation menu"
              type="button"
            >
              <CloseIcon />
            </button>
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden w-64 flex-col gap-6 rounded-xl bg-sidebar-bg p-6 text-sm text-slate-300 lg:flex shadow-xl">
        {sidebarContent}
      </aside>
    </>
  );
}
