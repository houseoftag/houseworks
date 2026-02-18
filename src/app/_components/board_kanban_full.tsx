'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { useToast } from './toast_provider';
import { ItemDetailPanel } from './item_detail_panel';
import type { BoardFilters } from './board_filters';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;
type ItemType = BoardData['groups'][number]['items'][number];
type StatusOption = { label: string; color: string };

const getStatusOptions = (settings: unknown): StatusOption[] => {
  if (!settings || typeof settings !== 'object') return [];
  const options = (settings as { options?: Record<string, string> }).options;
  if (!options || typeof options !== 'object') return [];
  return Object.entries(options).map(([label, color]) => ({
    label: label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    color,
  }));
};

const DONE_LABELS = ['done', 'completed', 'complete', 'finished'];

function isItemDone(item: ItemType, statusColumnId: string | null): boolean {
  const status = getItemStatus(item, statusColumnId);
  return !!status && DONE_LABELS.includes(status.label.toLowerCase());
}

function getItemStatus(item: ItemType, statusColumnId: string | null): StatusOption | null {
  if (!statusColumnId) return null;
  const cell = item.cellValues.find((c) => c.columnId === statusColumnId);
  if (!cell?.value || typeof cell.value !== 'object') return null;
  const v = cell.value as { label?: string; color?: string };
  if (!v.label) return null;
  return { label: v.label, color: v.color ?? '#94a3b8' };
}

function getItemPerson(item: ItemType, personColumnId: string | null): { userId?: string; name?: string; initials?: string } | null {
  if (!personColumnId) return null;
  const cell = item.cellValues.find((c) => c.columnId === personColumnId);
  if (!cell?.value || typeof cell.value !== 'object') return null;
  return cell.value as { userId?: string; name?: string; initials?: string };
}

function getItemDate(item: ItemType, dateColumnId: string | null): string | null {
  if (!dateColumnId) return null;
  const cell = item.cellValues.find((c) => c.columnId === dateColumnId);
  if (!cell?.value || typeof cell.value !== 'string') return null;
  return cell.value;
}

function getItemPriority(item: ItemType, priorityColumnId: string | null): StatusOption | null {
  if (!priorityColumnId) return null;
  const cell = item.cellValues.find((c) => c.columnId === priorityColumnId);
  if (!cell?.value || typeof cell.value !== 'object') return null;
  const v = cell.value as { label?: string; color?: string };
  if (!v.label) return null;
  return { label: v.label, color: v.color ?? '#94a3b8' };
}

const priorityBadgeColors: Record<string, string> = {
  critical: 'bg-rose-100 text-rose-700 border-rose-200',
  high: 'bg-orange-100 text-orange-700 border-orange-200',
  medium: 'bg-amber-100 text-amber-700 border-amber-200',
  low: 'bg-sky-100 text-sky-700 border-sky-200',
};

function PriorityBadge({ priority }: { priority: StatusOption }) {
  const key = priority.label.toLowerCase();
  const classes = priorityBadgeColors[key] ?? 'bg-slate-100 text-slate-600 border-slate-200';
  return (
    <span className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider ${classes}`}>
      {priority.label}
    </span>
  );
}

function DroppableColumn({ statusLabel, children }: { statusLabel: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${statusLabel}` });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[120px] space-y-2 rounded-xl p-2 transition-colors ${isOver ? 'bg-blue-50/50' : ''}`}
    >
      {children}
    </div>
  );
}

function KanbanCard({
  item,
  personColumnId,
  dateColumnId,
  priorityColumnId,
  statusColumnId,
  onOpenDetail,
}: {
  item: ItemType;
  personColumnId: string | null;
  dateColumnId: string | null;
  statusColumnId: string | null;
  priorityColumnId: string | null;
  onOpenDetail: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const person = getItemPerson(item, personColumnId);
  const date = getItemDate(item, dateColumnId);
  const priority = getItemPriority(item, priorityColumnId);
  const isOverdue = date && !isItemDone(item, statusColumnId) && new Date(date + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing"
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) onOpenDetail(item.id);
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground truncate flex-1">{item.name}</p>
        {priority && <PriorityBadge priority={priority} />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {person?.initials && (
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
              {person.initials}
            </div>
            <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{person.name}</span>
          </div>
        )}
        <div className="flex items-center gap-2 flex-wrap">
          {/* eslint-disable @typescript-eslint/no-explicit-any */}
          {(((item as any)._count?.dependenciesAsSource ?? 0) + ((item as any)._count?.dependenciesAsTarget ?? 0)) > 0 && (
            <span className="text-[10px] text-slate-400" title="Has dependencies" aria-label="Has dependencies" role="status">
              🔗 {((item as any)._count?.dependenciesAsSource ?? 0) + ((item as any)._count?.dependenciesAsTarget ?? 0)}
            </span>
          )}
          {/* F6: Recurrence indicator */}
          {(item as any).recurrence && (
            <span className="text-[10px] text-slate-400" title="Recurring item" aria-label="Recurring" role="status">🔄</span>
          )}
          {/* F11: Blocked badge */}
          {(() => {
            const asTarget = (item as any).dependenciesAsTarget as { type: string }[] | undefined;
            const asSource = (item as any).dependenciesAsSource as { type: string }[] | undefined;
            const isBlockedItem = asTarget?.some((d) => d.type === 'BLOCKS') || asSource?.some((d) => d.type === 'BLOCKED_BY');
            return isBlockedItem ? (
              <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-1 py-0.5 text-[9px] font-bold text-rose-600" title="Blocked" aria-label="Blocked" role="status">⛔ Blocked</span>
            ) : null;
          })()}
          {/* eslint-enable @typescript-eslint/no-explicit-any */}
          {date && (
            <span className={`text-[10px] ${isOverdue ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
              {isOverdue && '⚠ '}
              {new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              {isOverdue && <span className="ml-0.5">Overdue</span>}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function KanbanCardOverlay({ item, personColumnId, dateColumnId, priorityColumnId, statusColumnId }: {
  item: ItemType;
  personColumnId: string | null;
  dateColumnId: string | null;
  priorityColumnId: string | null;
  statusColumnId: string | null;
}) {
  const person = getItemPerson(item, personColumnId);
  const date = getItemDate(item, dateColumnId);
  const priority = getItemPriority(item, priorityColumnId);
  const isOverdue = date && !isItemDone(item, statusColumnId) && new Date(date + "T00:00:00") < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="rounded-xl border border-primary/30 bg-white p-3 shadow-lg w-[260px]">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground truncate flex-1">{item.name}</p>
        {priority && <PriorityBadge priority={priority} />}
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        {person?.initials && (
          <div className="flex items-center gap-1.5">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500">
              {person.initials}
            </div>
            <span className="text-[10px] text-slate-400 truncate max-w-[80px]">{person.name}</span>
          </div>
        )}
        {date && (
          <span className={`text-[10px] ${isOverdue ? 'text-rose-500 font-semibold' : 'text-slate-400'}`}>
            {new Date(date + "T00:00:00").toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

/** Inline quick-create input at the bottom of each column */
function QuickCreateTask({
  groupId,
  statusColumnId,
  statusValue,
  onCreated,
}: {
  groupId: string;
  statusColumnId: string | null;
  statusValue: StatusOption | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const { pushToast } = useToast();

  const createItem = trpc.items.create.useMutation();
  const updateCell = trpc.cells.update.useMutation();

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed || !groupId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const item = await createItem.mutateAsync({ groupId, name: trimmed });

      // Set status cell if we have a status column and target status
      if (statusColumnId && statusValue) {
        await updateCell.mutateAsync({
          itemId: item.id,
          columnId: statusColumnId,
          value: { label: statusValue.label, color: statusValue.color },
        });
      }

      setName('');
      onCreated();
    } catch {
      pushToast({ title: 'Failed to create task', tone: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return (
      <button
        className="w-full rounded-xl border border-dashed border-slate-200 px-3 py-2 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors text-left"
        onClick={() => {
          setIsOpen(true);
          setTimeout(() => inputRef.current?.focus(), 0);
        }}
        type="button"
      >
        + Add task
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-primary/30 bg-white p-2 shadow-sm">
      <input
        ref={inputRef}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-foreground placeholder:text-slate-300 focus:outline-none focus:border-primary"
        placeholder="Task name..."
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') handleSubmit();
          if (e.key === 'Escape') { setIsOpen(false); setName(''); }
        }}
        disabled={isSubmitting}
      />
      <div className="mt-2 flex gap-2">
        <button
          className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white disabled:opacity-50"
          onClick={handleSubmit}
          disabled={!name.trim() || isSubmitting}
          type="button"
        >
          {isSubmitting ? 'Adding…' : 'Add'}
        </button>
        <button
          className="rounded-lg px-3 py-1 text-xs text-slate-400 hover:text-slate-600"
          onClick={() => { setIsOpen(false); setName(''); }}
          type="button"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

/** Column header with inline rename */
function ColumnHeader({
  statusLabel,
  color,
  count,
  isCustomColumn,
  onRename,
  onDelete,
}: {
  statusLabel: string;
  color: string;
  count: number;
  isCustomColumn: boolean;
  onRename?: (newLabel: string) => void;
  onDelete?: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(statusLabel);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleStartEdit = () => {
    if (!isCustomColumn || !onRename) return;
    setEditValue(statusLabel);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleSave = () => {
    const trimmed = editValue.trim();
    if (trimmed && trimmed !== statusLabel && onRename) {
      onRename(trimmed);
    }
    setIsEditing(false);
  };

  return (
    <div className="flex items-center gap-2 mb-3 px-2 group">
      <div className="h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
      {isEditing ? (
        <input
          ref={inputRef}
          className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-transparent border-b border-primary focus:outline-none"
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
        />
      ) : (
        <h3
          className={`text-xs font-bold uppercase tracking-wider text-slate-500 ${isCustomColumn ? 'cursor-pointer hover:text-slate-700' : ''}`}
          onDoubleClick={handleStartEdit}
          title={isCustomColumn ? 'Double-click to rename' : undefined}
        >
          {statusLabel}
        </h3>
      )}
      <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
        {count}
      </span>
      {isCustomColumn && onDelete && (
        <button
          className="opacity-0 group-hover:opacity-100 text-[10px] text-slate-300 hover:text-rose-400 transition-all"
          onClick={onDelete}
          type="button"
          title="Remove column"
        >
          ✕
        </button>
      )}
    </div>
  );
}

/** Add new column button */
function AddColumnButton({ onAdd }: { onAdd: (label: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [label, setLabel] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = () => {
    const trimmed = label.trim();
    if (trimmed) {
      onAdd(trimmed);
      setLabel('');
      setIsOpen(false);
    }
  };

  if (!isOpen) {
    return (
      <div className="flex-shrink-0 w-[280px]">
        <button
          className="w-full rounded-xl border border-dashed border-slate-200 p-4 text-xs text-slate-400 hover:border-slate-300 hover:text-slate-500 transition-colors"
          onClick={() => {
            setIsOpen(true);
            setTimeout(() => inputRef.current?.focus(), 0);
          }}
          type="button"
        >
          + Add Column
        </button>
      </div>
    );
  }

  return (
    <div className="flex-shrink-0 w-[280px]">
      <div className="rounded-xl border border-primary/30 bg-white p-3 shadow-sm">
        <input
          ref={inputRef}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-foreground placeholder:text-slate-300 focus:outline-none focus:border-primary"
          placeholder="Column name..."
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSubmit();
            if (e.key === 'Escape') { setIsOpen(false); setLabel(''); }
          }}
        />
        <div className="mt-2 flex gap-2">
          <button
            className="rounded-lg bg-primary px-3 py-1 text-xs font-semibold text-white"
            onClick={handleSubmit}
            disabled={!label.trim()}
            type="button"
          >
            Add
          </button>
          <button
            className="rounded-lg px-3 py-1 text-xs text-slate-400 hover:text-slate-600"
            onClick={() => { setIsOpen(false); setLabel(''); }}
            type="button"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

export function BoardKanbanFull({
  board,
  filters,
}: {
  board: BoardData;
  filters: BoardFilters;
  memberOptions?: { id: string; name: string }[];
}) {
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ItemType | null>(null);
  const didDragRef = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Find typed columns
  const statusColumn = useMemo(() => board.columns.find((c) => c.type === 'STATUS') ?? null, [board.columns]);
  const statusColumnId = statusColumn?.id ?? null;
  const personColumn = useMemo(() => board.columns.find((c) => c.type === 'PERSON') ?? null, [board.columns]);
  const personColumnId = personColumn?.id ?? null;
  const dateColumn = useMemo(() => board.columns.find((c) => c.type === 'DATE') ?? null, [board.columns]);
  const dateColumnId = dateColumn?.id ?? null;
  // Find a second STATUS column used as priority, or look for a column titled "Priority"
  const priorityColumn = useMemo(() => {
    const statusCols = board.columns.filter((c) => c.type === 'STATUS');
    // If there's a column explicitly named "Priority", use that
    const explicit = board.columns.find((c) => c.type === 'STATUS' && c.title.toLowerCase() === 'priority');
    if (explicit) return explicit;
    // If there are 2+ STATUS columns, use the second one
    if (statusCols.length >= 2) return statusCols[1] ?? null;
    return null;
  }, [board.columns]);
  const priorityColumnId = priorityColumn?.id ?? null;

  const statusOptions = useMemo(() => {
    if (!statusColumn) return [{ label: 'No Status', color: '#94a3b8' }];
    const opts = getStatusOptions(statusColumn.settings);
    return opts.length > 0 ? opts : [{ label: 'No Status', color: '#94a3b8' }];
  }, [statusColumn]);

  // Flatten all items
  const allItems = useMemo(() => {
    const items: ItemType[] = [];
    for (const group of board.groups) {
      items.push(...group.items);
    }
    return items;
  }, [board.groups]);

  // Default group for creating new items
  const defaultGroupId = board.groups[0]?.id ?? null;

  // Apply filters
  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      if (filters.status) {
        const status = getItemStatus(item, statusColumnId);
        if (status?.label !== filters.status) return false;
      }
      if (filters.person) {
        const person = getItemPerson(item, personColumnId);
        if (person?.userId !== filters.person) return false;
      }
      return true;
    });
  }, [allItems, filters, statusColumnId, personColumnId]);

  // Group items by status
  const itemsByStatus = useMemo(() => {
    const map = new Map<string, ItemType[]>();
    for (const opt of statusOptions) {
      map.set(opt.label, []);
    }
    if (!map.has('No Status')) {
      map.set('No Status', []);
    }
    // Build a case-insensitive lookup: lowercased label → canonical label
    const canonicalLabel = new Map<string, string>();
    for (const opt of statusOptions) {
      canonicalLabel.set(opt.label.toLowerCase(), opt.label);
    }
    canonicalLabel.set('no status', 'No Status');

    for (const item of filteredItems) {
      const status = getItemStatus(item, statusColumnId);
      const rawLabel = status?.label ?? 'No Status';
      // Resolve to the canonical (title-cased) column key via case-insensitive match
      const resolved = canonicalLabel.get(rawLabel.toLowerCase()) ?? 'No Status';
      const bucket = map.get(resolved);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(resolved, [item]);
      }
    }
    return map;
  }, [filteredItems, statusOptions, statusColumnId]);

  const invalidateBoard = useCallback(async () => {
    await utils.boards.getById.invalidate({ id: board.id });
    await utils.boards.getDefault.invalidate();
  }, [utils, board.id]);

  const updateCell = trpc.cells.update.useMutation({
    onSettled: invalidateBoard,
    onError: () => {
      pushToast({ title: 'Failed to update status', tone: 'error' });
    },
  });

  const updateColumn = trpc.columns.update.useMutation({
    onSettled: invalidateBoard,
    onSuccess: () => pushToast({ title: 'Column updated', tone: 'success' }),
    onError: () => pushToast({ title: 'Failed to update column', tone: 'error' }),
  });

  const handleDragStart = (event: DragStartEvent) => {
    didDragRef.current = true;
    const item = allItems.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    setTimeout(() => { didDragRef.current = false; }, 0);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    let targetStatusLabel: string | null = null;

    if (overId.startsWith('column:')) {
      targetStatusLabel = overId.slice('column:'.length);
    } else {
      const overItem = allItems.find((i) => i.id === overId);
      if (overItem) {
        const status = getItemStatus(overItem, statusColumnId);
        targetStatusLabel = status?.label ?? 'No Status';
      }
    }

    if (!targetStatusLabel || !statusColumnId) return;

    const draggedItem = allItems.find((i) => i.id === active.id);
    if (!draggedItem) return;

    const currentStatus = getItemStatus(draggedItem, statusColumnId);
    if (currentStatus?.label === targetStatusLabel) return;

    const targetOption = statusOptions.find((o) => o.label === targetStatusLabel);
    if (!targetOption && targetStatusLabel !== 'No Status') return;

    if (targetStatusLabel === 'No Status') {
      updateCell.mutate({ itemId: draggedItem.id, columnId: statusColumnId, value: null });
    } else {
      updateCell.mutate({
        itemId: draggedItem.id,
        columnId: statusColumnId,
        value: { label: targetOption!.label, color: targetOption!.color },
      });
    }
  };

  // Column rename handler — updates STATUS column settings
  const handleRenameColumn = (oldLabel: string, newLabel: string) => {
    if (!statusColumn) return;
    const settings = statusColumn.settings as { options?: Record<string, string> } | null;
    if (!settings?.options) return;
    const newOptions: Record<string, string> = {};
    for (const [label, color] of Object.entries(settings.options)) {
      if (label === oldLabel) {
        newOptions[newLabel] = color;
      } else {
        newOptions[label] = color;
      }
    }
    updateColumn.mutate({ id: statusColumn.id, settings: { options: newOptions } });
  };

  // Column delete handler — removes a status option (with confirmation)
  const handleDeleteColumn = (label: string) => {
    if (!statusColumn) return;
    const settings = statusColumn.settings as { options?: Record<string, string> } | null;
    if (!settings?.options) return;
    const count = itemsByStatus.get(label)?.length ?? 0;
    const msg = count > 0
      ? `Delete column "${label}"? ${count} item${count === 1 ? '' : 's'} will move to No Status.`
      : `Delete column "${label}"?`;
    if (!window.confirm(msg)) return;
    const newOptions = { ...settings.options };
    delete newOptions[label];
    updateColumn.mutate({ id: statusColumn.id, settings: { options: newOptions } });
  };

  // Column add handler
  const handleAddColumn = (label: string) => {
    if (!statusColumn) return;
    const settings = statusColumn.settings as { options?: Record<string, string> } | null;
    const currentOptions = settings?.options ?? {};
    // Pick a random-ish color
    const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f97316', '#eab308', '#22c55e'];
    const color = colors[Object.keys(currentOptions).length % colors.length] ?? '#64748b';
    const newOptions = { ...currentOptions, [label]: color };
    updateColumn.mutate({ id: statusColumn.id, settings: { options: newOptions } });
  };

  const columnOrder = useMemo(() => {
    const cols = statusOptions.map((o) => o.label);
    if (!cols.includes('No Status')) {
      cols.unshift('No Status');
    }
    return cols;
  }, [statusOptions]);

  if (!statusColumn) {
    return (
      <div className="rounded-2xl border border-border bg-white p-8 text-center shadow-sm">
        <p className="text-sm text-slate-500">
          No Status column found on this board. Add a STATUS column to use the Board view.
        </p>
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-4 sm:p-6 overflow-x-auto min-h-[400px]">
          {columnOrder.map((statusLabel) => {
            const items = itemsByStatus.get(statusLabel) ?? [];
            const opt = statusOptions.find((o) => o.label === statusLabel);
            const color = opt?.color ?? '#94a3b8';
            const isCustomColumn = statusLabel !== 'No Status';
            const statusValue = opt ?? null;

            return (
              <div key={statusLabel} className="flex-shrink-0 w-[260px] sm:w-[280px]">
                <ColumnHeader
                  statusLabel={statusLabel}
                  color={color}
                  count={items.length}
                  isCustomColumn={isCustomColumn}
                  onRename={isCustomColumn ? (newLabel) => handleRenameColumn(statusLabel, newLabel) : undefined}
                  onDelete={isCustomColumn ? () => handleDeleteColumn(statusLabel) : undefined}
                />

                <DroppableColumn statusLabel={statusLabel}>
                  <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                    {items.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center text-xs text-slate-400">
                        Drop items here
                      </div>
                    ) : (
                      items.map((item) => (
                        <KanbanCard
                          key={item.id}
                          item={item}
                          personColumnId={personColumnId}
                          dateColumnId={dateColumnId}
                          priorityColumnId={priorityColumnId}
                          statusColumnId={statusColumnId}
                          onOpenDetail={(id) => { if (!didDragRef.current) setSelectedItemId(id); }}
                        />
                      ))
                    )}
                  </SortableContext>
                </DroppableColumn>

                {defaultGroupId && (
                  <div className="mt-2 px-2">
                    <QuickCreateTask
                      groupId={defaultGroupId}
                      statusColumnId={statusColumnId}
                      statusValue={statusValue}
                      onCreated={invalidateBoard}
                    />
                  </div>
                )}
              </div>
            );
          })}

          <AddColumnButton onAdd={handleAddColumn} />
        </div>

        <DragOverlay>
          {activeItem ? (
            <KanbanCardOverlay
              item={activeItem}
              personColumnId={personColumnId}
              dateColumnId={dateColumnId}
              priorityColumnId={priorityColumnId}
              statusColumnId={statusColumnId}
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      {selectedItemId && (
        <ItemDetailPanel
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </section>
  );
}
