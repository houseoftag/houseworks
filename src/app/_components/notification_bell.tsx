'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';

const TYPE_ICONS: Record<string, { icon: string; color: string }> = {
  ASSIGNMENT: { icon: '👤', color: 'bg-blue-500/15' },
  COMMENT: { icon: '💬', color: 'bg-green-500/15' },
  STATUS_CHANGE: { icon: '🔄', color: 'bg-amber-500/15' },
  MENTION: { icon: '@', color: 'bg-purple-500/15' },
  DUE_DATE: { icon: '⏰', color: 'bg-red-500/10' },
};

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { status } = useSession();
  const router = useRouter();
  const { data: unreadCount = 0 } = trpc.notifications.getUnreadCount.useQuery(
    undefined,
    { enabled: status === 'authenticated', refetchInterval: 10000 }
  );
  const { data: notifications = [] } = trpc.notifications.getAll.useQuery(
    undefined,
    { enabled: isOpen && status === 'authenticated' }
  );
  const utils = trpc.useUtils();

  const markAsRead = trpc.notifications.markAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getAll.invalidate();
    },
  });

  const markAllAsRead = trpc.notifications.markAllAsRead.useMutation({
    onSuccess: () => {
      utils.notifications.getUnreadCount.invalidate();
      utils.notifications.getAll.invalidate();
    },
  });

  const handleNotificationClick = (notification: typeof notifications[0]) => {
    if (!notification.readAt) {
      markAsRead.mutate({ id: notification.id });
    }
    if (notification.link) {
      router.push(notification.link);
    }
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2.5 text-slate-500 hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Notifications"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="fixed inset-x-2 top-14 z-50 max-h-[70vh] flex flex-col rounded-xl border border-border bg-card shadow-xl sm:inset-x-auto sm:absolute sm:right-0 sm:top-auto sm:mt-2 sm:w-96 sm:max-h-[480px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h3 className="text-sm font-semibold text-foreground">
                Notifications
              </h3>
              {unreadCount > 0 && (
                <button
                  onClick={() => markAllAsRead.mutate()}
                  className="text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                >
                  Mark all read
                </button>
              )}
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto p-2">
              {notifications.length === 0 ? (
                <div className="py-12 text-center">
                  <div className="text-3xl mb-2">🔔</div>
                  <p className="text-sm text-slate-400">No notifications yet</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {notifications.map((notification) => {
                    const typeInfo = TYPE_ICONS[notification.type] ?? { icon: '📌', color: 'bg-background' };
                    return (
                      <button
                        key={notification.id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`w-full text-left flex items-start gap-3 rounded-lg p-3 transition-colors ${
                          notification.readAt
                            ? 'opacity-50 hover:bg-background'
                            : 'bg-blue-500/10 hover:bg-blue-500/15'
                        }`}
                      >
                        <div className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full ${typeInfo.color} text-sm`}>
                          {typeInfo.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-foreground truncate">
                            {notification.title}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-[10px] text-slate-400">
                            {formatTimeAgo(new Date(notification.createdAt))}
                          </p>
                        </div>
                        {!notification.readAt && (
                          <div className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}
