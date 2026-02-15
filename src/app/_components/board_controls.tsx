'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { ColumnManager } from './column_manager';
import { ReorderPanel } from './reorder_panel';
import { useToast } from './toast_provider';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type BoardControlsProps = {
  board: BoardData;
};

export function BoardControls({ board }: BoardControlsProps) {
  const { status } = useSession();
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const groups = Array.isArray(board.groups) ? board.groups : [];
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');
  const [groupTitle, setGroupTitle] = useState('');
  const [groupColor, setGroupColor] = useState('#22c55e');
  const [itemName, setItemName] = useState('');
  const [itemGroupId, setItemGroupId] = useState<string | null>(null);

  useEffect(() => {
    setTitle(board.title);
    setDescription(board.description ?? '');
    const groupIds = groups.map((group) => group.id);
    if (!itemGroupId || (itemGroupId && !groupIds.includes(itemGroupId))) {
      setItemGroupId(groups[0]?.id ?? null);
    }
  }, [board, groups, itemGroupId]);

  const updateBoard = trpc.boards.update.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Board updated', tone: 'success' });
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Board update failed',
        description: 'Unable to update board.',
        tone: 'error',
      });
    },
  });

  const deleteBoard = trpc.boards.delete.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Board deleted', tone: 'success' });
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Board delete failed',
        description: 'Unable to delete board.',
        tone: 'error',
      });
    },
  });

  const createGroup = trpc.groups.create.useMutation({
    onSuccess: async () => {
      setGroupTitle('');
      pushToast({ title: 'Group created', tone: 'success' });
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Group failed',
        description: 'Unable to create group.',
        tone: 'error',
      });
    },
  });

  const createItem = trpc.items.create.useMutation({
    onSuccess: async () => {
      setItemName('');
      pushToast({ title: 'Item created', tone: 'success' });
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Item failed',
        description: 'Unable to create item.',
        tone: 'error',
      });
    },
  });

  if (status !== 'authenticated') {
    return null;
  }

  return (
    <div className="space-y-6">
      <ColumnManager board={board} />
      <ReorderPanel board={board} />
      <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
        <h3 className="text-sm font-semibold text-slate-100">Board Settings</h3>
        <div className="mt-4 space-y-3">
          <input
            className="w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
          />
          <textarea
            className="w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100"
            rows={3}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
          <div className="flex flex-wrap gap-3">
            <button
              className="rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 disabled:opacity-60"
              disabled={!title || updateBoard.isPending}
              onClick={() =>
                updateBoard.mutate({
                  id: board.id,
                  title,
                  description: description || undefined,
                })
              }
              type="button"
            >
              {updateBoard.isPending ? 'Saving…' : 'Save Board'}
            </button>
            <button
              className="rounded-xl border border-rose-500/60 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-rose-200 disabled:opacity-60"
              disabled={deleteBoard.isPending}
              onClick={() => {
                if (
                  window.confirm(
                    'Delete this board? This action cannot be undone.',
                  )
                ) {
                  deleteBoard.mutate({ id: board.id });
                }
              }}
              type="button"
            >
              {deleteBoard.isPending ? 'Deleting…' : 'Delete Board'}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
          <h3 className="text-sm font-semibold text-slate-100">Add Group</h3>
          <div className="mt-4 space-y-3">
            <input
              className="w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              placeholder="Group title"
              value={groupTitle}
              onChange={(event) => setGroupTitle(event.target.value)}
            />
            <input
              className="h-12 w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-2 text-sm text-slate-100"
              type="color"
              value={groupColor}
              onChange={(event) => setGroupColor(event.target.value)}
            />
            <button
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 disabled:opacity-60"
              disabled={!groupTitle || createGroup.isPending}
              onClick={() =>
                createGroup.mutate({
                  boardId: board.id,
                  title: groupTitle,
                  color: groupColor,
                })
              }
              type="button"
            >
              {createGroup.isPending ? 'Adding…' : 'Create Group'}
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-6">
          <h3 className="text-sm font-semibold text-slate-100">Add Item</h3>
          <div className="mt-4 space-y-3">
            <select
              className="w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              value={itemGroupId ?? ''}
              onChange={(event) => setItemGroupId(event.target.value)}
            >
              <option value="" disabled>
                Select group
              </option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.title}
                </option>
              ))}
            </select>
            <input
              className="w-full rounded-xl border border-slate-700/70 bg-slate-950 px-4 py-3 text-sm text-slate-100"
              placeholder="Item name"
              value={itemName}
              onChange={(event) => setItemName(event.target.value)}
            />
            <button
              className="w-full rounded-xl bg-slate-100 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-slate-900 disabled:opacity-60"
              disabled={!itemGroupId || !itemName || createItem.isPending}
              onClick={() =>
                createItem.mutate({
                  groupId: itemGroupId!,
                  name: itemName,
                })
              }
              type="button"
            >
              {createItem.isPending ? 'Adding…' : 'Create Item'}
            </button>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
