'use client';

import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="flex min-h-screen w-full gap-8 px-4 pt-16 pb-10 lg:px-8 lg:pt-10">
        <Sidebar
          onSelectBoard={handleSelectBoard}
          selectedBoardId={null}
          onNavigateDashboard={() => router.push('/')}
          onNavigateActivity={() => router.push('/activity')}
          currentView="dashboard"
        />

        <main className="flex-1 space-y-8">
          <Header onSelectBoard={handleSelectBoard} onSelectItem={(_, boardId) => handleSelectBoard(boardId)} />

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
              <p className="py-10 text-center text-sm text-slate-400">No notifications yet.</p>
            ) : (
              <div className="space-y-2">
                {notifications.map((n: { id: string; type: string; message: string; readAt: unknown; createdAt: string }) => {
                  const typeInfo = TYPE_ICONS[n.type] ?? { icon: '🔔', color: 'bg-slate-50' };
                  return (
                    <div
                      key={n.id}
                      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
                        n.readAt ? 'border-border bg-white' : 'border-primary/20 bg-primary/5'
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
      </div>

      <NewItemDialog />
      <ShortcutHelpOverlay />
    </div>
  );
}
