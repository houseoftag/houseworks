'use client';

import { useState, useEffect, useRef } from 'react';
import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';
import { useHotkeys } from './use_hotkeys';

export function NewItemDialog() {
  const [open, setOpen] = useState(false);
  const [itemName, setItemName] = useState('');
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { pushToast } = useToast();

  // Ctrl+N / Cmd+N to open
  useHotkeys([
    {
      key: 'mod+n',
      description: 'New item',
      category: 'global',
      handler: () => {
        setOpen(true);
        setItemName('');
      },
    },
  ]);

  // Fetch boards to get groups
  const { data: board } = trpc.boards.getDefault.useQuery(undefined, {
    enabled: open,
  });
  const utils = trpc.useUtils();

  const createItem = trpc.items.create.useMutation({
    onSuccess: () => {
      pushToast({ title: 'Item created', description: `"${itemName}" has been added.`, tone: 'success' });
      setOpen(false);
      setItemName('');
      void utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({ title: 'Create failed', description: 'Unable to create item.', tone: 'error' });
    },
  });

  // Auto-select first group when board data loads
  const firstGroupId = board?.groups?.[0]?.id ?? '';
  const effectiveGroupId = selectedGroupId || firstGroupId;

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  const handleSubmit = () => {
    const name = itemName.trim();
    if (!name || !effectiveGroupId) return;
    createItem.mutate({ groupId: effectiveGroupId, name });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
      <div
        className="w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="New item"
      >
        <h2 className="text-lg font-bold text-foreground mb-4">Quick Add Item</h2>

        <div className="space-y-4">
          <div>
            <label htmlFor="new-item-name" className="block text-xs font-medium text-slate-600 mb-1">
              Item Name
            </label>
            <input
              ref={inputRef}
              id="new-item-name"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
              placeholder="Enter item name…"
              value={itemName}
              onChange={(e) => setItemName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
          </div>

          {board?.groups && board.groups.length > 0 && (
            <div>
              <label htmlFor="new-item-group" className="block text-xs font-medium text-slate-600 mb-1">
                Group
              </label>
              <select
                id="new-item-group"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
                value={effectiveGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                {board.groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            className="rounded-md px-4 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100"
            onClick={() => setOpen(false)}
            type="button"
          >
            Cancel
          </button>
          <button
            className="rounded-md bg-primary px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-primary/90 disabled:opacity-50"
            onClick={handleSubmit}
            disabled={!itemName.trim() || !effectiveGroupId || createItem.isPending}
            type="button"
          >
            {createItem.isPending ? 'Creating…' : 'Create Item'}
          </button>
        </div>
      </div>
    </div>
  );
}
