'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { useToast } from './toast_provider';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type ColumnManagerProps = {
  board: BoardData;
};

type StatusOption = {
  label: string;
  color: string;
};

const toOptions = (settings: unknown): StatusOption[] => {
  if (!settings || typeof settings !== 'object') {
    return [];
  }
  const options = (settings as { options?: Record<string, string> }).options;
  if (!options || typeof options !== 'object') {
    return [];
  }
  return Object.entries(options).map(([label, color]) => ({ label, color }));
};

const defaultStatusOptions: StatusOption[] = [
  { label: 'In Progress', color: '#f97316' },
  { label: 'Review', color: '#eab308' },
  { label: 'Done', color: '#22c55e' },
];

const defaultStatusSettings = {
  options: Object.fromEntries(
    defaultStatusOptions.map((option) => [option.label, option.color]),
  ),
};

const columnTypes = [
  { value: 'TEXT', label: 'Text' },
  { value: 'STATUS', label: 'Status' },
  { value: 'PERSON', label: 'Person' },
  { value: 'DATE', label: 'Date' },
  { value: 'LINK', label: 'Link' },
  { value: 'NUMBER', label: 'Number' },
  { value: 'TIMELINE', label: 'Timeline' },
] as const;

export function ColumnManager({ board }: ColumnManagerProps) {
  const utils = trpc.useUtils();
  const [newTitle, setNewTitle] = useState('');
  const [newType, setNewType] = useState<(typeof columnTypes)[number]['value']>(
    'TEXT',
  );

  const [draftOptions, setDraftOptions] = useState<
    Record<string, StatusOption[]>
  >({});
  const { pushToast } = useToast();

  const columnsWithOptions = useMemo(
    () =>
      board.columns.map((column) => ({
        column,
        options: toOptions(column.settings),
      })),
    [board.columns],
  );

  const createColumn = trpc.columns.create.useMutation({
    onSuccess: async () => {
      setNewTitle('');
      pushToast({ title: 'Column created', tone: 'success' });
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
    onError: () => {
      pushToast({
        title: 'Column failed',
        description: 'Unable to create column.',
        tone: 'error',
      });
    },
  });

  const updateColumn = trpc.columns.update.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Column updated', tone: 'success' });
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
    onError: () => {
      pushToast({
        title: 'Column update failed',
        description: 'Unable to update column.',
        tone: 'error',
      });
    },
  });

  const deleteColumn = trpc.columns.delete.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Column deleted', tone: 'success' });
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
    onError: () => {
      pushToast({
        title: 'Column delete failed',
        description: 'Unable to delete column.',
        tone: 'error',
      });
    },
  });

  const handleSaveOptions = (columnId: string, options: StatusOption[]) => {
    const settings = {
      options: Object.fromEntries(
        options
          .filter((option) => option.label.trim())
          .map((option) => [option.label.trim(), option.color]),
      ),
    };
    updateColumn.mutate({ id: columnId, settings });
  };

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm p-6">
      <h3 className="text-sm font-semibold text-foreground">Columns</h3>
      <div className="mt-4 space-y-4">
        <div className="flex flex-wrap gap-3">
          <input
            className="flex-1 rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground"
            placeholder="Column title"
            value={newTitle}
            onChange={(event) => setNewTitle(event.target.value)}
          />
          <select
            className="rounded-xl border border-border bg-background px-4 py-3 text-sm text-foreground"
            value={newType}
            onChange={(event) =>
              setNewType(
                event.target.value as (typeof columnTypes)[number]['value'],
              )
            }
          >
            {columnTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
          <button
            className="rounded-xl bg-muted px-4 py-3 text-xs font-semibold text-slate-900 disabled:opacity-60"
            disabled={!newTitle || createColumn.isPending}
            onClick={() =>
              createColumn.mutate({
                boardId: board.id,
                title: newTitle,
                type: newType,
                settings: newType === 'STATUS' ? defaultStatusSettings : undefined,
              })
            }
            type="button"
          >
            {createColumn.isPending ? 'Adding…' : 'Add Column'}
          </button>
        </div>

        <div className="space-y-4">
          {columnsWithOptions.map(({ column, options }) => {
            const currentOptions =
              draftOptions[column.id] ??
              (column.type === 'STATUS' ? options : []);

            return (
              <div
                key={column.id}
                className="rounded-xl border border-border bg-background p-4"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                    defaultValue={column.title}
                    onBlur={(event) => {
                      const next = event.currentTarget.value.trim();
                      if (next && next !== column.title) {
                        updateColumn.mutate({ id: column.id, title: next });
                      }
                    }}
                  />
                  <span className="rounded-full border border-border px-3 py-1 text-xs text-slate-400">
                    {column.type}
                  </span>
                  <button
                    className="text-xs text-rose-400 hover:text-rose-200"
                    onClick={() => deleteColumn.mutate({ id: column.id })}
                    type="button"
                  >
                    Delete
                  </button>
                </div>

                {column.type === 'STATUS' ? (
                  <div className="mt-4 space-y-3">
                    {currentOptions.map((option, index) => (
                      <div key={`${option.label}-${index}`} className="flex gap-3">
                        <input
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground"
                          value={option.label}
                          onChange={(event) => {
                            const next = [...currentOptions];
                            next[index] = {
                              ...option,
                              label: event.target.value,
                            };
                            setDraftOptions((prev) => ({
                              ...prev,
                              [column.id]: next,
                            }));
                          }}
                        />
                        <input
                          className="h-10 w-20 rounded-lg border border-border bg-background px-2"
                          type="color"
                          value={option.color}
                          onChange={(event) => {
                            const next = [...currentOptions];
                            next[index] = {
                              ...option,
                              color: event.target.value,
                            };
                            setDraftOptions((prev) => ({
                              ...prev,
                              [column.id]: next,
                            }));
                          }}
                        />
                        <button
                          className="text-xs text-rose-400 hover:text-rose-200"
                          onClick={() => {
                            const next = currentOptions.filter(
                              (_, idx) => idx !== index,
                            );
                            setDraftOptions((prev) => ({
                              ...prev,
                              [column.id]: next,
                            }));
                          }}
                          type="button"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-3">
                      <button
                        className="rounded-lg border border-border px-3 py-2 text-xs text-foreground"
                        onClick={() => {
                          const next = [
                            ...currentOptions,
                            { label: 'New', color: '#64748b' },
                          ];
                          setDraftOptions((prev) => ({
                            ...prev,
                            [column.id]: next,
                          }));
                        }}
                        type="button"
                      >
                        Add Option
                      </button>
                      <button
                        className="rounded-lg bg-muted px-3 py-2 text-xs font-semibold text-slate-900"
                        onClick={() =>
                          handleSaveOptions(column.id, currentOptions)
                        }
                        type="button"
                      >
                        Save Options
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
