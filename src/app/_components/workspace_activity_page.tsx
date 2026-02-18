'use client';

import { useSession } from 'next-auth/react';
import { trpc } from '@/trpc/react';
import { ActivityFeed } from './activity_feed';

type Props = {
  onSelectBoard: (boardId: string) => void;
};

export function WorkspaceActivityPage({ onSelectBoard }: Props) {
  const { status } = useSession();

  const { data: workspaces } = trpc.workspaces.listMine.useQuery(undefined, {
    enabled: status === 'authenticated',
  });

  const workspaceId = workspaces?.[0]?.id;

  if (!workspaceId) {
    return (
      <div className="py-20 text-center text-sm text-slate-400">
        No workspace found.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Activity Feed</h1>
        <p className="mt-1 text-sm text-slate-500">
          Recent activity across your workspace
        </p>
      </div>

      <ActivityFeed
        workspaceId={workspaceId}
        onNavigateToItem={(itemId, boardId) => {
          void itemId;
          onSelectBoard(boardId);
        }}
      />
    </div>
  );
}
