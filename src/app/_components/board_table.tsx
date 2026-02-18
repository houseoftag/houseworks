'use client';

import { useMemo, useState, useEffect, useCallback, useRef } from 'react';
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
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { trpc } from '@/trpc/react';
import { skipToken } from '@tanstack/react-query';
import type { RouterOutputs } from '@/trpc/types';
import { useToast } from './toast_provider';
import { ItemDetailPanel } from './item_detail_panel';
import type { BoardFilters, BoardSort } from './board_filters';
import { filterAndSortItems } from './board_filter_utils';
import { useUndoRedo } from './use_undo_redo';
import { useHotkeys } from './use_hotkeys';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type BoardTableProps = {
  board: BoardData;
  filters?: BoardFilters;
  sort?: BoardSort;
};

type StatusOption = {
  label: string;
  color: string;
};

const DONE_LABELS = ['done', 'completed', 'complete', 'finished'];

function isItemDone(item: { cellValues: { value: unknown; column: { type: string } }[] }): boolean {
  const statusCell = item.cellValues.find((c) => c.column.type === 'STATUS');
  if (!statusCell?.value) return false;
  const raw = statusCell.value;
  const label =
    typeof raw === 'object' && raw !== null && 'label' in raw
      ? (raw as Record<string, unknown>).label
      : typeof raw === 'string'
        ? raw
        : null;
  return typeof label === 'string' && DONE_LABELS.includes(label.toLowerCase());
}

const titleCase = (value: string) =>
  value
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const getStatusOptions = (settings: unknown): StatusOption[] => {
  if (!settings || typeof settings !== 'object') {
    return [];
  }
  const options = (settings as { options?: Record<string, string> }).options;
  if (!options || typeof options !== 'object') {
    return [];
  }

  return Object.entries(options).map(([label, color]) => ({
    label: titleCase(label.replace(/_/g, ' ')),
    color,
  }));
};

const findCellValue = (
  item: BoardData['groups'][number]['items'][number],
  columnId: string,
) => item.cellValues.find((cell) => cell.columnId === columnId);

function SortableColumnHeader({ column }: { column: BoardData['columns'][number] }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        zIndex: isDragging ? 10 : 0,
      }}
      className={`flex items-center gap-2 ${isDragging ? 'opacity-50' : ''}`}
      {...attributes}
      {...listeners}
    >
      <span className="cursor-grab active:cursor-grabbing text-slate-600" aria-label="Drag to reorder column" title="Drag to reorder" role="img">⠿</span>
      <span>{column.title}</span>
    </div>
  );
}

function SortableItem({
  item,
  board,
  updateItem,
  deleteItem,
  updateCell,
  statusOptionsLookup,
  memberOptions,
  findCellValue,
  onOpenDetail,
  isSelected,
  isFocusedRow,
  focusedCol,
  rowIndex,
  onItemClick,
}: {
  item: BoardData['groups'][number]['items'][number];
  board: BoardData;
  updateItem: any;
  deleteItem: any;
  updateCell: any;
  statusOptionsLookup: Map<string, any[]>;
  memberOptions: any[];
  findCellValue: (item: any, columnId: string) => any;
  onOpenDetail: (id: string) => void;
  isSelected?: boolean;
  isFocusedRow?: boolean;
  focusedCol?: number;
  rowIndex?: number;
  onItemClick?: (itemId: string, e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      className={`group grid items-center gap-4 rounded-xl border px-4 py-3 text-sm shadow-sm hover:shadow-md transition-shadow ${isDragging ? 'opacity-50' : ''} ${isSelected ? 'border-primary bg-primary/5' : 'border-slate-200 bg-white'} ${isFocusedRow ? 'ring-2 ring-primary/30' : ''}`}
      style={{
        ...style,
        gridTemplateColumns: `minmax(0,2.2fr) repeat(${Math.max(
          board.columns.length - 1,
          1,
        )}, minmax(0,1fr))`,
      }}
      onClick={(e) => onItemClick?.(item.id, e)}
    >
      {board.columns.map((column, index) => {
        if (column.type === 'TEXT' && index === 0) {
          return (
            <div
              key={column.id}
              className={`flex items-center justify-between gap-3 ${isFocusedRow && focusedCol === index ? 'ring-1 ring-primary/40 rounded-lg' : ''}`}
              data-cell-row={rowIndex}
              data-cell-col={index}
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-600" aria-label="Drag to reorder item" title="Drag to reorder" role="img">⠿</span>
                <input
                  className="w-full truncate rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm text-foreground hover:border-slate-300 hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none"
                  defaultValue={item.name}
                  onBlur={(event) => {
                    const next = event.currentTarget.value.trim();
                    if (next && next !== item.name) {
                      updateItem.mutate({ id: item.id, name: next });
                    }
                  }}
                />
              </div>
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
              {(item as any)._count?.attachments > 0 && (
                <span className="text-xs text-slate-400 flex-shrink-0" title={`${(item as any)._count?.attachments} attachment(s)`} aria-label={`${(item as any)._count?.attachments} attachments`} role="status">
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  📎 {(item as any)._count?.attachments}
                </span>
              )}
              {/* eslint-disable @typescript-eslint/no-explicit-any */}
              {(((item as any)._count?.dependenciesAsSource ?? 0) + ((item as any)._count?.dependenciesAsTarget ?? 0)) > 0 && (
                <span className="text-xs text-slate-400 flex-shrink-0" title={`${((item as any)._count?.dependenciesAsSource ?? 0) + ((item as any)._count?.dependenciesAsTarget ?? 0)} dependency link(s)`} aria-label="Has dependencies" role="status">
                  🔗 {((item as any)._count?.dependenciesAsSource ?? 0) + ((item as any)._count?.dependenciesAsTarget ?? 0)}
                </span>
              )}
              {/* F6: Recurrence indicator */}
              {(item as any).recurrence && (
                <span className="text-xs text-slate-400 flex-shrink-0" title="Recurring item" aria-label="Recurring" role="status">
                  🔄
                </span>
              )}
              {/* F11: Blocked badge — show when item has unresolved BLOCKED_BY dependencies */}
              {(() => {
                const asTarget = (item as any).dependenciesAsTarget as { type: string }[] | undefined;
                const isBlocked = asTarget?.some((d: { type: string }) => d.type === 'BLOCKED_BY') ||
                  ((item as any).dependenciesAsSource as { type: string }[] | undefined)?.some((d: { type: string }) => d.type === 'BLOCKED_BY');
                // Check if blocked: item is target of a BLOCKS dep, or source of a BLOCKED_BY dep
                const blockedByTarget = asTarget?.some((d: { type: string }) => d.type === 'BLOCKS');
                const blockedBySource = ((item as any).dependenciesAsSource as { type: string }[] | undefined)?.some((d: { type: string }) => d.type === 'BLOCKED_BY');
                return (blockedByTarget || blockedBySource) ? (
                  <span className="inline-flex items-center rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-600 flex-shrink-0" title="Blocked by another item" aria-label="Blocked" role="status">
                    ⛔ Blocked
                  </span>
                ) : null;
              })()}
              {/* eslint-enable @typescript-eslint/no-explicit-any */}
              <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  className="text-xs font-medium text-slate-500 hover:text-primary"
                  onClick={() => onOpenDetail(item.id)}
                  type="button"
                >
                  Open
                </button>
                <button
                  className="text-xs font-medium text-rose-500 hover:text-rose-600"
                  onClick={() => {
                    if (window.confirm('Remove this item? This cannot be undone.')) {
                      deleteItem.mutate({ id: item.id });
                    }
                  }}
                  type="button"
                >
                  Remove
                </button>
              </div>
            </div>
          );
        }

        const cell = findCellValue(item, column.id);

        if (column.type === 'TEXT') {
          const textValue =
            typeof cell?.value === 'string' ? cell.value : '';
          return (
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={isFocusedRow && focusedCol === index ? 'ring-1 ring-primary/40 rounded-lg' : ''}>
              <input
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-foreground focus:bg-white focus:border-primary focus:outline-none"
                defaultValue={textValue}
                onBlur={(event) => {
                  const next = event.currentTarget.value.trim();
                  if (next !== textValue) {
                    updateCell.mutate({
                      itemId: item.id,
                      columnId: column.id,
                      value: next,
                    });
                  }
                }}
              />
            </div>
          );
        }

        if (column.type === 'STATUS') {
          const statusValue =
            typeof cell?.value === 'object' && cell.value
              ? (cell.value as {
                label?: string;
                color?: string;
              })
              : null;
          const statusOptions =
            statusOptionsLookup.get(column.id) ?? [];
          const statusLabels = statusOptions.map(
            (option) => option.label,
          );
          const currentStatusLabel = statusValue?.label ?? '';
          const currentStatusColor = statusValue?.color ?? 'transparent';

          const optionList = statusLabels.includes(
            currentStatusLabel,
          )
            ? statusOptions
            : currentStatusLabel
              ? [
                {
                  label: currentStatusLabel,
                  color:
                    statusValue?.color ?? '#94a3b8',
                },
                ...statusOptions,
              ]
              : statusOptions;

          return (
            <div key={column.id} className={`relative flex items-center ${isFocusedRow && focusedCol === index ? 'ring-1 ring-primary/40 rounded-lg' : ''}`} data-cell-row={rowIndex} data-cell-col={index}>
              <div
                className="absolute left-2 h-2 w-2 rounded-full"
                style={{ backgroundColor: currentStatusColor }}
              />
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-6 pr-2 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                value={currentStatusLabel}
                onChange={(event) => {
                  const selected = optionList.find(
                    (option) =>
                      option.label === event.target.value,
                  );
                  updateCell.mutate({
                    itemId: item.id,
                    columnId: column.id,
                    value: selected
                      ? {
                        label: selected.label,
                        color: selected.color,
                      }
                      : null,
                  });
                }}
              >
                <option value="">—</option>
                {optionList.map((option) => (
                  <option
                    key={option.label}
                    value={option.label}
                  >
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (column.type === 'PERSON') {
          const personValue =
            typeof cell?.value === 'object' && cell.value
              ? (cell.value as {
                name?: string;
                initials?: string;
                userId?: string;
              })
              : null;
          return (
            <div key={column.id} className={`flex items-center gap-2 ${isFocusedRow && focusedCol === index ? 'ring-1 ring-primary/40 rounded-lg' : ''}`} data-cell-row={rowIndex} data-cell-col={index}>
              <div className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                {personValue?.initials ?? '?'}
              </div>
              <select
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs text-foreground focus:outline-none focus:border-primary transition-colors"
                value={personValue?.userId ?? ''}
                onChange={(event) => {
                  const selected = memberOptions.find(
                    (member) => member.id === event.target.value,
                  );
                  updateCell.mutate({
                    itemId: item.id,
                    columnId: column.id,
                    value: selected
                      ? {
                        userId: selected.id,
                        name: selected.name,
                        initials: selected.initials,
                      }
                      : null,
                  });
                }}
              >
                <option value="">Unassigned</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        if (column.type === 'DATE') {
          const dateValue =
            typeof cell?.value === 'string'
              ? cell.value
              : '';

          const isOverdue = dateValue && !isItemDone(item) && new Date(dateValue) < new Date(new Date().setHours(0, 0, 0, 0));

          return (
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={`${isFocusedRow && focusedCol === index ? 'ring-1 ring-primary/40 rounded-lg' : ''} flex items-center gap-1`}>
              <input
                className={`w-full rounded-lg border border-slate-200 bg-slate-50 px-2 py-2 text-xs transition-colors focus:bg-white focus:border-primary focus:outline-none ${isOverdue ? 'text-rose-600 border-rose-200 bg-rose-50' : 'text-foreground'}`}
                type="date"
                value={dateValue}
                onChange={(event) =>
                  updateCell.mutate({
                    itemId: item.id,
                    columnId: column.id,
                    value: event.target.value || null,
                  })
                }
              />
              {isOverdue && (
                <span className="inline-flex items-center gap-0.5 rounded-full border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-[10px] font-bold text-rose-600 flex-shrink-0 whitespace-nowrap" aria-label="Overdue" role="status">
                  ⚠ Overdue
                </span>
              )}
            </div>
          );
        }
        if (column.type === 'LINK') {
          const linkValue = typeof cell?.value === 'object' && cell.value
            ? (cell.value as { url?: string; label?: string })
            : { url: '', label: '' };

          return (
            <div key={column.id} className={`flex gap-1 ${isFocusedRow && focusedCol === index ? 'ring-1 ring-primary/40 rounded-lg' : ''}`} data-cell-row={rowIndex} data-cell-col={index}>
              <input
                className="w-1/2 rounded-lg border border-border bg-slate-50 px-2 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                placeholder="Label"
                defaultValue={linkValue.label}
                onBlur={(e) => {
                  const label = e.target.value;
                  if (label !== linkValue.label) {
                    updateCell.mutate({
                      itemId: item.id,
                      columnId: column.id,
                      value: { ...linkValue, label },
                    });
                  }
                }}
              />
              <input
                className="w-1/2 rounded-lg border border-border bg-slate-50 px-2 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                placeholder="URL"
                defaultValue={linkValue.url}
                onBlur={(e) => {
                  const url = e.target.value;
                  if (url !== linkValue.url) {
                    updateCell.mutate({
                      itemId: item.id,
                      columnId: column.id,
                      value: { ...linkValue, url },
                    });
                  }
                }}
              />
            </div>
          );
        }
        if (column.type === 'NUMBER') {
          const numValue = typeof cell?.value === 'number' ? cell.value : '';
          return (
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={isFocusedRow && focusedCol === index ? 'ring-1 ring-primary/40 rounded-lg' : ''}>
              <input
                className="w-full rounded-lg border border-border bg-slate-50 px-2 py-2 text-xs text-foreground focus:outline-none focus:border-primary"
                type="number"
                defaultValue={numValue}
                onBlur={(e) => {
                  const val = e.target.value === '' ? null : Number(e.target.value);
                  if (val !== numValue) {
                    updateCell.mutate({
                      itemId: item.id,
                      columnId: column.id,
                      value: val,
                    });
                  }
                }}
              />
            </div>
          );
        }
        if (column.type === 'TIMELINE') {
          const timelineValue = typeof cell?.value === 'object' && cell.value
            ? (cell.value as { start?: string; end?: string })
            : { start: '', end: '' };

          return (
            <div key={column.id} className={`flex gap-1 ${isFocusedRow && focusedCol === index ? 'ring-1 ring-primary/40 rounded-lg' : ''}`} data-cell-row={rowIndex} data-cell-col={index}>
              <input
                className="w-1/2 rounded-lg border border-border bg-slate-50 px-1 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                type="date"
                defaultValue={timelineValue.start}
                onChange={(e) => {
                  updateCell.mutate({
                    itemId: item.id,
                    columnId: column.id,
                    value: { ...timelineValue, start: e.target.value },
                  });
                }}
              />
              <input
                className="w-1/2 rounded-lg border border-border bg-slate-50 px-1 py-1 text-xs text-foreground focus:outline-none focus:border-primary"
                type="date"
                defaultValue={timelineValue.end}
                onChange={(e) => {
                  updateCell.mutate({
                    itemId: item.id,
                    columnId: column.id,
                    value: { ...timelineValue, end: e.target.value },
                  });
                }}
              />
            </div>
          );
        }
        return (
          <span key={column.id} className="text-slate-400">
            {cell?.value ? String(cell.value) : '—'}
          </span>
        );
      })}
    </div>
  );
}

function SortableGroup({
  group,
  board,
  collapsedGroups,
  toggleGroup,
  updateGroup,
  deleteGroup,
  updateItem,
  deleteItem,
  createItem,
  updateCell,
  statusOptionsLookup,
  memberOptions,
  findCellValue,
  sensors,
  handleItemDragEnd,
  onOpenDetail,
  selectedItemIds,
  focusedCell,
  flatItemStartIndex,
  onItemClick,
}: {
  group: BoardData['groups'][number];
  board: BoardData;
  collapsedGroups: Set<string>;
  toggleGroup: (id: string) => void;
  updateGroup: any;
  deleteGroup: any;
  updateItem: any;
  deleteItem: any;
  createItem: any;
  updateCell: any;
  statusOptionsLookup: Map<string, any[]>;
  memberOptions: any[];
  findCellValue: (item: any, columnId: string) => any;
  sensors: any;
  handleItemDragEnd: (event: DragEndEvent) => void;
  onOpenDetail: (id: string) => void;
  selectedItemIds?: Set<string>;
  focusedCell?: { row: number; col: number } | null;
  flatItemStartIndex?: number;
  onItemClick?: (itemId: string, e: React.MouseEvent) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  const doneCount = group.items.filter((item) => {
    const statusColumn = board.columns.find((column) => column.type === 'STATUS');
    if (!statusColumn) return false;
    const statusValue = findCellValue(item, statusColumn.id)?.value;
    return (
      typeof statusValue === 'object' &&
      statusValue &&
      (statusValue as { label?: string }).label?.toLowerCase() === 'done'
    );
  }).length;
  const progress = group.items.length > 0 ? doneCount / group.items.length : 0;

  return (
    <div ref={setNodeRef} style={style} className={`px-6 py-5 ${isDragging ? 'opacity-50' : ''}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-600" aria-label="Drag to reorder group" title="Drag to reorder" role="img">⠿</div>
          <button
            onClick={() => toggleGroup(group.id)}
            className="flex h-5 w-5 items-center justify-center rounded bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700"
          >
            <span className={`transform transition-transform ${collapsedGroups.has(group.id) ? '-rotate-90' : ''}`}>
              ▼
            </span>
          </button>
          <span
            className="h-3 w-3 rounded-full"
            style={{ backgroundColor: group.color ?? '#94a3b8' }}
          />
          <input
            className="w-full max-w-xs rounded-lg border border-transparent bg-transparent px-2 py-1 text-sm font-semibold text-foreground hover:border-slate-300 hover:bg-slate-50 focus:border-primary focus:bg-white focus:outline-none"
            defaultValue={group.title}
            onBlur={(event) => {
              const next = event.currentTarget.value.trim();
              if (next && next !== group.title) {
                updateGroup.mutate({ id: group.id, title: next });
              }
            }}
          />
        </div>
        <div className="flex items-center gap-4">
          <div className="w-40">
            <div className="h-1 rounded-full bg-slate-200" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label={`Group progress: ${Math.round(progress * 100)}% done`}>
              <div
                className="h-1 rounded-full bg-emerald-400"
                style={{ width: `${progress * 100}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] text-slate-500">
              {Math.round(progress * 100)}% done
            </p>
          </div>
          <button
            className="text-xs text-rose-500 hover:text-rose-600"
            onClick={() => {
              if (window.confirm(`Delete group "${group.title}" and all its items? This cannot be undone.`)) {
                deleteGroup.mutate({ id: group.id });
              }
            }}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      {!collapsedGroups.has(group.id) && (
        <div className="mt-4 space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext
              items={group.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {group.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-3 text-xs text-slate-500">
                    No items yet. Add one below.
                  </div>
                ) : null}
                {group.items.map((item, itemIdx) => {
                  const globalRowIdx = (flatItemStartIndex ?? 0) + itemIdx;
                  return (
                    <SortableItem
                      key={item.id}
                      item={item}
                      board={board}
                      updateItem={updateItem}
                      deleteItem={deleteItem}
                      updateCell={updateCell}
                      statusOptionsLookup={statusOptionsLookup}
                      memberOptions={memberOptions}
                      findCellValue={findCellValue}
                      onOpenDetail={onOpenDetail}
                      isSelected={selectedItemIds?.has(item.id)}
                      isFocusedRow={focusedCell?.row === globalRowIdx}
                      focusedCol={focusedCell?.row === globalRowIdx ? focusedCell.col : undefined}
                      rowIndex={globalRowIdx}
                      onItemClick={onItemClick}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          <div
            className="grid items-center gap-4 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-2 text-sm text-slate-400"
            style={{
              gridTemplateColumns: `minmax(0,2.2fr) repeat(${Math.max(
                board.columns.length - 1,
                1,
              )}, minmax(0,1fr))`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-slate-600 opacity-0">⠿</span>
              <input
                className="w-full bg-transparent px-2 py-1 text-sm text-foreground placeholder:text-slate-400 focus:outline-none"
                placeholder="+ Add Item"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const input = event.currentTarget;
                    const name = input.value.trim();
                    if (name && !createItem.isPending) {
                      createItem.mutate({
                        groupId: group.id,
                        name,
                      });
                      input.value = '';
                    }
                  }
                }}
              />
            </div>
            {board.columns.slice(1).map((column) => (
              <div key={column.id} className="h-8" />
            ))}
          </div>

          <div
            className="mt-2 grid items-center gap-4 px-4 py-2"
            style={{
              gridTemplateColumns: `minmax(0,2.2fr) repeat(${Math.max(
                board.columns.length - 1,
                1,
              )}, minmax(0,1fr))`,
            }}
          >
            <div />
            {board.columns.slice(1).map((column) => {
              if (column.type === 'STATUS') {
                const options = statusOptionsLookup.get(column.id) ?? [];
                const counts = new Map<string, number>();
                let total = 0;

                group.items.forEach(item => {
                  const val = findCellValue(item, column.id)?.value;
                  const label = (val as { label?: string })?.label;
                  if (label) {
                    counts.set(label, (counts.get(label) ?? 0) + 1);
                    total++;
                  }
                });

                if (total === 0) return <div key={column.id} className="h-2 rounded-full bg-slate-200" />;

                return (
                  <div key={column.id} className="h-2 flex rounded-full overflow-hidden bg-slate-200">
                    {options.map(option => {
                      const count = counts.get(option.label) ?? 0;
                      if (count === 0) return null;
                      return (
                        <div
                          key={option.label}
                          style={{
                            width: `${(count / group.items.length) * 100}%`,
                            backgroundColor: option.color
                          }}
                          title={`${option.label}: ${count}`}
                        />
                      );
                    })}
                  </div>
                );
              }
              return <div key={column.id} />;
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function BoardTable({ board, filters, sort }: BoardTableProps) {
  const utils = trpc.useUtils();
  const sensors = useSensors(useSensor(PointerSensor, {
    activationConstraint: {
      distance: 8,
    },
  }));
  const { pushToast } = useToast();
  const [savingCell, setSavingCell] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  // --- M18: Selection state for Shift+Click ---
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const lastClickedItemRef = useRef<string | null>(null);

  // --- M18: Keyboard navigation state ---
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const reorderColumns = trpc.columns.reorder.useMutation({
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
  });

  const reorderGroups = trpc.groups.reorder.useMutation({
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
  });

  const reorderItems = trpc.items.reorder.useMutation({
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
  });

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleColumnDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = board.columns.findIndex((c) => c.id === active.id);
    const newIndex = board.columns.findIndex((c) => c.id === over.id);
    const next = arrayMove(board.columns, oldIndex, newIndex);

    reorderColumns.mutate({
      boardId: board.id,
      columnIds: next.map((c) => c.id),
    });
  };

  const handleGroupDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = board.groups.findIndex((g) => g.id === active.id);
    const newIndex = board.groups.findIndex((g) => g.id === over.id);
    const next = arrayMove(board.groups, oldIndex, newIndex);

    reorderGroups.mutate({
      boardId: board.id,
      groupIds: next.map((g) => g.id),
    });
  };

  const findContainer = (id: string) => {
    if (board.groups.some((g) => g.id === id)) return id;
    for (const group of board.groups) {
      if (group.items.some((item) => item.id === id)) return group.id;
    }
    return null;
  };

  const handleItemDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    const activeContainer = findContainer(activeId);
    const overContainer = findContainer(overId);

    if (!activeContainer || !overContainer) return;

    if (activeContainer === overContainer) {
      const group = board.groups.find((g) => g.id === activeContainer);
      if (!group) return;
      const oldIndex = group.items.findIndex((item) => item.id === activeId);
      const newIndex = group.items.findIndex((item) => item.id === overId);

      if (oldIndex !== newIndex && newIndex >= 0) {
        const next = arrayMove(group.items, oldIndex, newIndex);
        reorderItems.mutate({
          groupId: activeContainer,
          itemIds: next.map((item) => item.id),
        });
      }
    } else {
      // Logic for moving between groups would go here, 
      // but for now we reorder within current container to match existing ReorderPanel simplified logic
      // or we can implement full cross-group move.
      // ReorderPanel had handleItemDragOver for this.
    }
  };

  const updateCell = trpc.cells.update.useMutation({
    onMutate: async (input) => {
      setSavingCell(`${input.itemId}:${input.columnId}`);
      await utils.boards.getDefault.cancel();
      const previous = utils.boards.getDefault.getData();

      // Track previous cell value for undo/redo
      if (previous) {
        for (const group of previous.groups) {
          for (const item of group.items) {
            if (item.id === input.itemId) {
              const oldCell = item.cellValues.find((c) => c.columnId === input.columnId);
              pushEdit({
                itemId: input.itemId,
                columnId: input.columnId,
                previousValue: oldCell?.value ?? null,
                newValue: input.value,
              });
              break;
            }
          }
        }
      }

      utils.boards.getDefault.setData(undefined, (old) => {
        if (!old) {
          return old;
        }
        const columnLookup = new Map(old.columns.map((col) => [col.id, col]));
        return {
          ...old,
          groups: old.groups.map((group) => ({
            ...group,
            items: group.items.map((item) => {
              if (item.id !== input.itemId) {
                return item;
              }
              const existingIndex = item.cellValues.findIndex(
                (cell) => cell.columnId === input.columnId,
              );

              if (existingIndex >= 0) {
                const updated = [...item.cellValues];
                updated[existingIndex] = {
                  ...updated[existingIndex],
                  value: input.value as any,
                } as any;
                return { ...item, cellValues: updated };
              }

              return {
                ...item,
                cellValues: [
                  ...item.cellValues,
                  {
                    id: `temp-${input.itemId}-${input.columnId}`,
                    itemId: input.itemId,
                    columnId: input.columnId,
                    value: input.value as any,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    column: columnLookup.get(input.columnId) as any,
                  } as any,
                ],
              };
            }),
          })),
        };
      });

      return { previous };
    },
    onError: (_error, _input, context) => {
      utils.boards.getDefault.setData(undefined, context?.previous);
      pushToast({
        title: 'Update failed',
        description: 'Unable to save cell changes.',
        tone: 'error',
      });
    },
    onSettled: async () => {
      setSavingCell(null);
      await utils.boards.getDefault.invalidate();
    },
  });

  const updateItem = trpc.items.update.useMutation({
    onMutate: async (input) => {
      await utils.boards.getDefault.cancel();
      const previous = utils.boards.getDefault.getData();

      utils.boards.getDefault.setData(undefined, (old) => {
        if (!old) {
          return old;
        }
        return {
          ...old,
          groups: old.groups.map((group) => ({
            ...group,
            items: group.items.map((item) =>
              item.id === input.id
                ? { ...item, name: input.name ?? item.name }
                : item,
            ),
          })),
        };
      });

      return { previous };
    },
    onError: (_error, _input, context) => {
      utils.boards.getDefault.setData(undefined, context?.previous);
      pushToast({
        title: 'Update failed',
        description: 'Unable to update item.',
        tone: 'error',
      });
    },
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
  });

  const deleteGroup = trpc.groups.delete.useMutation({
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Delete failed',
        description: 'Unable to delete group.',
        tone: 'error',
      });
    },
  });

  const updateGroup = trpc.groups.update.useMutation({
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Update failed',
        description: 'Unable to update group.',
        tone: 'error',
      });
    },
  });

  const deleteItem = trpc.items.delete.useMutation({
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Delete failed',
        description: 'Unable to delete item.',
        tone: 'error',
      });
    },
  });

  const createItem = trpc.items.create.useMutation({
    onSettled: async () => {
      await utils.boards.getDefault.invalidate();
    },
    onError: () => {
      pushToast({
        title: 'Create failed',
        description: 'Unable to create item.',
        tone: 'error',
      });
    },
  });

  // --- M18: Undo/Redo for cell edits ---
  const applyCellUpdateForUndoRedo = useCallback(
    (itemId: string, columnId: string, value: unknown) => {
      updateCell.mutate({ itemId, columnId, value });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const { pushEdit, undo, redo } = useUndoRedo(applyCellUpdateForUndoRedo);

  // --- M18: Keyboard shortcuts (Undo/Redo + Arrow keys) ---
  // Build flat item list for arrow key navigation
  const flatItems = useMemo(() => {
    const items: Array<{ itemId: string; groupId: string }> = [];
    for (const group of board.groups) {
      if (collapsedGroups.has(group.id)) continue;
      for (const item of group.items) {
        items.push({ itemId: item.id, groupId: group.id });
      }
    }
    return items;
  }, [board.groups, collapsedGroups]);

  useHotkeys([
    {
      key: 'mod+z',
      description: 'Undo last cell edit',
      category: 'editing',
      handler: () => {
        undo();
        pushToast({ title: 'Undone', description: 'Cell edit reverted.', tone: 'info' });
      },
    },
    {
      key: 'mod+shift+z',
      description: 'Redo cell edit',
      category: 'editing',
      handler: () => {
        redo();
        pushToast({ title: 'Redone', description: 'Cell edit re-applied.', tone: 'info' });
      },
    },
  ]);

  // Arrow key navigation handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      if (!focusedCell) {
        // If arrow down pressed with no focus, start at first cell
        if (e.key === 'ArrowDown' && !isInput) {
          e.preventDefault();
          setFocusedCell({ row: 0, col: 0 });
          return;
        }
        return;
      }

      const numRows = flatItems.length;
      const numCols = board.columns.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setFocusedCell((prev) => prev ? { ...prev, row: Math.min(prev.row + 1, numRows - 1) } : null);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setFocusedCell((prev) => prev ? { ...prev, row: Math.max(prev.row - 1, 0) } : null);
      } else if (e.key === 'ArrowRight' && !isInput) {
        e.preventDefault();
        setFocusedCell((prev) => prev ? { ...prev, col: Math.min(prev.col + 1, numCols - 1) } : null);
      } else if (e.key === 'ArrowLeft' && !isInput) {
        e.preventDefault();
        setFocusedCell((prev) => prev ? { ...prev, col: Math.max(prev.col - 1, 0) } : null);
      } else if (e.key === 'Enter' && !isInput) {
        // Focus the input/select in the focused cell
        e.preventDefault();
        const cellEl = tableRef.current?.querySelector(`[data-cell-row="${focusedCell.row}"][data-cell-col="${focusedCell.col}"]`);
        const input = cellEl?.querySelector('input, select, textarea') as HTMLElement | null;
        input?.focus();
      } else if (e.key === 'Escape' && focusedCell) {
        if (isInput) {
          (target as HTMLElement).blur();
        } else {
          setFocusedCell(null);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [focusedCell, flatItems.length, board.columns.length]);

  // --- M18: Shift+Click handler ---
  const handleItemClick = useCallback(
    (itemId: string, e: React.MouseEvent) => {
      if (e.shiftKey && lastClickedItemRef.current) {
        // Select range
        const allIds = flatItems.map((fi) => fi.itemId);
        const startIdx = allIds.indexOf(lastClickedItemRef.current);
        const endIdx = allIds.indexOf(itemId);
        if (startIdx >= 0 && endIdx >= 0) {
          const from = Math.min(startIdx, endIdx);
          const to = Math.max(startIdx, endIdx);
          const rangeIds = allIds.slice(from, to + 1);
          setSelectedItemIds(new Set(rangeIds));
        }
      } else {
        setSelectedItemIds(new Set([itemId]));
        lastClickedItemRef.current = itemId;
      }
    },
    [flatItems],
  );

  const { data: members } = trpc.workspaces.members.useQuery(
    { workspaceId: board.workspaceId },
    { enabled: !!board.workspaceId },
  );

  const memberOptions =
    members?.map((member) => ({
      id: member.user.id,
      name: member.user.name ?? member.user.email ?? 'Unknown',
      initials: member.user.name
        ? member.user.name
          .split(' ')
          .map((part) => part[0])
          .join('')
          .toUpperCase()
        : (member.user.email ?? 'NA').slice(0, 2).toUpperCase(),
    })) ?? [];

  const statusOptionsLookup = useMemo(() => {
    const map = new Map<string, StatusOption[]>();
    for (const column of board.columns) {
      if (column.type === 'STATUS') {
        map.set(column.id, getStatusOptions(column.settings));
      }
    }
    return map;
  }, [board.columns]);

  // Apply filters and sort to groups
  const filteredGroups = useMemo(() => {
    if (!filters && !sort) return board.groups;
    const defaultFilters: BoardFilters = { status: null, person: null, priority: null, dueDateFrom: null, dueDateTo: null };
    const defaultSort: BoardSort = { field: 'created', dir: 'desc' };
    return board.groups.map((group) => ({
      ...group,
      items: filterAndSortItems(group.items, filters ?? defaultFilters, sort ?? defaultSort, board.columns),
    })).filter((group) => group.items.length > 0 || (!filters?.status && !filters?.person && !filters?.priority && !filters?.dueDateFrom && !filters?.dueDateTo));
  }, [board.groups, board.columns, filters, sort]);

  const hasActiveFilters = filters && (filters.status !== null || filters.person !== null || filters.priority !== null || filters.dueDateFrom !== null || filters.dueDateTo !== null);
  const totalFilteredItems = filteredGroups.reduce((sum, g) => sum + g.items.length, 0);

  if (hasActiveFilters && totalFilteredItems === 0) {
    return (
      <section className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-6 py-5 bg-slate-50/50">
          <div>
            <p className="text-xs uppercase tracking-wider text-slate-500">
              Workspace · {board.workspace.name}
            </p>
            <h2 className="text-xl font-bold text-foreground">{board.title}</h2>
          </div>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs text-slate-500">
            Table View
          </span>
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
    <section ref={tableRef} className="rounded-xl border border-border bg-white shadow-sm overflow-hidden">
      <div className="flex items-center justify-between border-b border-border px-6 py-5 bg-slate-50/50">
        <div>
          <p className="text-xs uppercase tracking-wider text-slate-500">
            Workspace · {board.workspace.name}
          </p>
          <h2 className="text-xl font-bold text-foreground">
            {board.title}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-500">
            Table View
          </span>
          <span className="rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-slate-500">
            {filteredGroups.length} groups
          </span>
          {selectedItemIds.size > 1 && (
            <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-primary font-medium">
              {selectedItemIds.size} selected
            </span>
          )}
          {savingCell ? (
            <span className="text-xs font-medium text-amber-600">Saving…</span>
          ) : null}
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
      >
        <SortableContext
          items={board.columns.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div
            className="grid gap-4 border-b border-border px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-400 bg-slate-50/30"
            style={{
              gridTemplateColumns: `minmax(0,2.2fr) repeat(${Math.max(
                board.columns.length - 1,
                1,
              )}, minmax(0,1fr))`,
            }}
          >
            {board.columns.map((column) => (
              <SortableColumnHeader key={column.id} column={column} />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      <div className="divide-y divide-border">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleGroupDragEnd}
        >
          <SortableContext
            items={filteredGroups.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
          >
            {filteredGroups.map((group) => {
              // Compute flat start index for this group
              let startIdx = 0;
              for (const g of filteredGroups) {
                if (g.id === group.id) break;
                if (!collapsedGroups.has(g.id)) startIdx += g.items.length;
              }
              return (
                <SortableGroup
                  key={group.id}
                  group={group}
                  board={board}
                  collapsedGroups={collapsedGroups}
                  toggleGroup={toggleGroup}
                  updateGroup={updateGroup}
                  deleteGroup={deleteGroup}
                  updateItem={updateItem}
                  deleteItem={deleteItem}
                  createItem={createItem}
                  updateCell={updateCell}
                  statusOptionsLookup={statusOptionsLookup}
                  memberOptions={memberOptions}
                  findCellValue={findCellValue}
                  sensors={sensors}
                  handleItemDragEnd={handleItemDragEnd}
                  onOpenDetail={setSelectedItemId}
                  selectedItemIds={selectedItemIds}
                  focusedCell={focusedCell}
                  flatItemStartIndex={startIdx}
                  onItemClick={handleItemClick}
                />
              );
            })}
          </SortableContext>
        </DndContext>
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
