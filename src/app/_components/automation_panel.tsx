'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { useToast } from './toast_provider';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type AutomationPanelProps = {
  board: BoardData;
};

const getStatusOptions = (settings: unknown) => {
  if (!settings || typeof settings !== 'object') {
    return [];
  }
  const options = (settings as { options?: Record<string, string> }).options;
  if (!options || typeof options !== 'object') {
    return [];
  }
  return Object.keys(options);
};

export function AutomationPanel({ board }: AutomationPanelProps) {
  const { pushToast } = useToast();
  const utils = trpc.useUtils();
  const [name, setName] = useState('New Automation');
  const [triggerType, setTriggerType] = useState<'STATUS_CHANGED' | 'ITEM_CREATED'>('STATUS_CHANGED');
  const [statusColumnId, setStatusColumnId] = useState(
    board.columns.find((column) => column.type === 'STATUS')?.id ?? '',
  );
  const [statusValue, setStatusValue] = useState('');

  const [actionType, setActionType] = useState<'LOG' | 'SET_STATUS'>('LOG');
  const [actionStatusColumnId, setActionStatusColumnId] = useState(
    board.columns.find((column) => column.type === 'STATUS')?.id ?? '',
  );
  const [actionStatusValue, setActionStatusValue] = useState('');
  const [selectedAutomation, setSelectedAutomation] = useState<string | null>(
    null,
  );

  const { data: automations } = trpc.automations.list.useQuery({
    workspaceId: board.workspaceId,
    boardId: board.id,
  });

  const { data: logs } = trpc.automations.logs.useQuery(
    { automationId: selectedAutomation ?? '' },
    { enabled: !!selectedAutomation },
  );

  const statusColumns = useMemo(
    () => board.columns.filter((column) => column.type === 'STATUS'),
    [board.columns],
  );

  const statusOptions = useMemo(() => {
    const column = board.columns.find((col) => col.id === statusColumnId);
    return column ? getStatusOptions(column.settings) : [];
  }, [board.columns, statusColumnId]);

  const actionStatusOptions = useMemo(() => {
    const column = board.columns.find((col) => col.id === actionStatusColumnId);
    if (!column) return [];
    const settings = column.settings as { options?: Record<string, string> };
    return Object.entries(settings.options ?? {}).map(([label, color]) => ({ label, color }));
  }, [board.columns, actionStatusColumnId]);

  const createAutomation = trpc.automations.create.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Automation created', tone: 'success' });
      await utils.automations.list.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Automation failed',
        description: 'Unable to create automation.',
        tone: 'error',
      });
    },
  });

  const toggleAutomation = trpc.automations.toggle.useMutation({
    onSuccess: async () => {
      await utils.automations.list.invalidate();
    },
  });

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      <h3 className="text-sm font-bold text-foreground">Automations</h3>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        <div className="space-y-6">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Create automation
          </p>
          <div className="space-y-4">
            <input
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all"
              placeholder="Automation name (e.g. Sync Status to Log)"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-[0.1em] text-slate-400 ml-1">Trigger</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground focus:bg-white focus:border-primary focus:outline-none transition-all"
                value={triggerType}
                onChange={(e) => setTriggerType(e.target.value as any)}
              >
                <option value="STATUS_CHANGED">When status changes</option>
                <option value="ITEM_CREATED">When item is created</option>
              </select>

              {triggerType === 'STATUS_CHANGED' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none transition-all"
                    value={statusColumnId}
                    onChange={(event) => setStatusColumnId(event.target.value)}
                  >
                    <option value="" disabled>In column...</option>
                    {statusColumns.map((column) => (
                      <option key={column.id} value={column.id}>{column.title}</option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none transition-all"
                    value={statusValue}
                    onChange={(event) => setStatusValue(event.target.value)}
                  >
                    <option value="" disabled>to status...</option>
                    {statusOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-[10px] uppercase font-bold tracking-[0.1em] text-slate-400 ml-1">Action</label>
              <select
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground focus:bg-white focus:border-primary focus:outline-none transition-all"
                value={actionType}
                onChange={(e) => setActionType(e.target.value as any)}
              >
                <option value="LOG">Just log it</option>
                <option value="SET_STATUS">Set status</option>
              </select>

              {actionType === 'SET_STATUS' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none transition-all"
                    value={actionStatusColumnId}
                    onChange={(event) => setActionStatusColumnId(event.target.value)}
                  >
                    <option value="" disabled>In column...</option>
                    {statusColumns.map((column) => (
                      <option key={column.id} value={column.id}>{column.title}</option>
                    ))}
                  </select>
                  <select
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-foreground focus:border-primary focus:outline-none transition-all"
                    value={actionStatusValue}
                    onChange={(event) => setActionStatusValue(event.target.value)}
                  >
                    <option value="" disabled>to status...</option>
                    {actionStatusOptions.map((option) => (
                      <option key={option.label} value={option.label}>{option.label}</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          </div>

          <button
            className="w-full rounded-md bg-primary px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 disabled:opacity-60 transition-all active:scale-[0.98]"
            disabled={!name || (triggerType === 'STATUS_CHANGED' && (!statusColumnId || !statusValue)) || (actionType === 'SET_STATUS' && (!actionStatusColumnId || !actionStatusValue))}
            onClick={() => {
              const trigger = (triggerType === 'STATUS_CHANGED'
                ? { type: 'STATUS_CHANGED', columnId: statusColumnId, to: statusValue }
                : { type: 'ITEM_CREATED' }) as any;

              const action = (actionType === 'LOG'
                ? { type: 'LOG', payload: { message: name } }
                : {
                  type: 'SET_STATUS',
                  payload: {
                    columnId: actionStatusColumnId,
                    label: actionStatusValue,
                    color: actionStatusOptions.find(o => o.label === actionStatusValue)?.color ?? '#64748b'
                  }
                }) as any;

              createAutomation.mutate({
                workspaceId: board.workspaceId,
                boardId: board.id,
                name,
                trigger,
                actions: [action],
              });
            }}
            type="button"
          >
            Create Automation
          </button>
        </div>

        <div className="space-y-4">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Active automations
          </p>
          <div className="space-y-3">
            {automations?.length ? (
              automations.map((automation) => (
                <div
                  key={automation.id}
                  className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 group hover:border-primary/30 transition-colors"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {automation.name}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                        {automation.enabled ? (
                          <span className="text-emerald-500">● Active</span>
                        ) : (
                          <span className="text-slate-300">● Paused</span>
                        )}
                      </p>
                    </div>
                    <button
                      className={`text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all ${automation.enabled ? 'bg-slate-200 text-slate-600 hover:bg-slate-300' : 'bg-primary text-white hover:shadow-md'}`}
                      onClick={() =>
                        toggleAutomation.mutate({
                          id: automation.id,
                          enabled: !automation.enabled,
                        })
                      }
                      type="button"
                    >
                      {automation.enabled ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                  <button
                    className="mt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400 hover:text-primary transition-colors"
                    onClick={() => setSelectedAutomation(automation.id)}
                    type="button"
                  >
                    View History
                  </button>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
                <p className="text-xs text-slate-400 italic">
                  No automations yet.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAutomation ? (
        <div className="mt-8 border-t border-slate-100 pt-6 animate-in fade-in duration-500">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            Execution logs
          </p>
          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {logs?.length ? (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs shadow-sm"
                >
                  <p className="font-medium text-foreground">{log.message ?? 'Log entry'}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic p-4">No logs yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
