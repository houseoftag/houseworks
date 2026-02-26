'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useEffect } from 'react';
import { trpc } from '@/trpc/react';
import { Sidebar } from '../_components/sidebar';
import { Header } from '../_components/header';
import { NewItemDialog } from '../_components/new_item_dialog';
import { ShortcutHelpOverlay } from '../_components/shortcut_help_overlay';

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  ASSIGNMENT: { icon: '👤', color: 'bg-blue-50' },
  COMMENT: { icon: '💬', color: 'bg-green-50' },
  STATUS_CHANGE: { icon: '🔄', color: 'bg-amber-50' },
  MENTION: { icon: '@', color: 'bg-purple-50' },
  DUE_DATE: { icon: '⏰', color: 'bg-red-50' },
};

export default function NotificationsPage() {
  const router = useRouter();
  const { status } = useSession();
  const { data: notifications = [] } = trpc.notifications.getAll.useQuery(
    undefined,
    { enabled: status === 'authenticated' }
  );
  const utils = trpc.useUtils();

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getAll.invalidate();
      utils.notifications.getUnreadCount.invalidate();
    },
  });

  const handleSelectBoard = (id: string) => {
    router.push(`/?board=${id}`);
  };

  const unreadCount = notifications.filter((n: { readAt: unknown }) => !n.readAt).length;

  useEffect(() => { document.title = 'Notifications — Houseworks'; }, []);

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
          breadcrumb="Houseworks — Notifications"
          titleElement="p"
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 lg:px-6">

          <div className="mx-auto max-w-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-xl font-bold text-foreground">Notifications</h1>
              {unreadCount > 0 && (
                <span className="text-xs text-slate-400">
                  {unreadCount} unread
                </span>
              )}
            </div>

            {notifications.length === 0 ? (
              <div className="py-16 text-center">
                <p className="text-sm font-medium text-foreground">No notifications yet</p>
                <p className="mt-1 text-sm text-slate-400">
                  You&apos;ll be notified when items on your boards are updated.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.map((n) => {
                  const typeInfo = TYPE_ICONS[n.type] ?? { icon: '🔔', color: 'bg-background' };
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        n.readAt ? 'border-border bg-card' : 'border-primary/20 bg-primary/5'
                      }`}
                    >
                      <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm ${typeInfo.color}`}>
                        {typeInfo.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground">{n.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {new Date(n.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {!n.readAt && (
                        <button
                          onClick={() => markAsRead.mutate({ id: n.id })}
                          className="text-xs text-primary hover:underline whitespace-nowrap"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
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
