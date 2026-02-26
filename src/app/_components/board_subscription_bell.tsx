'use client';

import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';

function BellFilledIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 13a2 2 0 004 0M3.5 6.5a4.5 4.5 0 019 0c0 2.5 1 4 1.5 5H2c.5-1 1.5-2.5 1.5-5z" />
    </svg>
  );
}

function BellOutlineIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
      <path d="M6 13a2 2 0 004 0M3.5 6.5a4.5 4.5 0 019 0c0 2.5 1 4 1.5 5H2c.5-1 1.5-2.5 1.5-5z" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function BoardSubscriptionBell({ boardId }: { boardId: string }) {
  const { pushToast } = useToast();
  const utils = trpc.useUtils();

  const { data: prefs } = trpc.userBoardPrefs.get.useQuery({ boardId });
  const isSubscribed = prefs?.subscribed ?? false;

  const setSubscription = trpc.userBoardPrefs.setSubscription.useMutation({
    onSuccess: async (data) => {
      await utils.userBoardPrefs.get.invalidate({ boardId });
      pushToast({
        title: data.subscribed ? 'Subscribed to board' : 'Unsubscribed from board',
        description: data.subscribed ? 'You will receive all notifications for this board.' : undefined,
        tone: 'success',
      });
    },
    onError: (e) => pushToast({ title: 'Failed to update subscription', description: e.message, tone: 'error' }),
  });

  return (
    <button
      type="button"
      onClick={() => setSubscription.mutate({ boardId, subscribed: !isSubscribed })}
      disabled={setSubscription.isPending}
      title={isSubscribed ? 'Unsubscribe from board notifications' : 'Subscribe to board notifications'}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
        isSubscribed
          ? 'bg-primary/10 text-primary hover:bg-primary/20'
          : 'border border-border text-slate-500 hover:text-foreground hover:border-border hover:bg-background'
      }`}
    >
      {isSubscribed ? <BellFilledIcon /> : <BellOutlineIcon />}
      {isSubscribed ? 'Subscribed' : 'Subscribe'}
    </button>
  );
}
