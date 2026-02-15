'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useSession } from 'next-auth/react';

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false);
  const { status } = useSession();
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

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative rounded-full p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors"
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
          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white ring-2 ring-slate-950">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 z-50 w-80 max-h-[400px] overflow-y-auto rounded-2xl border border-slate-800 bg-slate-900 p-4 shadow-2xl">
            <h3 className="mb-4 text-sm font-semibold text-slate-100">
              Notifications
            </h3>
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => {
                    if (!notification.readAt) {
                      markAsRead.mutate({ id: notification.id });
                    }
                    setIsOpen(false);
                  }}
                  className={`cursor-pointer rounded-xl p-3 transition-colors ${
                    notification.readAt
                      ? 'bg-slate-900/50 opacity-60'
                      : 'bg-slate-800/50 hover:bg-slate-800'
                  }`}
                >
                  <p className="text-xs font-medium text-slate-100">
                    {notification.title}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {notification.message}
                  </p>
                  <p className="mt-2 text-[10px] text-slate-500">
                    {new Date(notification.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
              {notifications.length === 0 && (
                <div className="py-8 text-center text-xs text-slate-500">
                  No notifications.
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
