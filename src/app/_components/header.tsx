'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { trpc } from '@/trpc/react';
import { NotificationBell } from './notification_bell';
import { SearchCommand } from './search_command';

export function Header({
  onSelectBoard,
  onSelectItem,
  breadcrumb = 'Houseworks — Workspace Overview',
  titleElement: TitleEl = 'h1',
}: {
  onSelectBoard?: (boardId: string) => void;
  onSelectItem?: (itemId: string, boardId: string) => void;
  breadcrumb?: string;
  titleElement?: 'h1' | 'p';
} = {}) {
  const { data: session, status } = useSession();
  const { data: stats } = trpc.boards.dashboardStats.useQuery(undefined, {
    enabled: status === 'authenticated',
  });
  const workspaceName = stats?.workspace?.name ?? 'Workspace';

  return (
    <header className="flex flex-shrink-0 flex-wrap items-center justify-between gap-2 sm:gap-4 px-4 py-4 lg:px-6">
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold tracking-wider text-slate-400 truncate">
          {breadcrumb}
        </p>
        <TitleEl className="text-lg sm:text-2xl font-bold tracking-tight text-foreground truncate">
          {workspaceName}
        </TitleEl>
      </div>
      <div className="flex items-center gap-4">
        {session && <SearchCommand onSelectBoard={onSelectBoard} onSelectItem={onSelectItem} />}
        {session && <NotificationBell />}
        {!session ? (
          <Link
            href="/sign-in"
            className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-background"
          >
            Sign in
          </Link>
        ) : (
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <button
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="min-h-[44px] px-2 text-xs font-medium text-slate-400 hover:text-foreground transition-colors"
            >
              Sign out
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
              {session.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
          </div>
        )}
{/* New Board button removed — no handler wired (UX-HW-025) */}
      </div>
    </header>
  );
}
