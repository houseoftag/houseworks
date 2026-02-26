'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';

type DuplicateBoardDialogProps = {
  boardId: string;
  boardTitle: string;
  onClose: () => void;
  onDuplicated: (newBoardId: string) => void;
};

export function DuplicateBoardDialog({ boardId, boardTitle, onClose, onDuplicated }: DuplicateBoardDialogProps) {
  const { pushToast } = useToast();
  const [title, setTitle] = useState(`${boardTitle} (copy)`);
  const [includeItems, setIncludeItems] = useState(false);
  const utils = trpc.useUtils();

  const duplicate = trpc.boards.duplicate.useMutation({
    onSuccess: (board) => {
      pushToast({ title: 'Board duplicated!', tone: 'success' });
      void utils.boards.dashboardStats.invalidate();
      onClose();
      onDuplicated(board.id);
    },
    onError: () => pushToast({ title: 'Failed to duplicate board', tone: 'error' }),
  });

  const handleDuplicate = () => {
    if (!title.trim()) return;
    duplicate.mutate({ id: boardId, title: title.trim(), includeItems });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose} role="dialog" aria-modal="true" aria-label="Duplicate board">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-foreground">Duplicate board</h3>
        <p className="mt-1 text-sm text-slate-500">Create a copy of &quot;{boardTitle}&quot; with its columns and groups.</p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="dup-title" className="block text-sm font-medium text-foreground">New board title</label>
            <input
              id="dup-title"
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={e => { if (e.key === 'Enter') handleDuplicate(); }}
              autoFocus
            />
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={includeItems}
              onChange={e => setIncludeItems(e.target.checked)}
              className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
            />
            <span className="text-sm text-foreground">Include items (copy all items and their cell values)</span>
          </label>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-muted transition-colors"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleDuplicate}
            disabled={!title.trim() || duplicate.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            type="button"
          >
            {duplicate.isPending ? 'Duplicating…' : 'Duplicate board'}
          </button>
        </div>
      </div>
    </div>
  );
}
