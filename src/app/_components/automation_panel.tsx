/* eslint-disable @typescript-eslint/no-explicit-any -- tRPC inferred types need any for Json fields */
'use client';

import { useMemo, useState } from 'react';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { useToast } from './toast_provider';
import { CustomSelect } from './custom_select';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type AutomationPanelProps = {
  board: BoardData;
  onBack?: () => void;
};

type TriggerType =
  | 'STATUS_CHANGED'
  | 'PRIORITY_CHANGED'
  | 'ASSIGNEE_CHANGED'
  | 'ITEM_CREATED'
  | 'COLUMN_CHANGED'
  | 'CRON_INTERVAL'
  | 'CRON_DAILY'
  | 'CRON_WEEKLY';

type ActionType =
  | 'LOG'
  | 'NOTIFY'
  | 'MOVE_TO_GROUP'
  | 'SET_PERSON'
  | 'SET_STATUS'
  | 'IF_ELSE';

type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'is_empty';

type Condition = {
  columnId: string;
  operator: ConditionOperator;
  value: string;
};

type IfElseAction = {
  type: 'IF_ELSE';
  condition: Condition;
  thenActions: SimpleAction[];
  elseActions: SimpleAction[];
};

type SimpleAction = {
  type: Exclude<ActionType, 'IF_ELSE'>;
  payload?: Record<string, unknown>;
};

type AnyAction = SimpleAction | IfElseAction;

const TRIGGER_LABELS: Record<TriggerType, string> = {
  STATUS_CHANGED: 'When status changes',
  PRIORITY_CHANGED: 'When priority changes',
  ASSIGNEE_CHANGED: 'When assignee changes',
  ITEM_CREATED: 'When item is created',
  COLUMN_CHANGED: 'Column value changed',
  CRON_INTERVAL: 'Every X hours',
  CRON_DAILY: 'Every day at time',
  CRON_WEEKLY: 'Every week on day',
};

const ACTION_LABELS: Record<ActionType, string> = {
  LOG: 'Just log it',
  SET_STATUS: 'Set status',
  SET_PERSON: 'Auto-assign person',
  NOTIFY: 'Send notification',
  MOVE_TO_GROUP: 'Move to group',
  IF_ELSE: 'If / Else branch',
};

const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'not equals',
  contains: 'contains',
  is_empty: 'is empty',
};

const DAYS_OF_WEEK = [
  { value: '0', label: 'Sunday' },
  { value: '1', label: 'Monday' },
  { value: '2', label: 'Tuesday' },
  { value: '3', label: 'Wednesday' },
  { value: '4', label: 'Thursday' },
  { value: '5', label: 'Friday' },
  { value: '6', label: 'Saturday' },
];

const getStatusOptions = (settings: unknown) => {
  if (!settings || typeof settings !== 'object') return [];
  const options = (settings as { options?: Record<string, string> }).options;
  if (!options || typeof options !== 'object') return [];
  return Object.entries(options).map(([label, color]) => ({ label, color }));
};

function ConditionRow({
  condition,
  columns,
  onChange,
  onRemove,
  showRemove,
  inputCls,
}: {
  condition: Condition;
  columns: { id: string; title: string }[];
  onChange: (c: Condition) => void;
  onRemove: () => void;
  showRemove: boolean;
  inputCls: string;
}) {
  return (
    <div className="flex gap-2 items-center">
      <div className="flex-1 grid gap-2 sm:grid-cols-3">
        <CustomSelect
          value={condition.columnId}
          placeholder="Column..."
          options={columns.map((c) => ({ value: c.id, label: c.title }))}
          onChange={(val) => onChange({ ...condition, columnId: val })}
        />
        <CustomSelect
          value={condition.operator}
          options={Object.entries(OPERATOR_LABELS).map(([val, label]) => ({ value: val, label }))}
          onChange={(val) => onChange({ ...condition, operator: val as ConditionOperator })}
        />
        {condition.operator !== 'is_empty' && (
          <input
            className={inputCls}
            placeholder="Value..."
            value={condition.value}
            onChange={(e) => onChange({ ...condition, value: e.target.value })}
          />
        )}
      </div>
      {showRemove && (
        <button
          type="button"
          className="flex-shrink-0 text-slate-400 hover:text-red-500 transition-colors text-sm font-bold"
          onClick={onRemove}
          aria-label="Remove condition"
        >
          ×
        </button>
      )}
    </div>
  );
}

export function AutomationPanel({ board, onBack }: AutomationPanelProps) {
  const { pushToast } = useToast();
  const utils = trpc.useUtils();
  const [name, setName] = useState('New Automation');
  const [triggerType, setTriggerType] = useState<TriggerType>('STATUS_CHANGED');
  const [triggerColumnId, setTriggerColumnId] = useState(
    board.columns.find((c) => c.type === 'STATUS')?.id ?? '',
  );
  const [triggerToValue, setTriggerToValue] = useState('');

  // Cron fields
  const [cronInterval, setCronInterval] = useState(24);
  const [cronTime, setCronTime] = useState('09:00');
  const [cronDay, setCronDay] = useState('1');

  // AND/OR multi-condition
  const [conditionLogic, setConditionLogic] = useState<'AND' | 'OR'>('AND');
  const [conditions, setConditions] = useState<Condition[]>([
    { columnId: '', operator: 'equals', value: '' },
  ]);

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

  // IF/ELSE extra actions list
  const [extraActions, setExtraActions] = useState<AnyAction[]>([]);

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
  const triggerIsCron =
    triggerType === 'CRON_INTERVAL' || triggerType === 'CRON_DAILY' || triggerType === 'CRON_WEEKLY';

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
    setCronInterval(24);
    setCronTime('09:00');
    setCronDay('1');
    setConditionLogic('AND');
    setConditions([{ columnId: '', operator: 'equals', value: '' }]);
    setActionType('LOG');
    setActionStatusValue('');
    setActionPersonUserId('');
    setActionGroupId('');
    setActionNotifyMessage('');
    setExtraActions([]);
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
    if (triggerType === 'COLUMN_CHANGED' && triggerColumnId) {
      trigger.columnId = triggerColumnId;
    }
    if (triggerType === 'CRON_INTERVAL') {
      trigger.intervalHours = cronInterval;
    }
    if (triggerType === 'CRON_DAILY') {
      trigger.time = cronTime;
    }
    if (triggerType === 'CRON_WEEKLY') {
      trigger.dayOfWeek = cronDay;
      trigger.time = cronTime;
    }
    // Attach AND/OR conditions when not a cron trigger
    if (!triggerIsCron) {
      const filledConditions = conditions.filter((c) => c.columnId);
      if (filledConditions.length > 0) {
        trigger.logic = conditionLogic;
        trigger.conditions = filledConditions;
      }
    }
    return trigger;
  }

  function buildPrimaryAction(): AnyAction {
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
      case 'IF_ELSE':
        return {
          type: 'IF_ELSE' as const,
          condition: { columnId: '', operator: 'equals', value: '' },
          thenActions: [],
          elseActions: [],
        };
    }
  }

  function handleSubmit() {
    const trigger = buildTrigger();
    const primaryAction = buildPrimaryAction();
    const allActions = [primaryAction, ...extraActions];

    if (editingId) {
      updateAutomation.mutate({
        id: editingId,
        name,
        trigger: trigger as any,
        actions: allActions as any,
      });
    } else {
      createAutomation.mutate({
        workspaceId: board.workspaceId,
        boardId: board.id,
        name,
        trigger: trigger as any,
        actions: allActions as any,
      });
    }
  }

  function loadAutomationForEdit(automation: NonNullable<typeof automations>[number]) {
    const trigger = automation.trigger as Record<string, any>;
    const actions = automation.actions as Array<{ type: string; payload?: Record<string, unknown> }>;
    const action = actions[0];

    setEditingId(automation.id);
    setName(automation.name);
    setTriggerType((trigger.type as TriggerType) ?? 'STATUS_CHANGED');
    if (trigger.columnId) setTriggerColumnId(trigger.columnId);
    if (trigger.to) setTriggerToValue(trigger.to);
    if (trigger.intervalHours) setCronInterval(trigger.intervalHours as number);
    if (trigger.time) setCronTime(trigger.time as string);
    if (trigger.dayOfWeek) setCronDay(trigger.dayOfWeek as string);
    if (trigger.logic) setConditionLogic(trigger.logic as 'AND' | 'OR');
    if (trigger.conditions && Array.isArray(trigger.conditions)) {
      setConditions(trigger.conditions as Condition[]);
    }

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

    // Load extra actions (index 1+)
    const extras = actions.slice(1).map((a) => ({
      type: a.type as Exclude<ActionType, 'IF_ELSE'>,
      payload: a.payload,
    }));
    setExtraActions(extras);
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
    'w-full rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground placeholder:text-slate-400 focus:bg-card focus:border-primary focus:outline-none transition-all';
  const labelCls =
    'text-[10px] uppercase font-bold tracking-[0.1em] text-slate-400 ml-1';

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Header with back button */}
      <div className="flex items-center gap-3 mb-6">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-primary transition-colors font-medium"
            aria-label="Back to board"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        )}
        <div>
          <h3 className="text-sm font-bold text-foreground">Automations &amp; Rules</h3>
          <p className="mt-0.5 text-xs text-slate-400">
            IF [trigger] → THEN [action]
          </p>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr]">
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
              <CustomSelect
                value={triggerType}
                options={Object.entries(TRIGGER_LABELS).map(([val, label]) => ({ value: val, label }))}
                onChange={(val) => setTriggerType(val as TriggerType)}
              />

              {(triggerNeedsColumn || triggerType === 'ASSIGNEE_CHANGED' || triggerType === 'COLUMN_CHANGED') && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <CustomSelect
                    value={triggerColumnId}
                    placeholder="In column..."
                    options={(triggerType === 'ASSIGNEE_CHANGED'
                      ? personColumns
                      : statusColumns
                    ).map((col) => ({ value: col.id, label: col.title }))}
                    onChange={(val) => setTriggerColumnId(val)}
                  />

                  {triggerNeedsColumn && (
                    <CustomSelect
                      value={triggerToValue}
                      placeholder="Any value"
                      options={triggerColumnOptions.map((opt) => ({ value: opt.label, label: opt.label }))}
                      onChange={(val) => setTriggerToValue(val)}
                    />
                  )}
                </div>
              )}

              {triggerType === 'CRON_INTERVAL' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">Every</span>
                  <input
                    type="number"
                    min={1}
                    max={168}
                    value={cronInterval}
                    onChange={(e) => setCronInterval(Math.max(1, Math.min(168, Number(e.target.value))))}
                    className="w-20 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:bg-card focus:border-primary focus:outline-none transition-all"
                    aria-label="Interval hours"
                  />
                  <span className="text-xs text-slate-500">hours</span>
                </div>
              )}

              {triggerType === 'CRON_DAILY' && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">At</span>
                  <input
                    type="time"
                    value={cronTime}
                    onChange={(e) => setCronTime(e.target.value)}
                    className="rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:bg-card focus:border-primary focus:outline-none transition-all"
                    aria-label="Time of day"
                  />
                </div>
              )}

              {triggerType === 'CRON_WEEKLY' && (
                <div className="grid gap-2 sm:grid-cols-2">
                  <CustomSelect
                    value={cronDay}
                    options={DAYS_OF_WEEK}
                    onChange={(val) => setCronDay(val)}
                  />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-500">At</span>
                    <input
                      type="time"
                      value={cronTime}
                      onChange={(e) => setCronTime(e.target.value)}
                      className="flex-1 rounded-xl border border-border bg-background px-3 py-2 text-xs text-foreground focus:bg-card focus:border-primary focus:outline-none transition-all"
                      aria-label="Time of day"
                    />
                  </div>
                </div>
              )}

              {/* AND/OR condition block (not shown for cron triggers) */}
              {!triggerIsCron && (
                <div className="space-y-2 rounded-xl border border-border bg-background/50 p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      Conditions
                    </span>
                    <div className="flex rounded-lg border border-border overflow-hidden text-[10px] font-bold">
                      <button
                        type="button"
                        className={`px-2 py-1 transition-colors ${conditionLogic === 'AND' ? 'bg-primary text-white' : 'bg-card text-slate-500 hover:bg-background'}`}
                        onClick={() => setConditionLogic('AND')}
                      >
                        AND
                      </button>
                      <button
                        type="button"
                        className={`px-2 py-1 transition-colors ${conditionLogic === 'OR' ? 'bg-primary text-white' : 'bg-card text-slate-500 hover:bg-background'}`}
                        onClick={() => setConditionLogic('OR')}
                      >
                        OR
                      </button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {conditions.map((cond, idx) => (
                      <ConditionRow
                        key={idx}
                        condition={cond}
                        columns={board.columns}
                        onChange={(updated) =>
                          setConditions((prev) => prev.map((c, i) => (i === idx ? updated : c)))
                        }
                        onRemove={() =>
                          setConditions((prev) => prev.filter((_, i) => i !== idx))
                        }
                        showRemove={conditions.length > 1}
                        inputCls={inputCls}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
                    onClick={() =>
                      setConditions((prev) => [
                        ...prev,
                        { columnId: '', operator: 'equals', value: '' },
                      ])
                    }
                  >
                    + Add condition
                  </button>
                </div>
              )}
            </div>

            {/* Action section */}
            <div className="space-y-3">
              <label className={labelCls}>THEN (Action)</label>
              <CustomSelect
                value={actionType}
                options={Object.entries(ACTION_LABELS).map(([val, label]) => ({ value: val, label }))}
                onChange={(val) => setActionType(val as ActionType)}
              />

              {actionType === 'SET_STATUS' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <CustomSelect
                    value={actionStatusColumnId}
                    placeholder="In column..."
                    options={statusColumns.map((col) => ({ value: col.id, label: col.title }))}
                    onChange={(val) => setActionStatusColumnId(val)}
                  />
                  <CustomSelect
                    value={actionStatusValue}
                    placeholder="to status..."
                    options={actionStatusOptions.map((opt) => ({ value: opt.label, label: opt.label }))}
                    onChange={(val) => setActionStatusValue(val)}
                  />
                </div>
              )}

              {actionType === 'SET_PERSON' && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <CustomSelect
                    value={actionPersonColumnId}
                    placeholder="In column..."
                    options={personColumns.map((col) => ({ value: col.id, label: col.title }))}
                    onChange={(val) => setActionPersonColumnId(val)}
                  />
                  <CustomSelect
                    value={actionPersonUserId}
                    placeholder="Assign to..."
                    options={members.map((m: { user: { id: string; name: string | null } }) => ({
                      value: m.user.id,
                      label: m.user.name ?? m.user.id,
                    }))}
                    onChange={(val) => setActionPersonUserId(val)}
                  />
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
                <CustomSelect
                  value={actionGroupId}
                  placeholder="Move to group..."
                  options={groups.map((g: { id: string; title: string }) => ({
                    value: g.id,
                    label: g.title,
                  }))}
                  onChange={(val) => setActionGroupId(val)}
                />
              )}

              {actionType === 'IF_ELSE' && (
                <div className="rounded-xl border border-border bg-background/50 p-3 space-y-2">
                  <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                    IF condition is met, Then / Else branches will be configured after saving.
                  </p>
                </div>
              )}
            </div>

            {/* Extra actions (IF/ELSE blocks) */}
            {extraActions.length > 0 && (
              <div className="space-y-2">
                <label className={labelCls}>Additional actions</label>
                {extraActions.map((extra, idx) => {
                  if (extra.type === 'IF_ELSE') {
                    const ifElse = extra as unknown as IfElseAction;
                    return (
                      <div
                        key={idx}
                        className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] uppercase font-bold tracking-wider text-primary">
                            If / Then / Else
                          </span>
                          <button
                            type="button"
                            className="text-slate-400 hover:text-red-500 transition-colors text-sm font-bold"
                            onClick={() =>
                              setExtraActions((prev) => prev.filter((_, i) => i !== idx))
                            }
                          >
                            ×
                          </button>
                        </div>
                        <div className="pl-3 border-l-2 border-primary/30 space-y-1.5">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">If</p>
                          <ConditionRow
                            condition={ifElse.condition}
                            columns={board.columns}
                            onChange={(updated) =>
                              setExtraActions((prev) =>
                                prev.map((a, i) =>
                                  i === idx ? { ...a, condition: updated } as unknown as AnyAction : a,
                                ),
                              )
                            }
                            onRemove={() => {}}
                            showRemove={false}
                            inputCls={inputCls}
                          />
                          <p className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider mt-2">Then</p>
                          <p className="text-xs text-slate-400 italic">
                            {ifElse.thenActions.length
                              ? `${ifElse.thenActions.length} action(s)`
                              : 'No then-actions configured'}
                          </p>
                          <p className="text-[10px] text-amber-600 font-bold uppercase tracking-wider mt-1">Else</p>
                          <p className="text-xs text-slate-400 italic">
                            {ifElse.elseActions.length
                              ? `${ifElse.elseActions.length} action(s)`
                              : 'No else-actions configured'}
                          </p>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between rounded-xl border border-border bg-background px-3 py-2 text-xs"
                    >
                      <span className="text-foreground/70 font-medium">
                        {ACTION_LABELS[extra.type] ?? extra.type}
                      </span>
                      <button
                        type="button"
                        className="text-slate-400 hover:text-red-500 transition-colors font-bold"
                        onClick={() =>
                          setExtraActions((prev) => prev.filter((_, i) => i !== idx))
                        }
                      >
                        ×
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add IF/ELSE button */}
            <button
              type="button"
              className="text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
              onClick={() =>
                setExtraActions((prev) => [
                  ...prev,
                  {
                    type: 'IF_ELSE' as const,
                    condition: { columnId: '', operator: 'equals', value: '' },
                    thenActions: [],
                    elseActions: [],
                  } as unknown as AnyAction,
                ])
              }
            >
              + Add if/else block
            </button>
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
                className="rounded-md border border-border px-4 py-3 text-xs font-semibold text-foreground/70 transition-all hover:bg-background"
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
                  className="rounded-xl border border-border bg-background px-4 py-3 group hover:border-primary/30 transition-colors"
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
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-muted text-slate-500 hover:bg-border transition-all"
                        onClick={() => loadAutomationForEdit(automation)}
                        type="button"
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className={`text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg transition-all ${
                          automation.enabled
                            ? 'bg-border text-foreground/70 hover:bg-slate-300'
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
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500/20 transition-all"
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
              <div className="rounded-xl border border-dashed border-border p-8 text-center bg-background/50">
                <p className="text-xs text-slate-400 italic">
                  No automations yet. Create one to get started.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedAutomation ? (
        <div className="mt-8 border-t border-border pt-6 animate-in fade-in duration-500">
          <div className="flex items-center justify-between">
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
              Execution logs
            </p>
            <button
              className="text-[10px] text-slate-400 hover:text-foreground/70"
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
                  className="rounded-xl border border-border bg-card px-4 py-3 text-xs shadow-sm"
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
    </div>
  );
}

function describeTrigger(trigger: unknown): string {
  const t = trigger as { type?: string; to?: string; intervalHours?: number; time?: string; dayOfWeek?: string };
  if (!t?.type) return '';
  const labels: Record<string, string> = {
    STATUS_CHANGED: 'status changes',
    PRIORITY_CHANGED: 'priority changes',
    ASSIGNEE_CHANGED: 'assignee changes',
    ITEM_CREATED: 'item created',
    COLUMN_CHANGED: 'column value changed',
    CRON_INTERVAL: `every ${t.intervalHours ?? '?'} hours`,
    CRON_DAILY: `daily at ${t.time ?? '?'}`,
    CRON_WEEKLY: `weekly on day ${t.dayOfWeek ?? '?'} at ${t.time ?? '?'}`,
  };
  let desc = labels[t.type] ?? t.type;
  if (t.to) desc += ` → ${t.to}`;
  return desc;
}
