'use client';

import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';
import type { NotificationType } from '@prisma/client';

const NOTIFICATION_TYPES: { type: NotificationType; label: string; description: string }[] = [
  { type: 'ASSIGNMENT', label: 'Assignments', description: 'When you are assigned to an item' },
  { type: 'COMMENT', label: 'Comments', description: 'When someone comments on your items' },
  { type: 'STATUS_CHANGE', label: 'Status changes', description: 'When item status changes' },
  { type: 'MENTION', label: 'Mentions', description: 'When you are @mentioned' },
  { type: 'DUE_DATE', label: 'Due dates', description: 'When a deadline passes' },
];

export function NotificationPrefsPanel() {
  const { pushToast } = useToast();
  const utils = trpc.useUtils();

  const { data: prefs = [] } = trpc.notificationPrefs.getAll.useQuery();

  const setMut = trpc.notificationPrefs.set.useMutation({
    onSuccess: () => utils.notificationPrefs.getAll.invalidate(),
    onError: (e) => pushToast({ title: 'Failed to update preference', description: e.message, tone: 'error' }),
  });

  /** True if the given type is enabled globally (falls back to default=true) */
  const isGloballyEnabled = (type: NotificationType): boolean => {
    const pref = prefs.find((p) => p.type === type && p.boardId === null);
    return pref?.enabled ?? true;
  };

  const toggle = (type: NotificationType, enabled: boolean) => {
    setMut.mutate({ type, boardId: null, enabled });
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
      <h3 className="text-sm font-bold text-foreground mb-1">Notification preferences</h3>
      <p className="text-xs text-slate-500 mb-5">
        Choose which notifications you receive. These are global defaults. You can also subscribe to individual boards.
      </p>
      <div className="space-y-3">
        {NOTIFICATION_TYPES.map(({ type, label, description }) => {
          const enabled = isGloballyEnabled(type);
          return (
            <div key={type} className="flex items-center justify-between gap-4 py-2 border-b border-slate-50 last:border-0">
              <div>
                <p className="text-sm font-medium text-foreground">{label}</p>
                <p className="text-xs text-slate-400 mt-0.5">{description}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={enabled}
                onClick={() => toggle(type, !enabled)}
                disabled={setMut.isPending}
                className={`relative flex-shrink-0 h-5 w-9 rounded-full transition-colors ${
                  enabled ? 'bg-primary' : 'bg-border'
                } disabled:opacity-60`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                    enabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
