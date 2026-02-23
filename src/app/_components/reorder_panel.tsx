'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  useDroppable,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type ReorderPanelProps = {
  board: BoardData;
};

type ItemEntry = {
  id: string;
  name: string;
};

type SortableRowProps = {
  id: string;
  label: string;
};

function SortableRow({ id, label }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } =
    useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className="flex items-center justify-between rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-foreground"
      {...attributes}
      {...listeners}
    >
      <span className="truncate">{label}</span>
      <span className="text-[10px] uppercase tracking-wider text-slate-500">
        Drag
      </span>
    </div>
  );
}

type ItemsGroupProps = {
  groupId: string;
  title: string;
  items: ItemEntry[];
};

function ItemsGroup({ groupId, title, items }: ItemsGroupProps) {
  const { setNodeRef } = useDroppable({ id: groupId });

  return (
    <div ref={setNodeRef} className="space-y-2">
      <p className="text-xs text-slate-400">{title}</p>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="space-y-2">
          {items.length ? (
            items.map((item) => (
              <SortableRow key={item.id} id={item.id} label={item.name} />
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-slate-800/70 px-3 py-2 text-xs text-slate-500">
              Drop items here
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

export function ReorderPanel({ board }: ReorderPanelProps) {
  const utils = trpc.useUtils();
  const sensors = useSensors(useSensor(PointerSensor));

  const [columnOrder, setColumnOrder] = useState(board.columns);
  const [groupOrder, setGroupOrder] = useState(board.groups);
  const [itemsByGroup, setItemsByGroup] = useState<Record<string, ItemEntry[]>>(
    {},
  );

  useEffect(() => {
    setColumnOrder(board.columns);
    setGroupOrder(board.groups);
    setItemsByGroup(
      board.groups.reduce<Record<string, ItemEntry[]>>((acc, group) => {
        acc[group.id] = group.items.map((item) => ({
          id: item.id,
          name: item.name,
        }));
        return acc;
      }, {}),
    );
  }, [board.columns, board.groups]);

  const columnIds = useMemo(
    () => columnOrder.map((column) => column.id),
    [columnOrder],
  );
  const groupIds = useMemo(
    () => groupOrder.map((group) => group.id),
    [groupOrder],
  );

  const reorderColumns = trpc.columns.reorder.useMutation({
    onSettled: async () => {
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
  });

  const reorderGroups = trpc.groups.reorder.useMutation({
    onSettled: async () => {
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
  });

  const reorderItems = trpc.items.reorder.useMutation({
    onSettled: async () => {
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
  });

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = columnIds.indexOf(String(active.id));
    const newIndex = columnIds.indexOf(String(over.id));
    const next = arrayMove(columnOrder, oldIndex, newIndex);
    setColumnOrder(next);
    reorderColumns.mutate({
      boardId: board.id,
      columnIds: next.map((column) => column.id),
    });
  };

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }
    const oldIndex = groupIds.indexOf(String(active.id));
    const newIndex = groupIds.indexOf(String(over.id));
    const next = arrayMove(groupOrder, oldIndex, newIndex);
    setGroupOrder(next);
    reorderGroups.mutate({
      boardId: board.id,
      groupIds: next.map((group) => group.id),
    });
  };

  const findContainer = (id: string) => {
    if (itemsByGroup[id]) {
      return id;
    }
    return Object.keys(itemsByGroup).find((groupId) =>
      itemsByGroup[groupId]?.some((item) => item.id === id),
    );
  };

  const handleItemDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) {
      return;
    }

    if (activeContainer !== overContainer) {
      setItemsByGroup((prev) => {
        const activeItems = prev[activeContainer] ?? [];
        const overItems = prev[overContainer] ?? [];
        const activeIndex = activeItems.findIndex((item) => item.id === activeId);
        const overIndex = overItems.findIndex((item) => item.id === overId);
        const movedItem = activeItems[activeIndex];
        if (!movedItem) {
          return prev;
        }
        const nextActive = activeItems.filter((item) => item.id !== activeId);
        const nextOver = [
          ...overItems.slice(0, overIndex >= 0 ? overIndex : overItems.length),
          movedItem,
          ...overItems.slice(overIndex >= 0 ? overIndex : overItems.length),
        ];
        return {
          ...prev,
          [activeContainer]: nextActive,
          [overContainer]: nextOver,
        };
      });
    }
  };

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) {
      return;
    }
    const activeId = String(active.id);
    const overId = String(over.id);
    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) {
      return;
    }

    if (activeContainer === overContainer) {
      const items = itemsByGroup[activeContainer] ?? [];
      const oldIndex = items.findIndex((item) => item.id === activeId);
      const newIndex = items.findIndex((item) => item.id === overId);
      if (oldIndex !== newIndex && newIndex >= 0) {
        const next = arrayMove(items, oldIndex, newIndex);
        setItemsByGroup((prev) => ({ ...prev, [activeContainer]: next }));
        reorderItems.mutate({
          groupId: activeContainer,
          itemIds: next.map((item) => item.id),
        });
      }
      return;
    }

    const nextActive = itemsByGroup[activeContainer] ?? [];
    const nextOver = itemsByGroup[overContainer] ?? [];
    reorderItems.mutate({
      groupId: activeContainer,
      itemIds: nextActive.map((item) => item.id),
    });
    reorderItems.mutate({
      groupId: overContainer,
      itemIds: nextOver.map((item) => item.id),
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-white shadow-sm p-6">
      <h3 className="text-sm font-semibold text-foreground">Reorder</h3>
      <div className="mt-4 grid gap-6 lg:grid-cols-3">
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Columns
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleColumnDragEnd}
          >
            <SortableContext items={columnIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {columnOrder.map((column) => (
                  <SortableRow
                    key={column.id}
                    id={column.id}
                    label={column.title}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Groups
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleGroupDragEnd}
          >
            <SortableContext items={groupIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2">
                {groupOrder.map((group) => (
                  <SortableRow
                    key={group.id}
                    id={group.id}
                    label={group.title}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        </div>

        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Items
          </p>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragOver={handleItemDragOver}
            onDragEnd={handleItemDragEnd}
          >
            <div className="space-y-3">
              {groupOrder.map((group) => {
                const items = itemsByGroup[group.id] ?? [];
                return (
                  <ItemsGroup
                    key={group.id}
                    groupId={group.id}
                    title={group.title}
                    items={items}
                  />
                );
              })}
            </div>
          </DndContext>
        </div>
      </div>
    </div>
  );
}
