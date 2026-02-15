'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';

type ItemDetailPanelProps = {
  itemId: string;
  onClose: () => void;
};

export function ItemDetailPanel({ itemId, onClose }: ItemDetailPanelProps) {
  const { data: item, isLoading } = trpc.items.getOne.useQuery({ id: itemId });
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [newUpdate, setNewUpdate] = useState('');

  const createUpdate = trpc.items.createUpdate.useMutation({
    onSuccess: () => {
      setNewUpdate('');
      utils.items.getOne.invalidate({ id: itemId });
      pushToast({
        title: 'Update posted',
        tone: 'success',
      });
    },
  });

  if (isLoading) {
    return (
      <div className="fixed inset-y-0 right-0 w-[500px] border-l border-slate-800 bg-slate-900 p-6 shadow-2xl animate-pulse">
        <div className="h-8 w-48 bg-slate-800 rounded mb-4" />
        <div className="h-4 w-full bg-slate-800 rounded mb-8" />
        <div className="space-y-4">
          <div className="h-20 w-full bg-slate-800 rounded" />
          <div className="h-20 w-full bg-slate-800 rounded" />
        </div>
      </div>
    );
  }

  if (!item) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 w-[500px] flex flex-col border-l border-slate-800 bg-slate-900 shadow-2xl">
      <div className="flex items-center justify-between border-b border-slate-800 p-4">
        <h2 className="text-xl font-semibold text-slate-100">{item.name}</h2>
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-100"
        >
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-8">
          <h3 className="mb-4 text-sm font-medium text-slate-400 uppercase tracking-wider">Updates</h3>
          <div className="rounded-xl border border-slate-800 bg-slate-950 p-4 mb-6 focus-within:border-slate-600 transition-colors">
            <textarea
              value={newUpdate}
              onChange={(e) => setNewUpdate(e.target.value)}
              placeholder="Write an update..."
              className="w-full bg-transparent text-slate-100 placeholder:text-slate-600 focus:outline-none resize-none min-h-[100px]"
            />
            <div className="flex justify-end mt-2">
              <button
                disabled={!newUpdate.trim() || createUpdate.isPending}
                onClick={() => createUpdate.mutate({ itemId, content: newUpdate })}
                className="rounded-lg bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-white disabled:opacity-50 transition-opacity"
              >
                {createUpdate.isPending ? 'Posting...' : 'Post Update'}
              </button>
            </div>
          </div>

          <div className="space-y-6">
            {item.updates?.map((update: any) => (
              <div key={update.id} className="rounded-xl border border-slate-800/50 bg-slate-900/50 p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-800 text-xs font-bold text-slate-100">
                    {update.user.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U'}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-slate-100">{update.user.name}</div>
                    <div className="text-xs text-slate-500">
                      {new Date(update.createdAt).toLocaleString()}
                    </div>
                  </div>
                </div>
                <div className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">
                  {update.content}
                </div>
              </div>
            ))}
            {item.updates?.length === 0 && (
              <div className="text-center py-12 text-slate-500">
                <p className="text-sm">No updates yet.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
