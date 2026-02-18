'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import { useToast } from './toast_provider';
import { ItemDetailPanel } from './item_detail_panel';
import type { BoardFilters, BoardSort } from './board_filters';
import { filterAndSortItems } from './board_filter_utils';

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

function KanbanCard({
  item,
  personColumnId,
  dateColumnId,
  onOpenDetail,
  onDragStart,
}: {
  item: ItemType;
  personColumnId: string | null;
  dateColumnId: string | null;
  onOpenDetail: (id: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
}) {
  const person = getItemPerson(item, personColumnId);
  const date = getItemDate(item, dateColumnId);
  const isOverdue = date && new Date(date) < new Date(new Date().setHours(0, 0, 0, 0));
  const didDrag = useRef(false);

  return (
    <div
      draggable
      role="listitem"
      aria-roledescription="Draggable item"
      aria-label={`${item.name}. Drag to move between columns.`}
      onDragStart={(e) => {
        didDrag.current = true;
        onDragStart(e, item.id);
      }}
      onDragEnd={() => {
        // Reset after a tick so the click handler can check
        setTimeout(() => { didDrag.current = false; }, 50);
      }}
      onClick={() => {
        if (!didDrag.current) onOpenDetail(item.id);
      }}
      className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow cursor-grab active:cursor-grabbing select-none"
    >
      <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
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
            {new Date(date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        )}
      </div>
    </div>
  );
}

function KanbanColumn({
  statusLabel,
  color,
  items,
  personColumnId,
  dateColumnId,
  onOpenDetail,
  onDragStart,
  onDropItem,
}: {
  statusLabel: string;
  color: string;
  items: ItemType[];
  personColumnId: string | null;
  dateColumnId: string | null;
  onOpenDetail: (id: string) => void;
  onDragStart: (e: React.DragEvent, itemId: string) => void;
  onDropItem: (statusLabel: string) => void;
}) {
  const [isOver, setIsOver] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setIsOver(true);
  }, []);

  const handleDragLeave = useCallback(() => {
    setIsOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsOver(false);
    onDropItem(statusLabel);
  }, [onDropItem, statusLabel]);

  return (
    <div className="flex-shrink-0 w-[min(280px,85vw)]">
      <div className="flex items-center gap-2 mb-3 px-2">
        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
          {statusLabel}
        </h3>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
          {items.length}
        </span>
      </div>

      <div
        role="list"
        aria-label={`${statusLabel} column, ${items.length} items. Drop zone.`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`min-h-[200px] space-y-2 rounded-xl p-2 transition-colors ${isOver ? 'bg-blue-50 border-2 border-dashed border-blue-200' : ''}`}
      >
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
              onOpenDetail={onOpenDetail}
              onDragStart={onDragStart}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function BoardKanban({ board, filters, sort }: { board: BoardData; filters: BoardFilters; sort: BoardSort }) {
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const draggedItemId = useRef<string | null>(null);

  // Find the first STATUS column and its options
  const statusColumn = useMemo(() => board.columns.find((c) => c.type === 'STATUS' && !c.title.toLowerCase().includes('priority')) ?? board.columns.find((c) => c.type === 'STATUS') ?? null, [board.columns]);
  const statusColumnId = statusColumn?.id ?? null;
  const personColumn = useMemo(() => board.columns.find((c) => c.type === 'PERSON') ?? null, [board.columns]);
  const personColumnId = personColumn?.id ?? null;
  const dateColumn = useMemo(() => board.columns.find((c) => c.type === 'DATE') ?? null, [board.columns]);
  const dateColumnId = dateColumn?.id ?? null;

  const statusOptions = useMemo(() => {
    if (!statusColumn) return [{ label: 'No Status', color: '#94a3b8' }];
    const opts = getStatusOptions(statusColumn.settings);
    return opts.length > 0 ? opts : [{ label: 'No Status', color: '#94a3b8' }];
  }, [statusColumn]);

  // Flatten all items from all groups
  const allItems = useMemo(() => {
    const items: ItemType[] = [];
    for (const group of board.groups) {
      items.push(...group.items);
    }
    return items;
  }, [board.groups]);

  // Apply filters and sort
  const filteredItems = useMemo(() => {
    return filterAndSortItems(allItems, filters, sort, board.columns);
  }, [allItems, filters, sort, board.columns]);

  // Group items by status label
  const itemsByStatus = useMemo(() => {
    const map = new Map<string, ItemType[]>();
    for (const opt of statusOptions) {
      map.set(opt.label, []);
    }
    if (!map.has('No Status')) {
      map.set('No Status', []);
    }
    for (const item of filteredItems) {
      const status = getItemStatus(item, statusColumnId);
      const label = status?.label ?? 'No Status';
      const bucket = map.get(label);
      if (bucket) {
        bucket.push(item);
      } else {
        map.set(label, [item]);
      }
    }
    return map;
  }, [filteredItems, statusOptions, statusColumnId]);

  const updateCell = trpc.cells.update.useMutation({
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({ title: 'Failed to update status', tone: 'error' });
    },
  });

  const handleDragStart = useCallback((_e: React.DragEvent, itemId: string) => {
    draggedItemId.current = itemId;
  }, []);

  const handleDropOnColumn = useCallback((targetStatusLabel: string) => {
    const itemId = draggedItemId.current;
    draggedItemId.current = null;
    if (!itemId || !statusColumnId) return;

    const draggedItem = allItems.find((i) => i.id === itemId);
    if (!draggedItem) return;

    const currentStatus = getItemStatus(draggedItem, statusColumnId);
    if (currentStatus?.label === targetStatusLabel) return;

    const targetOption = statusOptions.find((o) => o.label === targetStatusLabel);

    if (targetStatusLabel === 'No Status') {
      updateCell.mutate({ itemId: draggedItem.id, columnId: statusColumnId, value: null });
    } else if (targetOption) {
      updateCell.mutate({
        itemId: draggedItem.id,
        columnId: statusColumnId,
        value: { label: targetOption.label, color: targetOption.color },
      });
    }
  }, [allItems, statusColumnId, statusOptions, updateCell]);

  // Build column order
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

  const hasActiveFilters = filters.status !== null || filters.person !== null || filters.priority !== null || filters.dueDateFrom !== null || filters.dueDateTo !== null;

  if (filteredItems.length === 0 && hasActiveFilters) {
    return (
      <section className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="border-b border-border px-6 py-4 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs uppercase tracking-wider text-slate-500">
                Workspace · {board.workspace.name}
              </p>
              <h2 className="text-xl font-bold text-foreground">{board.title}</h2>
            </div>
            <span className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-xs text-primary font-medium">
              Board View
            </span>
          </div>
        </div>
        <div className="p-12 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center text-slate-300 mb-4">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-sm font-bold text-foreground">No items match your filters</h3>
          <p className="mt-1 text-xs text-slate-400">Try adjusting or clearing your filters to see items.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="border-b border-border px-6 py-4 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Workspace · {board.workspace.name}
            </p>
            <h2 className="text-xl font-bold text-foreground">{board.title}</h2>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="rounded-full border border-primary/30 bg-primary/5 px-3 py-1 text-primary font-medium">
              Board View
            </span>
            <span className="rounded-full border border-slate-200 px-3 py-1">
              {filteredItems.length} items
            </span>
          </div>
        </div>
      </div>

      <div className="flex gap-4 p-6 overflow-x-auto min-h-[400px]">
        {columnOrder.map((statusLabel) => {
          const items = itemsByStatus.get(statusLabel) ?? [];
          const opt = statusOptions.find((o) => o.label === statusLabel);
          const color = opt?.color ?? '#94a3b8';

          return (
            <KanbanColumn
              key={statusLabel}
              statusLabel={statusLabel}
              color={color}
              items={items}
              personColumnId={personColumnId}
              dateColumnId={dateColumnId}
              onOpenDetail={setSelectedItemId}
              onDragStart={handleDragStart}
              onDropItem={handleDropOnColumn}
            />
          );
        })}
      </div>

      {selectedItemId && (
        <ItemDetailPanel
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </section>
  );
}
