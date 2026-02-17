'use client';

import { useMemo, useRef, useState } from 'react';
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

function DroppableColumn({ statusLabel, children }: { statusLabel: string; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: `column:${statusLabel}` });
  return (
    <div
      ref={setNodeRef}
      className={`min-h-[200px] space-y-2 rounded-xl p-2 transition-colors ${isOver ? 'bg-blue-50/50' : ''}`}
    >
      {children}
    </div>
  );
}

function KanbanCard({
  item,
  statusColumnId,
  personColumnId,
  dateColumnId,
  onOpenDetail,
}: {
  item: ItemType;
  statusColumnId: string | null;
  personColumnId: string | null;
  dateColumnId: string | null;
  onOpenDetail: (id: string) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const person = getItemPerson(item, personColumnId);
  const date = getItemDate(item, dateColumnId);
  const isOverdue = date && new Date(date) < new Date(new Date().setHours(0, 0, 0, 0));

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
      onClick={(e) => {
        // Only open detail if not dragging
        if (!isDragging) onOpenDetail(item.id);
      }}
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

function KanbanCardOverlay({ item, personColumnId, dateColumnId }: { item: ItemType; personColumnId: string | null; dateColumnId: string | null }) {
  const person = getItemPerson(item, personColumnId);
  const date = getItemDate(item, dateColumnId);
  const isOverdue = date && new Date(date) < new Date(new Date().setHours(0, 0, 0, 0));

  return (
    <div className="rounded-xl border border-primary/30 bg-white p-3 shadow-lg w-[260px]">
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

export function BoardKanban({ board, filters }: { board: BoardData; filters: BoardFilters }) {
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [activeItem, setActiveItem] = useState<ItemType | null>(null);
  const didDragRef = useRef(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Find the first STATUS column and its options
  const statusColumn = useMemo(() => board.columns.find((c) => c.type === 'STATUS') ?? null, [board.columns]);
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

  // Group items by status label
  const itemsByStatus = useMemo(() => {
    const map = new Map<string, ItemType[]>();
    for (const opt of statusOptions) {
      map.set(opt.label, []);
    }
    // Also add "No Status" bucket
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
        // Status label not in options, add it
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

  const handleDragStart = (event: DragStartEvent) => {
    didDragRef.current = true;
    const item = allItems.find((i) => i.id === event.active.id);
    setActiveItem(item ?? null);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    // Keep didDragRef true briefly so click handler can check it
    setTimeout(() => { didDragRef.current = false; }, 0);
    const { active, over } = event;
    if (!over) return;

    const overId = String(over.id);
    let targetStatusLabel: string | null = null;

    // Dropped on a column droppable
    if (overId.startsWith('column:')) {
      targetStatusLabel = overId.slice('column:'.length);
    } else {
      // Dropped on another card - find which column that card is in
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

    // Find the matching status option for color
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

  // Build column order: defined statuses + No Status if there are unstatused items
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 p-6 overflow-x-auto min-h-[400px]">
          {columnOrder.map((statusLabel) => {
            const items = itemsByStatus.get(statusLabel) ?? [];
            const opt = statusOptions.find((o) => o.label === statusLabel);
            const color = opt?.color ?? '#94a3b8';

            return (
              <div key={statusLabel} className="flex-shrink-0 w-[280px]">
                <div className="flex items-center gap-2 mb-3 px-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    {statusLabel}
                  </h3>
                  <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">
                    {items.length}
                  </span>
                </div>

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
                          statusColumnId={statusColumnId}
                          personColumnId={personColumnId}
                          dateColumnId={dateColumnId}
                          onOpenDetail={(id) => { if (!didDragRef.current) setSelectedItemId(id); }}
                        />
                      ))
                    )}
                  </SortableContext>
                </DroppableColumn>
              </div>
            );
          })}
        </div>

        <DragOverlay>
          {activeItem ? (
            <KanbanCardOverlay item={activeItem} personColumnId={personColumnId} dateColumnId={dateColumnId} />
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
