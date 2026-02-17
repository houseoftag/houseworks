'use client';

import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { NotificationBell } from './notification_bell';

export function Header() {
  const { data: session } = useSession();

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Houseworks — Workspace Overview
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Post-Production Hub
        </h2>
      </div>
      <div className="flex items-center gap-4">
        {session && <NotificationBell />}
        {!session ? (
          <Link
            href="/sign-in"
            className="rounded-md border border-border px-4 py-2 text-xs font-semibold text-foreground transition hover:bg-slate-50"
          >
            Sign in
          </Link>
        ) : (
          <div className="flex items-center gap-3 border-l border-border pl-4">
            <button
              onClick={() => signOut({ callbackUrl: '/sign-in' })}
              className="text-xs font-medium text-slate-400 hover:text-foreground transition-colors"
            >
              Sign out
            </button>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow-sm">
              {session.user?.name?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'}
            </div>
          </div>
        )}
        <button className="rounded-md bg-primary px-5 py-2 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 transition-transform active:scale-95">
          New board
        </button>
      </div>
    </header>
  );
}
