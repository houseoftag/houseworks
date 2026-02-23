/* eslint-disable @typescript-eslint/no-explicit-any -- tRPC inferred types need any for Json fields */
'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { useToast } from './toast_provider';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type AutomationPanelProps = {
  board: BoardData;
  open?: boolean;
  onClose?: () => void;
};

type TriggerType =
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'ITEM_CREATED';

type ActionType =
  | 'LOG'
  | 'NOTIFY'
  | 'MOVE_TO_GROUP'
  | 'SET_PERSON'
  | 'SET_STATUS';

const TRIGGER_LABELS: Record<TriggerType, string> = {
  STATUS_CHANGED: 'When status changes',
  PRIORITY_CHANGED: 'When priority changes',
  ASSIGNEE_CHANGED: 'When assignee changes',
  ITEM_CREATED: 'When item is created',
};

const ACTION_LABELS: Record<ActionType, string> = {
  LOG: 'Just log it',
  SET_STATUS: 'Set status',
  SET_PERSON: 'Auto-assign person',
  NOTIFY: 'Send notification',
  MOVE_TO_GROUP: 'Move to group',
};

const getStatusOptions = (settings: unknown) => {
  if (!settings || typeof settings !== 'object') return [];
  const options = (settings as { options?: Record<string, string> }).options;
  if (!options || typeof options !== 'object') return [];
  return Object.entries(options).map(([label, color]) => ({ label, color }));
};

export function AutomationPanel({ board, open, onClose }: AutomationPanelProps) {
  const { pushToast } = useToast();
  const utils = trpc.useUtils();
  const [name, setName] = useState('New Automation');
  const [triggerType, setTriggerType] = useState<TriggerType>('STATUS_CHANGED');
  const [triggerColumnId, setTriggerColumnId] = useState(
    board.columns.find((c) => c.type === 'STATUS')?.id ?? '',
  );
  const [triggerToValue, setTriggerToValue] = useState('');

  const [actionType, setActionType] = useState<ActionType>('LOG');
  const [actionStatusColumnId, setActionStatusColumnId] = useState(
    board.columns.find((c) => c.type === 'STATUS')?.id ?? '',
  );
  const [actionStatusValue, setActionStatusValue] = useState('');
  const [actionPersonColumnId, setActionPersonColumnId] = useState(
    board.columns.find((c) => c.type === 'PERSON')?.id ?? '',
  );
  const [actionPersonUserId, setActionPersonUserId] = useState('');
  const [actionGroupId, setActionGroupId] = useState('');
  const [actionNotifyMessage, setActionNotifyMessage] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedAutomation, setSelectedAutomation] = useState<string | null>(null);

  const { data: automations } = trpc.automations.list.useQuery({
    workspaceId: board.workspaceId,
    boardId: board.id,
  });

  const { data: logs } = trpc.automations.logs.useQuery(
    { automationId: selectedAutomation ?? '' },
    { enabled: !!selectedAutomation },
  );

  // Fetch workspace members for person assignment
  const { data: membersData } = trpc.workspaces.members.useQuery(
    { workspaceId: board.workspaceId },
  );
  const members = membersData ?? [];

  const statusColumns = useMemo(
    () => board.columns.filter((c) => c.type === 'STATUS'),
    [board.columns],
  );

  const personColumns = useMemo(
    () => board.columns.filter((c) => c.type === 'PERSON'),
    [board.columns],
  );

  const triggerColumnOptions = useMemo(() => {
    const col = board.columns.find((c) => c.id === triggerColumnId);
    return col ? getStatusOptions(col.settings) : [];
  }, [board.columns, triggerColumnId]);

  const actionStatusOptions = useMemo(() => {
    const col = board.columns.find((c) => c.id === actionStatusColumnId);
    return col ? getStatusOptions(col.settings) : [];
  }, [board.columns, actionStatusColumnId]);

  const groups = board.groups ?? [];

  const triggerNeedsColumn =
    triggerType === 'STATUS_CHANGED' || triggerType === 'PRIORITY_CHANGED';

  const createAutomation = trpc.automations.create.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Automation created', tone: 'success' });
      await utils.automations.list.invalidate();
      resetForm();
    },
    onError: () => {
      pushToast({
        title: 'Automation failed',
        description: 'Unable to create automation.',
        tone: 'error',
      });
    },
  });

  const updateAutomation = trpc.automations.update.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Automation updated', tone: 'success' });
      await utils.automations.list.invalidate();
      resetForm();
    },
  });

  const deleteAutomation = trpc.automations.delete.useMutation({
    onSuccess: async () => {
      pushToast({ title: 'Automation deleted', tone: 'success' });
      await utils.automations.list.invalidate();
    },
  });

  const toggleAutomation = trpc.automations.toggle.useMutation({
    onSuccess: async () => {
      await utils.automations.list.invalidate();
    },
  });

  function resetForm() {
    setName('New Automation');
    setTriggerType('STATUS_CHANGED');
    setTriggerToValue('');
    setActionType('LOG');
    setActionStatusValue('');
    setActionPersonUserId('');
    setActionGroupId('');
    setActionNotifyMessage('');
    setEditingId(null);
  }

  function buildTrigger() {
    const trigger: Record<string, unknown> = { type: triggerType };
    if (triggerNeedsColumn && triggerColumnId) {
      trigger.columnId = triggerColumnId;
    }
    if (triggerNeedsColumn && triggerToValue) {
      trigger.to = triggerToValue;
    }
    if (triggerType === 'ASSIGNEE_CHANGED' && triggerColumnId) {
      trigger.columnId = triggerColumnId;
    }
    return trigger;
  }

  function buildAction() {
    switch (actionType) {
      case 'LOG':
        return { type: 'LOG' as const, payload: { message: name } };
      case 'SET_STATUS': {
        const opt = actionStatusOptions.find((o) => o.label === actionStatusValue);
        return {
          type: 'SET_STATUS' as const,
          payload: {
            columnId: actionStatusColumnId,
            label: actionStatusValue,
            color: opt?.color ?? '#64748b',
          },
        };
      }
      case 'SET_PERSON':
        return {
          type: 'SET_PERSON' as const,
          payload: {
            columnId: actionPersonColumnId,
            userId: actionPersonUserId,
          },
        };
      case 'NOTIFY':
        return {
          type: 'NOTIFY' as const,
          payload: {
            message: actionNotifyMessage || `Automation "${name}" triggered`,
            notifyAssignee: true,
          },
        };
      case 'MOVE_TO_GROUP':
        return {
          type: 'MOVE_TO_GROUP' as const,
          payload: { groupId: actionGroupId },
        };
    }
  }

  function handleSubmit() {
    const trigger = buildTrigger();
    const action = buildAction();

    if (editingId) {
      updateAutomation.mutate({
        id: editingId,
        name,
        trigger: trigger as any,
        actions: [action as any],
      });
    } else {
      createAutomation.mutate({
        workspaceId: board.workspaceId,
        boardId: board.id,
        name,
        trigger: trigger as any,
        actions: [action as any],
      });
    }
  }

  function loadAutomationForEdit(automation: NonNullable<typeof automations>[number]) {
    const trigger = automation.trigger as Record<string, string>;
    const actions = automation.actions as Array<{ type: string; payload?: Record<string, unknown> }>;
    const action = actions[0];

    setEditingId(automation.id);
    setName(automation.name);
    setTriggerType((trigger.type as TriggerType) ?? 'STATUS_CHANGED');
    if (trigger.columnId) setTriggerColumnId(trigger.columnId);
    if (trigger.to) setTriggerToValue(trigger.to);

    if (action) {
      setActionType((action.type as ActionType) ?? 'LOG');
      if (action.type === 'SET_STATUS' && action.payload) {
        setActionStatusColumnId(action.payload.columnId as string ?? '');
        setActionStatusValue(action.payload.label as string ?? '');
      }
      if (action.type === 'SET_PERSON' && action.payload) {
        setActionPersonColumnId(action.payload.columnId as string ?? '');
        setActionPersonUserId(action.payload.userId as string ?? '');
      }
      if (action.type === 'NOTIFY' && action.payload) {
        setActionNotifyMessage(action.payload.message as string ?? '');
      }
      if (action.type === 'MOVE_TO_GROUP' && action.payload) {
        setActionGroupId(action.payload.groupId as string ?? '');
      }
    }
  }

  const isFormValid = (() => {
    if (!name) return false;
    if (triggerNeedsColumn && !triggerColumnId) return false;
    if (actionType === 'SET_STATUS' && (!actionStatusColumnId || !actionStatusValue)) return false;
    if (actionType === 'SET_PERSON' && (!actionPersonColumnId || !actionPersonUserId)) return false;
    if (actionType === 'MOVE_TO_GROUP' && !actionGroupId) return false;
    return true;
  })();

  const inputCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground placeholder:text-slate-400 focus:bg-white focus:border-primary focus:outline-none transition-all';
  const selectCls =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-foreground focus:bg-white focus:border-primary focus:outline-none transition-all';
  const labelCls =
    'text-[10px] uppercase font-bold tracking-[0.1em] text-slate-400 ml-1';

  // When open prop is provided, use drawer mode
  if (open !== undefined && !open) return null;

  const isDrawer = open !== undefined;

  const innerContent = (
    <>
      {!isDrawer && (
        <>
          <h3 className="text-sm font-bold text-foreground">Automations & Rules</h3>
          <p className="mt-1 text-xs text-slate-400">
            IF [field] [changes to] [value] → THEN [action]
          </p>
        </>
      )}

      <div className="mt-6 grid gap-8 lg:grid-cols-[1.2fr_1fr]">
        {/* Form */}
        <div className="space-y-6">
          <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
            {editingId ? 'Edit automation' : 'Create automation'}
          </p>
          <div className="space-y-4">
            <input
              className={inputCls}
              placeholder="Automation name"
              value={name}
              aria-label="Automation name"
              onChange={(e) => setName(e.target.value)}
            />

            {/* Trigger section */}
            <div className="space-y-3">
              <label className={labelCls}>IF (Trigger)</label>
              <select
                className={selectCls}
                value={triggerType}
                aria-label="Trigger type"
                onChange={(e) => setTriggerType(e.target.value as TriggerType)}
              >
                {Object.entries(TRIGGER_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>

              {(triggerNeedsColumn || triggerType === 'ASSIGNEE_CHANGED') && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className={selectCls}
                    value={triggerColumnId}
                    aria-label="Trigger column"
                    onChange={(e) => setTriggerColumnId(e.target.value)}
                  >
                    <option value="" disabled>
                      In column...
                    </option>
                    {(triggerType === 'ASSIGNEE_CHANGED'
                      ? personColumns
                      : statusColumns
                    ).map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                  </select>

                  {triggerNeedsColumn && (
                    <select
                      className={selectCls}
                      value={triggerToValue}
                      aria-label="Trigger value"
                      onChange={(e) => setTriggerToValue(e.target.value)}
                    >
                      <option value="">Any value</option>
                      {triggerColumnOptions.map((opt) => (
                        <option key={opt.label} value={opt.label}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}
            </div>

            {/* Action section */}
            <div className="space-y-3">
              <label className={labelCls}>THEN (Action)</label>
              <select
                className={selectCls}
                value={actionType}
                aria-label="Action type"
                onChange={(e) => setActionType(e.target.value as ActionType)}
              >
                {Object.entries(ACTION_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>

              {actionType === 'SET_STATUS' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className={selectCls}
                    value={actionStatusColumnId}
                    aria-label="Action status column"
                    onChange={(e) => setActionStatusColumnId(e.target.value)}
                  >
                    <option value="" disabled>
                      In column...
                    </option>
                    {statusColumns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectCls}
                    value={actionStatusValue}
                    aria-label="Action status value"
                    onChange={(e) => setActionStatusValue(e.target.value)}
                  >
                    <option value="" disabled>
                      to status...
                    </option>
                    {actionStatusOptions.map((opt) => (
                      <option key={opt.label} value={opt.label}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {actionType === 'SET_PERSON' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <select
                    className={selectCls}
                    value={actionPersonColumnId}
                    aria-label="Action person column"
                    onChange={(e) => setActionPersonColumnId(e.target.value)}
                  >
                    <option value="" disabled>
                      In column...
                    </option>
                    {personColumns.map((col) => (
                      <option key={col.id} value={col.id}>
                        {col.title}
                      </option>
                    ))}
                  </select>
                  <select
                    className={selectCls}
                    value={actionPersonUserId}
                    aria-label="Assign to user"
                    onChange={(e) => setActionPersonUserId(e.target.value)}
                  >
                    <option value="" disabled>
                      Assign to...
                    </option>
                    {members.map((m: { user: { id: string; name: string | null } }) => (
                      <option key={m.user.id} value={m.user.id}>
                        {m.user.name ?? m.user.id}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {actionType === 'NOTIFY' && (
                <input
                  className={inputCls}
                  placeholder="Notification message (optional)"
                  value={actionNotifyMessage}
                  aria-label="Notification message"
                  onChange={(e) => setActionNotifyMessage(e.target.value)}
                />
              )}

              {actionType === 'MOVE_TO_GROUP' && (
                <select
                  className={selectCls}
                  value={actionGroupId}
                  aria-label="Target group"
                  onChange={(e) => setActionGroupId(e.target.value)}
                >
                  <option value="" disabled>
                    Move to group...
                  </option>
                  {groups.map((g: { id: string; title: string }) => (
                    <option key={g.id} value={g.id}>
                      {g.title}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          <div className="flex gap-3">
            <button
              className="flex-1 rounded-md bg-primary px-4 py-3 text-xs font-semibold text-white shadow-lg shadow-blue-500/20 disabled:opacity-60 transition-all active:scale-[0.98]"
              disabled={!isFormValid}
              onClick={handleSubmit}
              type="button"
            >
              {editingId ? 'Update Automation' : 'Create Automation'}
            </button>
            {editingId && (
              <button
                className="rounded-md border border-slate-200 px-4 py-3 text-xs font-semibold text-slate-600 transition-all hover:bg-slate-50"
                onClick={resetForm}
                type="button"
              >
                Cancel
              </button>
            )}
          </div>
        </div>

        {/* Automation list */}
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
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground truncate">
                        {automation.name}
                      </p>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mt-0.5">
                        {automation.enabled ? (
                          <span className="text-emerald-500">● Active</span>
                        ) : (
                          <span className="text-slate-300">● Paused</span>
                        )}
                        <span className="ml-2 normal-case font-normal">
                          {describeTrigger(automation.trigger)}
                        </span>
                      </p>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      <button
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition-all"
                        onClick={() => loadAutomationForEdit(automation)}
                        type="button"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-all ${
                          automation.enabled
                            ? 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                            : 'bg-primary text-white hover:shadow-md'
                        }`}
                        onClick={() =>
                          toggleAutomation.mutate({
                            id: automation.id,
                            enabled: !automation.enabled,
                          })
                        }
                        type="button"
                      >
                        {automation.enabled ? 'Off' : 'On'}
                      </button>
                      <button
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-all"
                        onClick={() => {
                          if (confirm('Delete this automation?')) {
                            deleteAutomation.mutate({ id: automation.id });
                          }
                        }}
                        type="button"
                        title="Delete"
                      >
                        ✕
                      </button>
                    </div>
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
                  No automations yet. Create one to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAutomation ? (
        <div className="mt-8 border-t border-slate-100 pt-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Execution logs
            </p>
            <button
              className="text-[10px] text-slate-400 hover:text-slate-600"
              onClick={() => setSelectedAutomation(null)}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
            {logs?.length ? (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="rounded-xl border border-slate-100 bg-white px-4 py-3 text-xs shadow-sm"
                >
                  <p className="font-medium text-foreground">
                    {log.message ?? 'Log entry'}
                  </p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    {new Date(log.createdAt).toLocaleString()}
                    <span
                      className={`ml-2 ${
                        log.status === 'SUCCESS'
                          ? 'text-emerald-500'
                          : 'text-red-500'
                      }`}
                    >
                      {log.status}
                    </span>
                  </p>
                </div>
              ))
            ) : (
              <p className="text-xs text-slate-400 italic p-4">No logs yet.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );

  if (isDrawer) {
    return (
      <>
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="fixed right-0 top-0 z-40 flex h-screen w-full max-w-[480px] flex-col bg-white shadow-2xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
            <div>
              <h3 className="text-sm font-bold text-foreground">Automations & Rules</h3>
              <p className="mt-0.5 text-xs text-slate-400">IF [field] changes → THEN [action]</p>
            </div>
            <button
              type="button"
              className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              onClick={onClose}
              aria-label="Close automations panel"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            {innerContent}
          </div>
        </div>
      </>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-white p-6 shadow-sm">
      {innerContent}
    </div>
  );
}

function describeTrigger(trigger: unknown): string {
  const t = trigger as { type?: string; to?: string };
  if (!t?.type) return '';
  const labels: Record<string, string> = {
    STATUS_CHANGED: 'status changes',
    PRIORITY_CHANGED: 'priority changes',
    ASSIGNEE_CHANGED: 'assignee changes',
    ITEM_CREATED: 'item created',
  };
  let desc = labels[t.type] ?? t.type;
  if (t.to) desc += ` → ${t.to}`;
  return desc;
}
