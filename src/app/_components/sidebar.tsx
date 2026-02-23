'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';
import { CustomSelect } from './custom_select';

/* ------------------------------------------------------------------ */
/*  SVG Icons                                                           */
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

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 12l4-4-4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type SidebarProps = {
  onSelectBoard: (id: string) => void;
  selectedBoardId: string | null;
  onNavigateDashboard: () => void;
  currentView: 'dashboard' | 'board' | 'settings' | 'activity';
  /** When true, sidebar uses Link elements for proper URL routing */
  useLinks?: boolean;
  /** Collapsible sidebar (desktop) */
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  /** Optional: navigate to settings inline (instead of /settings route) */
  onNavigateSettings?: () => void;
};

export function Sidebar({
  onSelectBoard,
  selectedBoardId,
  onNavigateDashboard,
  currentView,
  useLinks = false,
  collapsed = false,
  onToggleCollapse,
  onNavigateSettings,
}: SidebarProps) {
  const { status } = useSession();
  const pathname = usePathname();
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isSettingsPage = currentView === 'settings' || pathname === '/settings';

  const { data: workspaces } = trpc.workspaces.listMine.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const workspaceList = Array.isArray(workspaces) ? workspaces : [];

  useEffect(() => {
    if (!activeWorkspaceId && workspaceList.length > 0) {
      setActiveWorkspaceId(workspaceList[0].id);
    }
  }, [activeWorkspaceId, workspaceList]);

  const { data: boards } = trpc.boards.listByWorkspace.useQuery(
    { workspaceId: activeWorkspaceId! },
    { enabled: !!activeWorkspaceId }
  );

  const { data: unreadCount = 0 } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    {
      enabled: status === 'authenticated',
      refetchOnWindowFocus: true,
    }
  );

  const workspaceOptions = workspaceList.map((ws) => ({ value: ws.id, label: ws.name }));

  // Full sidebar content (expanded)
  const sidebarContent = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-6 w-6 flex-shrink-0 rounded bg-primary flex items-center justify-center text-white font-bold text-xs">H</div>
          {!collapsed && (
            <p className="text-xs uppercase tracking-wider text-white/80 truncate">Houseworks</p>
          )}
        </div>
        {onToggleCollapse && (
          <button
            type="button"
            className="flex-shrink-0 rounded p-0.5 text-white/50 hover:text-white hover:bg-white/10 transition-colors"
            onClick={onToggleCollapse}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRightIcon /> : <ChevronLeftIcon />}
          </button>
        )}
      </div>

      {/* Dashboard link */}
      {useLinks ? (
        <Link
          href="/"
          onClick={() => setMobileOpen(false)}
          className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
            currentView === 'dashboard'
              ? 'bg-white/10 text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
          title={collapsed ? 'Dashboard' : undefined}
        >
          <DashboardIcon className="flex-shrink-0" />
          {!collapsed && 'Dashboard'}
        </Link>
      ) : (
        <button
          onClick={() => { onNavigateDashboard(); setMobileOpen(false); }}
          className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
            currentView === 'dashboard'
              ? 'bg-white/10 text-white'
              : 'text-white/70 hover:bg-white/5 hover:text-white'
          }`}
          type="button"
          title={collapsed ? 'Dashboard' : undefined}
        >
          <DashboardIcon className="flex-shrink-0" />
          {!collapsed && 'Dashboard'}
        </button>
      )}

      {/* Workspace section */}
      {!collapsed && (
        <div className="space-y-4 flex-1 overflow-y-auto">
          <div className="space-y-1">
            <p className="px-3 text-[10px] uppercase tracking-wider text-white/70">Workspace</p>
            {workspaceList.length > 0 ? (
              <div className="px-1">
                <CustomSelect
                  value={activeWorkspaceId ?? workspaceList[0]?.id ?? ''}
                  options={workspaceOptions}
                  onChange={(val) => setActiveWorkspaceId(val)}
                  placeholder="Select workspace…"
                  renderSelected={(opt) => (
                    <span className="text-white text-xs truncate">{opt?.label ?? 'Select workspace…'}</span>
                  )}
                />
              </div>
            ) : status === 'authenticated' ? (
              <p className="px-3 text-xs text-white/70 italic">No workspaces found</p>
            ) : null}
            <Link
              href="/settings"
              onClick={() => setMobileOpen(false)}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-semibold text-white/80 hover:text-white transition-colors"
            >
              + Create workspace
            </Link>
          </div>

          {activeWorkspaceId && (
            <div className="space-y-1">
              <p className="px-3 text-[10px] uppercase tracking-wider text-white/70">Boards</p>
              <div className="space-y-1 pl-2">
                {boards?.map((board) => (
                  useLinks ? (
                    <Link
                      key={board.id}
                      href={`/?board=${board.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`w-full text-left rounded-lg px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                        selectedBoardId === board.id
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <BoardIcon className="flex-shrink-0" />
                      {board.title}
                    </Link>
                  ) : (
                    <button
                      key={board.id}
                      onClick={() => { onSelectBoard(board.id); setMobileOpen(false); }}
                      className={`w-full text-left rounded-lg px-3 py-1.5 text-xs transition-colors flex items-center gap-2 ${
                        selectedBoardId === board.id
                          ? 'bg-white/20 text-white font-semibold'
                          : 'text-white/70 hover:text-white'
                      }`}
                    >
                      <BoardIcon className="flex-shrink-0" />
                      {board.title}
                    </button>
                  )
                ))}
                {boards?.length === 0 && (
                  <p className="px-3 text-xs text-white/70 italic">No boards yet</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Collapsed: boards as icons */}
      {collapsed && activeWorkspaceId && (
        <div className="flex flex-col items-center gap-1 flex-1 overflow-y-auto">
          {boards?.map((board) => (
            useLinks ? (
              <Link
                key={board.id}
                href={`/?board=${board.id}`}
                onClick={() => setMobileOpen(false)}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors ${
                  selectedBoardId === board.id ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title={board.title}
              >
                <BoardIcon />
              </Link>
            ) : (
              <button
                key={board.id}
                type="button"
                onClick={() => { onSelectBoard(board.id); setMobileOpen(false); }}
                className={`flex h-8 w-8 items-center justify-center rounded-lg text-xs transition-colors ${
                  selectedBoardId === board.id ? 'bg-white/20 text-white' : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
                title={board.title}
              >
                <BoardIcon />
              </button>
            )
          ))}
        </div>
      )}

      {/* Bottom: Settings + Notifications */}
      <div className="mt-auto pt-4 border-t border-white/10 space-y-1">
        {onNavigateSettings ? (
          <button
            type="button"
            onClick={() => { onNavigateSettings(); setMobileOpen(false); }}
            className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
              isSettingsPage ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
            title={collapsed ? 'Settings' : undefined}
          >
            <SettingsIcon className="flex-shrink-0" />
            {!collapsed && 'Settings'}
          </button>
        ) : (
          <Link
            href="/settings"
            onClick={() => setMobileOpen(false)}
            className={`w-full text-left rounded-xl px-3 py-2 text-sm font-semibold transition-colors flex items-center gap-2 ${
              isSettingsPage ? 'bg-white/10 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
            }`}
            title={collapsed ? 'Settings' : undefined}
          >
            <SettingsIcon className="flex-shrink-0" />
            {!collapsed && 'Settings'}
          </Link>
        )}
        <Link
          href="/notifications"
          className="flex items-center justify-between w-full rounded-xl px-3 py-2 text-sm font-semibold transition-colors text-white/70 hover:bg-white/5 hover:text-white"
          title={collapsed ? 'Notifications' : undefined}
        >
          <span className={`flex items-center gap-2 ${collapsed ? 'justify-center w-full' : ''}`}>
            <BellIcon className="flex-shrink-0" />
            {!collapsed && 'Notifications'}
          </span>
          {!collapsed && unreadCount > 0 && (
            <span className="rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-bold text-white shadow-sm">
              {unreadCount}
            </span>
          )}
          {collapsed && unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" />
          )}
        </Link>
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
      <aside
        className={`hidden flex-col gap-4 rounded-xl bg-sidebar-bg text-sm text-slate-300 lg:flex shadow-xl transition-all duration-200 flex-shrink-0 ${
          collapsed ? 'w-14 p-3 items-center' : 'w-56 p-5'
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
