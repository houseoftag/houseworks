'use client';

import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
import { CustomSelect } from './custom_select';
import { useUndoRedo } from './use_undo_redo';
import { useHotkeys } from './use_hotkeys';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type BoardTableProps = {
  board: BoardData;
  filters: BoardFilters;
  sort: BoardSort;
  onFiltersChange: (next: BoardFilters) => void;
  onSortChange: (next: BoardSort) => void;
  /** When true, removes top border and rounding so it connects flush to a card above */
  seamlessTop?: boolean;
  /** When set, overrides the default sticky top offset for the controls/column header bar */
  stickyOffset?: number;
  /** Optional slot rendered at the top of the sticky zone (e.g. BoardHeader) */
  headerSlot?: React.ReactNode;
  /** Controlled: whether the new-group form is visible */
  showCreateGroup?: boolean;
  /** Controlled: callback when new-group form open state changes */
  onCreateGroupChange?: (show: boolean) => void;
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

const STATUS_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308', '#84cc16', '#22c55e',
  '#10b981', '#14b8a6', '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#f43f5e', '#64748b', '#78716c', '#1e293b',
];

function CustomDateInput({
  value,
  onChange,
  className,
  isOverdue,
}: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  isOverdue?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState<number>(() => {
    if (value) return new Date(value + "T00:00:00").getFullYear();
    return new Date().getFullYear();
  });
  const [viewMonth, setViewMonth] = useState<number>(() => {
    if (value) return new Date(value + "T00:00:00").getMonth();
    return new Date().getMonth();
  });
  const triggerRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  const display = value
    ? (() => {
        const d = new Date(value + "T00:00:00");
        const month = d.toLocaleDateString("en-US", { month: "short" });
        const day = d.getDate();
        const year = d.getFullYear();
        return year === new Date().getFullYear()
          ? `${month} ${day}`
          : `${month} ${day}, ${year}`;
      })()
    : null;

  const openCalendar = () => {
    if (value) {
      const d = new Date(value + "T00:00:00");
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    } else {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());
    }
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open]);

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const monthName = new Date(viewYear, viewMonth, 1).toLocaleDateString(
    "en-US",
    { month: "long" },
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else setViewMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else setViewMonth((m) => m + 1);
  };

  const selectDay = (day: number) => {
    const mm = String(viewMonth + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${viewYear}-${mm}-${dd}`);
    setOpen(false);
  };

  const [popoverPos, setPopoverPos] = useState<{
    top: number;
    left: number;
  } | null>(null);
  useEffect(() => {
    if (open && triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      const calWidth = 256;
      setPopoverPos({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + calWidth > window.innerWidth
          ? Math.max(0, rect.right + window.scrollX - calWidth)
          : rect.left + window.scrollX,
      });
    }
  }, [open]);

  const calendarPopover =
    open && popoverPos
      ? createPortal(
          <div
            ref={popoverRef}
            style={{
              position: "absolute",
              top: popoverPos.top,
              left: popoverPos.left,
              zIndex: 9999,
            }}
            className="w-64 rounded-xl border border-border bg-card shadow-lg p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={prevMonth}
                className="p-1 rounded hover:bg-border/50 text-slate-500 hover:text-foreground transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-xs font-semibold text-foreground">
                {monthName} {viewYear}
              </span>
              <button
                type="button"
                onClick={nextMonth}
                className="p-1 rounded hover:bg-border/50 text-slate-500 hover:text-foreground transition-colors"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
            </div>
            <div className="grid grid-cols-7 mb-1">
              {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                <div
                  key={d}
                  className="text-center text-[10px] font-medium text-slate-400 py-0.5"
                >
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5">
              {Array.from({ length: firstDay }).map((_, i) => (
                <div key={`empty-${i}`} />
              ))}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const mm = String(viewMonth + 1).padStart(2, "0");
                const dd = String(day).padStart(2, "0");
                const dateStr = `${viewYear}-${mm}-${dd}`;
                const isSelected = dateStr === value;
                const isToday = dateStr === todayStr;
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`h-7 w-full rounded text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-primary text-white"
                        : isToday
                          ? "border border-primary text-primary hover:bg-primary/10"
                          : "text-foreground/80 hover:bg-border/50"
                    }`}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            {value && (
              <div className="mt-2 border-t border-border pt-2">
                <button
                  type="button"
                  onClick={() => {
                    onChange("");
                    setOpen(false);
                  }}
                  className="w-full rounded text-xs text-slate-500 hover:text-rose-600 hover:bg-rose-500/10 py-1 transition-colors"
                >
                  Clear date
                </button>
              </div>
            )}
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={triggerRef}
        className={`relative flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs cursor-pointer transition-colors select-none ${isOverdue ? "border-rose-500/30 bg-rose-500/10 text-rose-500 hover:border-rose-500/50" : "border-border bg-background text-foreground hover:border-primary/40 hover:bg-card"} ${className ?? ""}`}
        onClick={(e) => {
          e.stopPropagation();
          openCalendar();
        }}
      >
        <svg
          className={`h-3.5 w-3.5 flex-shrink-0 ${isOverdue ? "text-rose-400" : "text-slate-400"}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        {display ? (
          <span className="flex-1 truncate font-medium">{display}</span>
        ) : (
          <span className="flex-1 text-slate-400">Set date</span>
        )}
        {isOverdue && (
          <span className="text-rose-400 text-[10px] flex-shrink-0" title="Overdue">⚠</span>
        )}
        {value && (
          <button
            type="button"
            className="relative z-10 flex-shrink-0 text-slate-400 hover:text-foreground/70 leading-none ml-0.5"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
            aria-label="Clear date"
          >
            <svg
              className="h-3 w-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
      {calendarPopover}
    </>
  );
}

// CustomSelect is imported from ./custom_select

const findCellValue = (
  item: BoardData['groups'][number]['items'][number],
  columnId: string,
) => item.cellValues.find((cell) => cell.columnId === columnId);

const COLUMN_TYPES = [
  { value: 'TEXT', label: 'Text', icon: 'T' },
  { value: 'STATUS', label: 'Status', icon: '◉' },
  { value: 'PERSON', label: 'Person', icon: '👤' },
  { value: 'DATE', label: 'Date', icon: '📅' },
  { value: 'NUMBER', label: 'Number', icon: '#' },
  { value: 'LINK', label: 'Link', icon: '🔗' },
  { value: 'TIMELINE', label: 'Timeline', icon: '⟷' },
] as const;

interface DateColumnSettings {
  deadlineMode?: boolean;
  linkedStatusColumnId?: string;
  completeStatusValue?: string;
  linkedAssigneeColumnId?: string;
}

type SortableColumnHeaderProps = {
  column: BoardData['columns'][number];
  index: number;
  sort: BoardSort;
  onSortChange: (next: BoardSort) => void;
  isRenaming: boolean;
  draftTitle: string;
  onStartRename: () => void;
  onDraftTitleChange: (next: string) => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDeleteColumn?: () => void;
  disableDelete?: boolean;
  // Extended actions
  onFilter?: () => void;
  onCollapse?: () => void;
  onGroupBy?: () => void;
  onDuplicate?: () => void;
  onAddRight?: () => void;
  onChangeType?: (type: string) => void;
  isCollapsed?: boolean;
  statusOptions?: StatusOption[];
  onCreateStatusOption?: (label: string, color: string) => void;
  // DATE deadline mode settings
  allColumns?: BoardData['columns'];
  onUpdateDateSettings?: (settings: DateColumnSettings) => void;
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const raw = hex.replace('#', '').trim();
  if (![3, 6].includes(raw.length)) return null;
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  if (Number.isNaN(n)) return null;
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function textColorForBg(hex: string): 'black' | 'white' {
  const rgb = hexToRgb(hex);
  if (!rgb) return 'white';
  // Relative luminance approximation; good enough for our fixed palette.
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255;
  return luminance > 0.62 ? 'black' : 'white';
}

function StatusCell({
  itemId,
  columnId,
  value,
  options,
  onChange,
  onCreateOption,
  className,
  rowIndex,
  colIndex,
  flat,
}: {
  itemId: string;
  columnId: string;
  value: { label?: string; color?: string } | null;
  options: StatusOption[];
  onChange: (next: { label: string; color: string } | null) => void;
  onCreateOption?: (label: string, color: string) => void;
  className?: string;
  rowIndex?: number;
  colIndex?: number;
  flat?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState(STATUS_COLORS[0]!);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node | null;
      if (t && ref.current && !ref.current.contains(t)) {
        setOpen(false);
        setCreating(false);
        setNewLabel('');
      }
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const currentLabel = value?.label ?? '';
  const currentColor = value?.color ?? '';
  const bg = currentLabel && currentColor ? currentColor : 'transparent';
  const fg = currentLabel && currentColor ? (textColorForBg(currentColor) === 'black' ? '#0f172a' : '#ffffff') : 'var(--foreground)';

  return (
    <div
      ref={ref}
      className={`relative ${flat ? 'h-full' : ''} ${className ?? ''}`}
      data-cell-row={rowIndex}
      data-cell-col={colIndex}
    >
      <button
        className={flat
          ? "w-full h-full px-3 py-0 text-left text-xs font-semibold tracking-tight focus:outline-none transition-colors"
          : "w-full rounded-md px-2 py-2 text-left text-xs font-semibold tracking-tight shadow-none border border-transparent hover:border-border focus:outline-none focus:border-primary transition-colors"
        }
        style={{ backgroundColor: bg, color: fg }}
        onClick={() => setOpen((v) => !v)}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Set status for ${itemId}`}
      >
        <span className="flex items-center justify-between gap-2">
          {currentLabel && <span className="inline-block w-2 h-2 rounded-sm flex-shrink-0 border border-current opacity-50" />}
          <span className="truncate">{currentLabel || '—'}</span>
          <span className="text-[10px] opacity-80">▾</span>
        </span>
      </button>

      {open && (
        <div className="absolute left-0 mt-1 w-56 rounded-xl border border-border bg-card shadow-xl z-30 overflow-hidden">
          {creating ? (
            <div className="p-3 space-y-2">
              <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">New status</p>
              <input
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary"
                placeholder="Status label…"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newLabel.trim()) {
                    onCreateOption?.(newLabel.trim(), newColor);
                    onChange({ label: newLabel.trim(), color: newColor });
                    setCreating(false);
                    setNewLabel('');
                    setOpen(false);
                  } else if (e.key === 'Escape') {
                    setCreating(false);
                    setNewLabel('');
                  }
                }}
              />
              <div className="grid grid-cols-9 gap-1 py-1">
                {STATUS_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    className={`h-5 w-5 rounded-full transition-transform hover:scale-110 ${newColor === color ? 'ring-2 ring-offset-1 ring-slate-700 scale-110' : ''}`}
                    style={{ backgroundColor: color }}
                    onClick={() => setNewColor(color)}
                    aria-label={color}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 pt-1">
                <button
                  type="button"
                  className="flex-1 rounded-lg bg-primary px-2 py-1.5 text-[11px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  disabled={!newLabel.trim()}
                  onClick={() => {
                    if (!newLabel.trim()) return;
                    onCreateOption?.(newLabel.trim(), newColor);
                    onChange({ label: newLabel.trim(), color: newColor });
                    setCreating(false);
                    setNewLabel('');
                    setOpen(false);
                  }}
                >
                  Create
                </button>
                <button
                  type="button"
                  className="rounded-lg border border-border px-2 py-1.5 text-[11px] text-slate-500 hover:text-foreground transition-colors"
                  onClick={() => { setCreating(false); setNewLabel(''); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              {options.length === 0 ? (
                <div className="px-3 py-2.5 text-xs text-slate-400 italic">No statuses yet</div>
              ) : (
                <>
                  <button
                    className="block w-full px-3 py-2 text-left text-xs text-foreground/70 hover:bg-background"
                    onClick={() => { setOpen(false); onChange(null); }}
                    type="button"
                  >
                    Clear
                  </button>
                  <div className="max-h-64 overflow-auto">
                    {options.map((opt) => (
                      <button
                        key={opt.label}
                        className="flex w-full items-center px-3 py-2 text-left hover:bg-background"
                        onClick={() => { setOpen(false); onChange({ label: opt.label, color: opt.color }); }}
                        type="button"
                      >
                        <span
                          className="w-full rounded-md px-2 py-1.5 text-xs font-semibold tracking-tight text-center truncate"
                          style={{
                            backgroundColor: opt.color,
                            color: textColorForBg(opt.color) === 'black' ? '#0f172a' : '#ffffff',
                          }}
                        >
                          {opt.label}
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}
              {onCreateOption && (
                <div className="border-t border-border">
                  <button
                    type="button"
                    className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs text-primary hover:bg-primary/5 font-medium transition-colors"
                    onClick={() => setCreating(true)}
                  >
                    <span>＋</span>
                    <span>New status</span>
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function getSortFieldForColumn(column: BoardData['columns'][number], index: number): BoardSort['field'] | null {
  if (column.type === 'DATE') return 'dueDate';
  if (column.type === 'STATUS' && column.title.toLowerCase().includes('priority')) return 'priority';
  if (column.type === 'TEXT' && index === 0) return 'title';
  return null;
}

function SortableColumnHeader({
  column,
  index,
  sort,
  onSortChange,
  isRenaming,
  draftTitle,
  onStartRename,
  onDraftTitleChange,
  onCommitRename,
  onCancelRename,
  onDeleteColumn,
  disableDelete,
  onFilter,
  onCollapse,
  onGroupBy,
  onDuplicate,
  onAddRight,
  onChangeType,
  isCollapsed,
  statusOptions,
  onCreateStatusOption,
  allColumns,
  onUpdateDateSettings,
}: SortableColumnHeaderProps) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: column.id,
  });
  const sortField = getSortFieldForColumn(column, index);
  const isSorted = sortField ? sort.field === sortField : false;
  const nextDir = isSorted && sort.dir === 'asc' ? 'desc' : 'asc';
  const [menuOpen, setMenuOpen] = useState(false);
  const [typeSubmenuOpen, setTypeSubmenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [creatingStatus, setCreatingStatus] = useState(false);
  const dateSettings = column.type === 'DATE' ? (column.settings as DateColumnSettings | null) : null;
  const [newStatusLabel, setNewStatusLabel] = useState('');
  const [newStatusColor, setNewStatusColor] = useState(STATUS_COLORS[0]!);
  const menuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const menuDropdownRef = useRef<HTMLDivElement | null>(null);
  const [menuPos, setMenuPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!menuOpen) { setTypeSubmenuOpen(false); setSettingsOpen(false); setCreatingStatus(false); setNewStatusLabel(''); return; }
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if ((menuTriggerRef.current && menuTriggerRef.current.contains(t)) || (menuDropdownRef.current && menuDropdownRef.current.contains(t))) return;
      setMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [menuOpen]);

  const openMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (menuTriggerRef.current) {
      const rect = menuTriggerRef.current.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, left: Math.max(4, rect.right - 220) });
    }
    setMenuOpen((v) => !v);
  };

  if (isCollapsed) {
    return (
      <div
        ref={setNodeRef}
        style={{ transform: CSS.Translate.toString(transform), transition }}
        className="flex justify-center items-center h-full"
      >
        <button
          type="button"
          className="flex flex-col items-center gap-0.5 rounded-md p-1 text-slate-400 hover:text-foreground hover:bg-border/50 transition"
          onClick={onCollapse}
          title={`Expand "${column.title}"`}
        >
          <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition, zIndex: isDragging ? 10 : 0 }}
      className={`group flex items-center gap-2 min-w-0 ${isDragging ? 'opacity-50' : ''}`}
    >
      <span
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-foreground/70"
        aria-label="Drag to reorder column"
        title="Drag to reorder"
        role="img"
      >
        ⠿
      </span>
      {isRenaming ? (
        <input
          className="w-full min-w-0 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-semibold text-foreground focus:outline-none focus:border-primary"
          value={draftTitle}
          onChange={(e) => onDraftTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') { e.preventDefault(); onCommitRename(); }
            else if (e.key === 'Escape') { e.preventDefault(); onCancelRename(); }
          }}
          onBlur={() => onCommitRename()}
          autoFocus
          aria-label="Rename column"
          data-column-title-input
        />
      ) : sortField ? (
        <button
          className="flex items-center gap-1 min-w-0 text-left hover:text-foreground transition-colors"
          onClick={(e) => { e.stopPropagation(); onSortChange({ field: sortField, dir: isSorted ? nextDir : 'asc' }); }}
          onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onStartRename(); }}
          type="button"
          aria-pressed={isSorted}
          title="Sort by this column"
        >
          <span className="truncate">{column.title}</span>
          {isSorted && <span className="text-[10px] text-slate-400">{sort.dir === 'asc' ? '↑' : '↓'}</span>}
        </button>
      ) : (
        <span className="truncate text-[11px] font-semibold text-slate-500" onDoubleClick={(e) => { e.preventDefault(); e.stopPropagation(); onStartRename(); }}>
          {column.title}
        </span>
      )}

      <button
        ref={menuTriggerRef}
        className="ml-auto rounded-md px-1.5 py-1 text-slate-400 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-border/50 transition"
        onClick={openMenu}
        type="button"
        aria-label="Column actions"
      >
        …
      </button>

      {menuOpen && createPortal(
        <div
          ref={menuDropdownRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, width: 220 }}
          className="rounded-xl border border-border bg-card shadow-xl z-[200] overflow-hidden py-1"
        >
          {/* Settings — STATUS only */}
          {column.type === 'STATUS' && (
            <>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
                onClick={() => setSettingsOpen((v) => !v)}
              >
                <span className="flex items-center gap-2"><span className="text-slate-400">⚙</span> Settings</span>
                <span className="text-slate-400 text-[10px]">{settingsOpen ? '▲' : '▼'}</span>
              </button>
              {settingsOpen && (
                <div className="border-t border-border bg-background px-3 py-2 space-y-1">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Status options</p>
                  {(statusOptions ?? []).map((opt) => (
                    <div key={opt.label} className="flex items-center gap-2 py-0.5">
                      <span className="h-3 w-3 rounded-full flex-shrink-0" style={{ backgroundColor: opt.color }} />
                      <span className="text-xs text-foreground/80">{opt.label}</span>
                    </div>
                  ))}
                  {(statusOptions ?? []).length === 0 && (
                    <p className="text-xs text-slate-400 italic">No options yet</p>
                  )}
                  {!creatingStatus ? (
                    <button
                      type="button"
                      className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                      onClick={() => setCreatingStatus(true)}
                    >
                      ＋ Add option
                    </button>
                  ) : (
                    <div className="mt-1.5 space-y-1.5">
                      <input
                        className="w-full rounded-md border border-border bg-card px-2 py-1 text-xs focus:outline-none focus:border-primary"
                        placeholder="Label…"
                        value={newStatusLabel}
                        onChange={(e) => setNewStatusLabel(e.target.value)}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && newStatusLabel.trim()) {
                            onCreateStatusOption?.(newStatusLabel.trim(), newStatusColor);
                            setCreatingStatus(false); setNewStatusLabel('');
                          } else if (e.key === 'Escape') { setCreatingStatus(false); setNewStatusLabel(''); }
                        }}
                      />
                      <div className="grid grid-cols-9 gap-1">
                        {STATUS_COLORS.map((c) => (
                          <button key={c} type="button" className={`h-4 w-4 rounded-full transition-transform hover:scale-110 ${newStatusColor === c ? 'ring-2 ring-offset-1 ring-slate-600 scale-110' : ''}`} style={{ backgroundColor: c }} onClick={() => setNewStatusColor(c)} />
                        ))}
                      </div>
                      <div className="flex gap-1.5">
                        <button type="button" className="flex-1 rounded-md bg-primary px-2 py-1 text-[11px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50" disabled={!newStatusLabel.trim()} onClick={() => { onCreateStatusOption?.(newStatusLabel.trim(), newStatusColor); setCreatingStatus(false); setNewStatusLabel(''); }}>
                          Add
                        </button>
                        <button type="button" className="rounded-md border border-border px-2 py-1 text-[11px] text-slate-500 hover:text-foreground" onClick={() => { setCreatingStatus(false); setNewStatusLabel(''); }}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
              <div className="border-t border-border my-1" />
            </>
          )}

          {/* Settings — DATE only: Deadline Mode */}
          {column.type === 'DATE' && (
            <>
              <button
                type="button"
                className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
                onClick={() => setSettingsOpen((v) => !v)}
              >
                <span className="flex items-center gap-2"><span className="text-slate-400">⚙</span> Settings</span>
                <span className="text-slate-400 text-[10px]">{settingsOpen ? '▲' : '▼'}</span>
              </button>
              {settingsOpen && (
                <div className="border-t border-border bg-background px-3 py-2 space-y-2">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1.5">Deadline Mode</p>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-3.5 w-3.5 accent-primary"
                      checked={dateSettings?.deadlineMode === true}
                      onChange={(e) => {
                        onUpdateDateSettings?.({ ...dateSettings, deadlineMode: e.target.checked });
                      }}
                    />
                    <span className="text-xs text-foreground/80">Enable deadline mode</span>
                  </label>
                  {dateSettings?.deadlineMode && (
                    <>
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Linked status column</p>
                        <CustomSelect
                          value={dateSettings?.linkedStatusColumnId ?? ''}
                          options={(allColumns ?? []).filter((c) => c.type === 'STATUS').map((c) => ({ value: c.id, label: c.title }))}
                          onChange={(val) => onUpdateDateSettings?.({ ...dateSettings, linkedStatusColumnId: val || undefined })}
                          placeholder="None"
                        />
                      </div>
                      {dateSettings?.linkedStatusColumnId && (
                        <div className="space-y-1">
                          <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Complete status value</p>
                          <CustomSelect
                            value={dateSettings?.completeStatusValue ?? ''}
                            options={(() => {
                              const statusCol = (allColumns ?? []).find((c) => c.id === dateSettings.linkedStatusColumnId);
                              return getStatusOptions(statusCol?.settings).map((o) => ({ value: o.label, label: o.label }));
                            })()}
                            onChange={(val) => onUpdateDateSettings?.({ ...dateSettings, completeStatusValue: val || undefined })}
                            placeholder="Done"
                          />
                        </div>
                      )}
                      <div className="space-y-1">
                        <p className="text-[10px] text-slate-400 uppercase tracking-wide font-medium">Linked assignee column</p>
                        <CustomSelect
                          value={dateSettings?.linkedAssigneeColumnId ?? ''}
                          options={(allColumns ?? []).filter((c) => c.type === 'PERSON').map((c) => ({ value: c.id, label: c.title }))}
                          onChange={(val) => onUpdateDateSettings?.({ ...dateSettings, linkedAssigneeColumnId: val || undefined })}
                          placeholder="None"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="border-t border-border my-1" />
            </>
          )}

          {/* Filter / Sort */}
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
            onClick={() => { setMenuOpen(false); onFilter?.(); }}>
            <span className="text-slate-400">≡</span> Filter this column
          </button>
          {sortField && (
            <>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
                onClick={() => { setMenuOpen(false); onSortChange({ field: sortField, dir: 'asc' }); }}>
                <span className="text-slate-400">↑</span> Sort ascending
                {isSorted && sort.dir === 'asc' && <span className="ml-auto text-primary text-[10px]">✓</span>}
              </button>
              <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
                onClick={() => { setMenuOpen(false); onSortChange({ field: sortField, dir: 'desc' }); }}>
                <span className="text-slate-400">↓</span> Sort descending
                {isSorted && sort.dir === 'desc' && <span className="ml-auto text-primary text-[10px]">✓</span>}
              </button>
            </>
          )}

          <div className="border-t border-border my-1" />

          {/* Collapse / Group by */}
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
            onClick={() => { setMenuOpen(false); onCollapse?.(); }}>
            <span className="text-slate-400">⊟</span> Collapse column
          </button>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
            onClick={() => { setMenuOpen(false); onGroupBy?.(); }}>
            <span className="text-slate-400">⊞</span> Group by this column
          </button>

          <div className="border-t border-border my-1" />

          {/* Column operations */}
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
            onClick={() => { setMenuOpen(false); onDuplicate?.(); }}>
            <span className="text-slate-400">⧉</span> Duplicate column
          </button>
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
            onClick={() => { setMenuOpen(false); onAddRight?.(); }}>
            <span className="text-slate-400">+</span> Add column to the right
          </button>

          {/* Change type submenu */}
          <button type="button" className="flex w-full items-center justify-between px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
            onClick={() => setTypeSubmenuOpen((v) => !v)}>
            <span className="flex items-center gap-2"><span className="text-slate-400">⟳</span> Change column type</span>
            <span className="text-slate-400 text-[10px]">{typeSubmenuOpen ? '▲' : '▼'}</span>
          </button>
          {typeSubmenuOpen && (
            <div className="bg-background border-t border-border">
              {COLUMN_TYPES.map((t) => (
                <button key={t.value} type="button"
                  className={`flex w-full items-center gap-2 px-4 py-1.5 text-left text-xs hover:bg-border/50 ${column.type === t.value ? 'text-primary font-semibold' : 'text-foreground/80'}`}
                  onClick={() => { setMenuOpen(false); if (column.type !== t.value) onChangeType?.(t.value); }}>
                  <span className="w-4 text-center text-slate-400">{t.icon}</span>
                  {t.label}
                  {column.type === t.value && <span className="ml-auto text-primary text-[10px]">✓</span>}
                </button>
              ))}
            </div>
          )}

          <div className="border-t border-border my-1" />

          {/* Rename / Delete */}
          <button type="button" className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-foreground/80 hover:bg-background"
            onClick={() => { setMenuOpen(false); onStartRename(); }}>
            <span className="text-slate-400">✏</span> Rename
          </button>
          <button type="button"
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-700 hover:bg-rose-500/10 disabled:opacity-40 disabled:hover:bg-transparent"
            onClick={() => { setMenuOpen(false); onDeleteColumn?.(); }}
            disabled={!!disableDelete || !onDeleteColumn}>
            <span className="text-rose-400">🗑</span> Delete
          </button>
        </div>,
        document.body
      )}
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
  onSelectChange,
  onCreateStatusOption,
  gridTemplate,
  collapsedColumnIds,
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
  onSelectChange?: (itemId: string, selected: boolean) => void;
  onCreateStatusOption?: (columnId: string, label: string, color: string) => void;
  gridTemplate?: string;
  collapsedColumnIds?: Set<string>;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
  });
  const safeName = item.name?.trim() ? item.name.trim() : 'Untitled';

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  const [rowMenuOpen, setRowMenuOpen] = useState(false);
  const [rowMenuPos, setRowMenuPos] = useState({ top: 0, left: 0 });
  const rowMenuTriggerRef = useRef<HTMLButtonElement | null>(null);
  const rowMenuDropdownRef = useRef<HTMLDivElement | null>(null);
  const [nameSavedFlash, setNameSavedFlash] = useState(false);
  useEffect(() => {
    if (!rowMenuOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        (rowMenuTriggerRef.current && rowMenuTriggerRef.current.contains(t)) ||
        (rowMenuDropdownRef.current && rowMenuDropdownRef.current.contains(t))
      ) return;
      setRowMenuOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [rowMenuOpen]);

  const commitNameSave = (input: HTMLInputElement) => {
    const next = input.value.trim();
    const finalName = next || 'Untitled';
    if (finalName !== item.name) updateItem.mutate({ id: item.id, name: finalName });
    setNameSavedFlash(true);
    setTimeout(() => setNameSavedFlash(false), 800);
  };

  // Helper to render a cell value for mobile card layout
  const renderMobileCell = (column: typeof board.columns[number], index: number) => {
    if (column.type === 'TEXT' && index === 0) return null; // Name handled separately

    const cell = findCellValue(item, column.id);

    if (column.type === 'TEXT') {
      const textValue = typeof cell?.value === 'string' ? cell.value : '';
      return (
        <div key={column.id} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-400 tracking-wide">{column.title}</label>
          <input
            className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:bg-card focus:border-primary focus:outline-none min-h-[44px]"
            defaultValue={textValue}
            onBlur={(event) => {
              const next = event.currentTarget.value.trim();
              if (next !== textValue) {
                updateCell.mutate({ itemId: item.id, columnId: column.id, value: next });
              }
            }}
          />
        </div>
      );
    }

    if (column.type === 'STATUS') {
      const statusValue = typeof cell?.value === 'object' && cell.value ? (cell.value as { label?: string; color?: string }) : null;
      const statusOptions = statusOptionsLookup.get(column.id) ?? [];
      const statusLabels = statusOptions.map((o) => o.label);
      const currentStatusLabel = statusValue?.label ?? '';
      const optionList = currentStatusLabel && !statusLabels.includes(currentStatusLabel)
        ? [{ label: currentStatusLabel, color: statusValue?.color ?? '#94a3b8' }, ...statusOptions]
        : statusOptions;

      return (
        <div key={column.id} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-400 tracking-wide">{column.title}</label>
          <StatusCell
            itemId={item.id}
            columnId={column.id}
            value={statusValue}
            options={optionList}
            onChange={(next) => updateCell.mutate({ itemId: item.id, columnId: column.id, value: next })}
            onCreateOption={onCreateStatusOption ? (label, color) => onCreateStatusOption(column.id, label, color) : undefined}
          />
        </div>
      );
    }

    if (column.type === 'PERSON') {
      const personValue = typeof cell?.value === 'object' && cell.value ? (cell.value as { name?: string; initials?: string; userId?: string }) : null;
      return (
        <div key={column.id} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-400 tracking-wide">{column.title}</label>
          <CustomSelect
            value={personValue?.userId ?? ''}
            options={memberOptions.map((m) => ({ value: m.id, label: m.name }))}
            onChange={(val) => {
              const selected = memberOptions.find((m) => m.id === val);
              updateCell.mutate({ itemId: item.id, columnId: column.id, value: selected ? { userId: selected.id, name: selected.name, initials: selected.initials } : null });
            }}
            placeholder="Unassigned"
            renderSelected={(opt) => (
              <span className="flex items-center gap-2">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-border text-[10px] font-bold text-foreground/70">
                  {personValue?.initials ?? '?'}
                </span>
                <span>{opt?.label ?? 'Unassigned'}</span>
              </span>
            )}
          />
        </div>
      );
    }

    if (column.type === 'DATE') {
      const dateValue = typeof cell?.value === 'string' ? cell.value : '';
      const colSettings = column.settings as DateColumnSettings | null;
      const isDeadlineModeM = colSettings?.deadlineMode === true;

      let isOverdueM: boolean;
      let isWarningM = false;
      let isCompleteM = false;

      if (isDeadlineModeM && dateValue) {
        const linkedStatusColId = colSettings?.linkedStatusColumnId;
        const completeStatusValue = colSettings?.completeStatusValue ?? 'Done';
        const statusCellM = linkedStatusColId ? findCellValue(item, linkedStatusColId) : null;
        const statusRawM = statusCellM?.value;
        const statusLabelM = typeof statusRawM === 'object' && statusRawM !== null && 'label' in statusRawM
          ? (statusRawM as { label: string }).label
          : typeof statusRawM === 'string' ? statusRawM : null;
        isCompleteM = statusLabelM?.toLowerCase() === completeStatusValue.toLowerCase();
        const deadlineDateM = new Date(dateValue + 'T23:59:59');
        const nowM = new Date();
        const msUntilDeadlineM = deadlineDateM.getTime() - nowM.getTime();
        isOverdueM = !isCompleteM && msUntilDeadlineM < 0;
        isWarningM = !isCompleteM && msUntilDeadlineM >= 0 && msUntilDeadlineM < 3 * 24 * 60 * 60 * 1000;
      } else {
        isOverdueM = !!(dateValue && !isItemDone(item) && new Date(dateValue) < new Date(new Date().setHours(0, 0, 0, 0)));
      }

      return (
        <div key={column.id} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-400 tracking-wide">{column.title}</label>
          <div className="flex items-center gap-2">
            <CustomDateInput
              value={dateValue}
              onChange={(val) => updateCell.mutate({ itemId: item.id, columnId: column.id, value: val || null })}
              isOverdue={isOverdueM}
              className="flex-1"
            />
            {isCompleteM && (
              <span className="text-xs font-bold text-emerald-600 flex-shrink-0" title="Done">✓</span>
            )}
            {isWarningM && !isOverdueM && !isCompleteM && (
              <span className="text-xs text-amber-500 flex-shrink-0" title="Due soon">⚠</span>
            )}
          </div>
        </div>
      );
    }

    if (column.type === 'LINK') {
      const linkValue = typeof cell?.value === 'object' && cell.value ? (cell.value as { url?: string; label?: string }) : { url: '', label: '' };
      return (
        <div key={column.id} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-400 tracking-wide">{column.title}</label>
          <div className="flex gap-2">
            <input className="w-1/2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px]" placeholder="Label" defaultValue={linkValue.label} onBlur={(e) => { if (e.target.value !== linkValue.label) updateCell.mutate({ itemId: item.id, columnId: column.id, value: { ...linkValue, label: e.target.value } }); }} />
            <input className="w-1/2 rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px]" placeholder="URL" defaultValue={linkValue.url} onBlur={(e) => { if (e.target.value !== linkValue.url) updateCell.mutate({ itemId: item.id, columnId: column.id, value: { ...linkValue, url: e.target.value } }); }} />
          </div>
        </div>
      );
    }

    if (column.type === 'NUMBER') {
      const numValue = typeof cell?.value === 'number' ? cell.value : '';
      return (
        <div key={column.id} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-400 tracking-wide">{column.title}</label>
          <input className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary min-h-[44px]" type="number" defaultValue={numValue} onBlur={(e) => { const val = e.target.value === '' ? null : Number(e.target.value); if (val !== numValue) updateCell.mutate({ itemId: item.id, columnId: column.id, value: val }); }} />
        </div>
      );
    }

    if (column.type === 'TIMELINE') {
      const timelineValue = typeof cell?.value === 'object' && cell.value ? (cell.value as { start?: string; end?: string }) : { start: '', end: '' };
      return (
        <div key={column.id} className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-slate-400 tracking-wide">{column.title}</label>
          <div className="flex gap-2">
            <CustomDateInput className="flex-1" value={timelineValue.start ?? ''} onChange={(val) => updateCell.mutate({ itemId: item.id, columnId: column.id, value: { ...timelineValue, start: val } })} />
            <CustomDateInput className="flex-1" value={timelineValue.end ?? ''} onChange={(val) => updateCell.mutate({ itemId: item.id, columnId: column.id, value: { ...timelineValue, end: val } })} />
          </div>
        </div>
      );
    }

    return (
      <div key={column.id} className="flex flex-col gap-1">
        <label className="text-[11px] font-medium text-slate-400 tracking-wide">{column.title}</label>
        <span className="text-sm text-slate-400">{cell?.value ? String(cell.value) : '—'}</span>
      </div>
    );
  };

  // Badges for the item (attachments, dependencies, blocked)
  const badges = (
    <div className="flex items-center gap-2 flex-wrap">
      {/* eslint-disable @typescript-eslint/no-explicit-any */}
      {(item as any)._count?.attachments > 0 && (
        <span className="text-xs text-slate-400" title={`${(item as any)._count?.attachments} attachment(s)`}>📎 {(item as any)._count?.attachments}</span>
      )}
      {(((item as any)._count?.dependenciesAsSource ?? 0) + ((item as any)._count?.dependenciesAsTarget ?? 0)) > 0 && (
        <span className="text-xs text-slate-400">🔗 {((item as any)._count?.dependenciesAsSource ?? 0) + ((item as any)._count?.dependenciesAsTarget ?? 0)}</span>
      )}
      {(() => {
        const asTarget = (item as any).dependenciesAsTarget as { type: string }[] | undefined;
        const blockedByTarget = asTarget?.some((d: { type: string }) => d.type === 'BLOCKS');
        const blockedBySource = ((item as any).dependenciesAsSource as { type: string }[] | undefined)?.some((d: { type: string }) => d.type === 'BLOCKED_BY');
        return (blockedByTarget || blockedBySource) ? (
          <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-500">⛔ Blocked</span>
        ) : null;
      })()}
      {/* eslint-enable @typescript-eslint/no-explicit-any */}
    </div>
  );

  return (
    <>
      {/* ===== MOBILE CARD LAYOUT (< 640px) ===== */}
      <div
        ref={setNodeRef}
        className={`sm:hidden rounded-xl border p-4 shadow-sm space-y-3 ${isDragging ? 'opacity-50' : ''} ${isSelected ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}
        style={style}
        onClick={(e) => onItemClick?.(item.id, e)}
      >
        {/* Card header: drag handle + name + actions */}
        <div className="flex items-start gap-2">
          <div className="flex flex-col items-center gap-1">
            <input
              type="checkbox"
              checked={!!isSelected}
              onChange={(e) => onSelectChange?.(item.id, e.target.checked)}
              className="mt-1 h-4 w-4 accent-primary"
              aria-label="Select item"
              data-row-select
            />
            <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-slate-400 text-lg min-w-[44px] min-h-[44px] flex items-center justify-center" aria-label="Drag to reorder item">⠿</span>
          </div>
          <div className="flex-1 min-w-0">
            <input
              aria-label={`Item name: ${safeName}`}
              className={`w-full rounded-lg border bg-transparent px-2 py-2 text-base font-medium text-foreground hover:border-border hover:bg-background focus:border-primary focus:bg-card focus:outline-none min-h-[44px] transition-all ${nameSavedFlash ? 'border-green-400 ring-2 ring-green-400/30' : 'border-transparent'}`}
              defaultValue={safeName}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
              onBlur={(e) => commitNameSave(e.currentTarget)}
            />
            {badges}
          </div>
        </div>

        {/* Card fields */}
        <div className="space-y-3 pl-2">
          {board.columns.map((col, idx) => renderMobileCell(col, idx))}
        </div>

        {/* Card actions */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
          <button
            className="rounded-lg bg-rose-500/10 px-3 py-2.5 text-sm font-medium text-rose-500 hover:bg-rose-500/20 min-h-[44px]"
            onClick={() => {
              deleteItem.mutate({ id: item.id });
            }}
            type="button"
          >
            Delete
          </button>
        </div>
      </div>

      {/* ===== DESKTOP TABLE ROW (>= 640px) ===== */}
      <div
        ref={setNodeRef}
        className={`hidden sm:grid group items-stretch gap-0 text-sm ${isDragging ? 'opacity-50' : ''} ${isSelected ? 'bg-primary/5' : 'bg-card'} ${isFocusedRow ? 'ring-2 ring-inset ring-primary/20' : ''} hover:bg-background transition-colors`}
        style={{
          ...style,
          gridTemplateColumns: gridTemplate ?? `minmax(0,2.2fr) repeat(${Math.max(board.columns.length - 1, 1)}, minmax(0,1fr))`,
          minWidth: 'max-content',
          width: '100%',
          minHeight: '40px',
        }}
        onClick={(e) => onItemClick?.(item.id, e)}
      >
      {board.columns.map((column, index) => {
        if (index > 0 && collapsedColumnIds?.has(column.id)) {
          return <div key={column.id} />;
        }
        if (index === 0) {
          return (
            <div
              key={column.id}
              className={`flex items-center justify-between gap-3 px-3 py-1 ${isFocusedRow && focusedCol === index ? 'ring-1 ring-inset ring-primary/40' : ''}`}
              data-cell-row={rowIndex}
              data-cell-col={index}
            >
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                {/* Row ellipsis menu — left of checkbox, portal-based */}
                <div className="flex-shrink-0">
                  <button
                    ref={rowMenuTriggerRef}
                    type="button"
                    className="h-6 w-6 flex items-center justify-center rounded text-slate-400 opacity-0 group-hover:opacity-100 hover:text-foreground hover:bg-border/50 transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (rowMenuTriggerRef.current) {
                        const rect = rowMenuTriggerRef.current.getBoundingClientRect();
                        setRowMenuPos({ top: rect.bottom + 4, left: rect.left });
                      }
                      setRowMenuOpen((v) => !v);
                    }}
                    aria-label="Row actions"
                  >
                    ⋯
                  </button>
                  {rowMenuOpen && createPortal(
                    <div
                      ref={rowMenuDropdownRef}
                      style={{ position: 'fixed', top: rowMenuPos.top, left: rowMenuPos.left, minWidth: 144 }}
                      className="rounded-lg border border-border bg-card shadow-xl z-[200] overflow-hidden"
                    >
                      <button
                        type="button"
                        className="block w-full px-3 py-2 text-left text-xs text-rose-700 hover:bg-rose-500/10"
                        onClick={(e) => { e.stopPropagation(); setRowMenuOpen(false); deleteItem.mutate({ id: item.id }); }}
                      >
                        Delete item
                      </button>
                    </div>,
                    document.body,
                  )}
                </div>
                <input
                  type="checkbox"
                  checked={!!isSelected}
                  onChange={(e) => onSelectChange?.(item.id, e.target.checked)}
                  className="h-4 w-4 accent-primary opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
                  aria-label="Select item"
                  data-row-select
                />
                <span {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-foreground/70" aria-label="Drag to reorder item" title="Drag to reorder" role="img">⠿</span>
                <input
                  aria-label={`Item name: ${safeName}`}
                  className={`w-full truncate rounded-lg border bg-transparent px-2 py-1 text-sm text-foreground hover:border-border hover:bg-background focus:border-primary focus:bg-card focus:outline-none transition-all ${nameSavedFlash ? 'border-green-400 ring-2 ring-green-400/30' : 'border-transparent'}`}
                  defaultValue={safeName}
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
                  onBlur={(e) => commitNameSave(e.currentTarget)}
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
              {(() => {
                const asTarget = (item as any).dependenciesAsTarget as { type: string }[] | undefined;
                const blockedByTarget = asTarget?.some((d: { type: string }) => d.type === 'BLOCKS');
                const blockedBySource = ((item as any).dependenciesAsSource as { type: string }[] | undefined)?.some((d: { type: string }) => d.type === 'BLOCKED_BY');
                return (blockedByTarget || blockedBySource) ? (
                  <span className="inline-flex items-center rounded-full border border-rose-500/30 bg-rose-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-rose-500 flex-shrink-0" title="Blocked by another item" aria-label="Blocked" role="status">
                    ⛔ Blocked
                  </span>
                ) : null;
              })()}
              {/* eslint-enable @typescript-eslint/no-explicit-any */}
            </div>
          );
        }

        const cell = findCellValue(item, column.id);

        if (column.type === 'TEXT') {
          const textValue =
            typeof cell?.value === 'string' ? cell.value : '';
          return (
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={`flex items-center border-l border-border h-full ${isFocusedRow && focusedCol === index ? 'ring-1 ring-inset ring-primary/40' : ''}`}>
              <input
                className="w-full bg-transparent px-3 py-2 text-xs text-foreground focus:outline-none"
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
          const statusOptions = statusOptionsLookup.get(column.id) ?? [];
          const statusLabels = statusOptions.map((option) => option.label);
          const currentStatusLabel = statusValue?.label ?? '';
          const optionList =
            currentStatusLabel && !statusLabels.includes(currentStatusLabel)
              ? [{ label: currentStatusLabel, color: statusValue?.color ?? '#94a3b8' }, ...statusOptions]
              : statusOptions;

          return (
            <StatusCell
              key={column.id}
              itemId={item.id}
              columnId={column.id}
              value={statusValue}
              options={optionList}
              onChange={(next) => {
                updateCell.mutate({
                  itemId: item.id,
                  columnId: column.id,
                  value: next,
                });
              }}
              onCreateOption={onCreateStatusOption ? (label, color) => onCreateStatusOption(column.id, label, color) : undefined}
              className={`border-l border-border ${isFocusedRow && focusedCol === index ? 'ring-1 ring-inset ring-primary/40' : ''}`}
              rowIndex={rowIndex}
              colIndex={index}
              flat={true}
            />
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
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={`border-l border-border h-full ${isFocusedRow && focusedCol === index ? 'ring-1 ring-inset ring-primary/40' : ''}`}>
              <CustomSelect
                value={personValue?.userId ?? ''}
                options={memberOptions.map((m) => ({ value: m.id, label: m.name }))}
                onChange={(val) => {
                  const selected = memberOptions.find((m) => m.id === val);
                  updateCell.mutate({
                    itemId: item.id,
                    columnId: column.id,
                    value: selected ? { userId: selected.id, name: selected.name, initials: selected.initials } : null,
                  });
                }}
                placeholder="Unassigned"
                variant="flat"
                renderSelected={(opt) => (
                  <span className="flex items-center gap-1.5">
                    <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-border text-[9px] font-bold text-foreground/70">
                      {personValue?.initials ?? '?'}
                    </span>
                    <span className="truncate">{opt?.label ?? 'Unassigned'}</span>
                  </span>
                )}
              />
            </div>
          );
        }
        if (column.type === 'DATE') {
          const dateValue =
            typeof cell?.value === 'string'
              ? cell.value
              : '';

          const colSettings = column.settings as DateColumnSettings | null;
          const isDeadlineMode = colSettings?.deadlineMode === true;

          let isOverdue: boolean;
          let isWarning = false;
          let isComplete = false;

          if (isDeadlineMode && dateValue) {
            const linkedStatusColId = colSettings?.linkedStatusColumnId;
            const completeStatusValue = colSettings?.completeStatusValue ?? 'Done';
            const statusCell = linkedStatusColId ? findCellValue(item, linkedStatusColId) : null;
            const statusRaw = statusCell?.value;
            const statusLabel = typeof statusRaw === 'object' && statusRaw !== null && 'label' in statusRaw
              ? (statusRaw as { label: string }).label
              : typeof statusRaw === 'string' ? statusRaw : null;
            isComplete = statusLabel?.toLowerCase() === completeStatusValue.toLowerCase();
            const deadlineDate = new Date(dateValue + 'T23:59:59');
            const now = new Date();
            const msUntilDeadline = deadlineDate.getTime() - now.getTime();
            isOverdue = !isComplete && msUntilDeadline < 0;
            isWarning = !isComplete && msUntilDeadline >= 0 && msUntilDeadline < 3 * 24 * 60 * 60 * 1000;
          } else {
            isOverdue = !!(dateValue && !isItemDone(item) && new Date(dateValue) < new Date(new Date().setHours(0, 0, 0, 0)));
          }

          return (
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={`flex items-center gap-1 px-2 border-l border-border h-full ${isFocusedRow && focusedCol === index ? 'ring-1 ring-inset ring-primary/40' : ''}`}>
              <CustomDateInput
                value={dateValue}
                onChange={(val) => updateCell.mutate({ itemId: item.id, columnId: column.id, value: val || null })}
                isOverdue={isOverdue}
                className="flex-1"
              />
              {isComplete && (
                <span className="text-[10px] font-bold text-emerald-600 flex-shrink-0" aria-label="Complete" role="status" title="Done">✓</span>
              )}
              {isWarning && !isOverdue && !isComplete && (
                <span className="text-[10px] text-amber-500 flex-shrink-0" aria-label="Due soon" role="status" title="Due soon">⚠</span>
              )}
            </div>
          );
        }
        if (column.type === 'LINK') {
          const linkValue = typeof cell?.value === 'object' && cell.value
            ? (cell.value as { url?: string; label?: string })
            : { url: '', label: '' };

          return (
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={`flex items-center gap-0 border-l border-border h-full ${isFocusedRow && focusedCol === index ? 'ring-1 ring-inset ring-primary/40' : ''}`}>
              <input
                className="w-1/2 bg-transparent border-r border-border px-2 py-2 text-xs text-foreground focus:outline-none"
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
                className="w-1/2 bg-transparent px-2 py-2 text-xs text-foreground focus:outline-none"
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
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={`flex items-center border-l border-border h-full ${isFocusedRow && focusedCol === index ? 'ring-1 ring-inset ring-primary/40' : ''}`}>
              <input
                className="w-full bg-transparent px-3 py-2 text-xs text-foreground focus:outline-none"
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
            <div key={column.id} data-cell-row={rowIndex} data-cell-col={index} className={`flex items-center gap-1 px-2 border-l border-border h-full ${isFocusedRow && focusedCol === index ? 'ring-1 ring-inset ring-primary/40' : ''}`}>
              <CustomDateInput
                className="flex-1"
                value={timelineValue.start ?? ''}
                onChange={(val) => updateCell.mutate({ itemId: item.id, columnId: column.id, value: { ...timelineValue, start: val } })}
              />
              <CustomDateInput
                className="flex-1"
                value={timelineValue.end ?? ''}
                onChange={(val) => updateCell.mutate({ itemId: item.id, columnId: column.id, value: { ...timelineValue, end: val } })}
              />
            </div>
          );
        }
        return (
          <span key={column.id} className="flex items-center border-l border-border h-full px-3 text-xs text-slate-400">
            {cell?.value ? String(cell.value) : '—'}
          </span>
        );
      })}
      </div>
    </>
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
  onSelectChange,
  onCreateStatusOption,
  gridTemplate,
  collapsedColumnIds,
  isVirtual,
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
  onSelectChange?: (itemId: string, selected: boolean) => void;
  onCreateStatusOption?: (columnId: string, label: string, color: string) => void;
  gridTemplate?: string;
  collapsedColumnIds?: Set<string>;
  isVirtual?: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
  });
  const addItemInputRef = useRef<HTMLInputElement | null>(null);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  const focusAddItem = () => {
    if (collapsedGroups.has(group.id)) {
      toggleGroup(group.id);
    }
    setTimeout(() => addItemInputRef.current?.focus(), 0);
  };

  return (
    <div ref={setNodeRef} style={style} className={`px-3 py-3 sm:px-6 sm:py-5 ${isDragging ? 'opacity-50' : ''}`}>
      <div className="group/grouprow rounded-xl sm:rounded-b-none border border-border bg-background/70 px-3 py-2 sm:px-4 sm:py-2.5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <div {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing text-foreground/70 min-w-[44px] min-h-[44px] flex items-center justify-center sm:min-w-0 sm:min-h-0" aria-label="Drag to reorder group" title="Drag to reorder" role="img">⠿</div>
            <button
              onClick={() => toggleGroup(group.id)}
              className="flex h-8 w-8 sm:h-7 sm:w-7 items-center justify-center rounded-md bg-card text-slate-500 hover:bg-border/50 hover:text-foreground flex-shrink-0 border border-border"
              type="button"
              aria-label={collapsedGroups.has(group.id) ? 'Expand group' : 'Collapse group'}
            >
              <span className={`transform transition-transform ${collapsedGroups.has(group.id) ? '-rotate-90' : ''}`}>
                ▼
              </span>
            </button>
            <span
              className="h-3 w-3 rounded-full flex-shrink-0"
              style={{ backgroundColor: group.color ?? '#94a3b8' }}
              aria-hidden="true"
            />
            <input
              className="w-full max-w-xs rounded-lg border border-transparent bg-transparent px-2 py-2 sm:py-1 text-sm font-semibold text-foreground hover:border-border hover:bg-card/70 focus:border-primary focus:bg-card focus:outline-none min-h-[44px] sm:min-h-0"
              defaultValue={group.title}
              onBlur={(event) => {
                const next = event.currentTarget.value.trim();
                if (next && next !== group.title) {
                  updateGroup.mutate({ id: group.id, title: next });
                }
              }}
            />
            <span className="hidden sm:inline-flex items-center rounded-full border border-border bg-card px-2 py-0.5 text-[11px] font-semibold text-slate-500">
              {group.items.length}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {!isVirtual && (
              <button
                className="opacity-0 group-hover/grouprow:opacity-100 rounded-lg p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-500/10 transition-all"
                onClick={() => {
                  if (window.confirm(`Delete group "${group.title}" and all its items? This cannot be undone.`)) {
                    deleteGroup.mutate({ id: group.id });
                  }
                }}
                type="button"
                title="Delete group"
              >
                <svg width="14" height="14" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M2 4h12M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4M6 7v5M10 7v5M3 4l.8 9.1A1 1 0 004.8 14h6.4a1 1 0 001-.9L13 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
          </div>
        </div>
      </div>

      {!collapsedGroups.has(group.id) && (
        <div className="mt-0 space-y-3">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleItemDragEnd}
          >
            <SortableContext
              items={group.items.map((i) => i.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-border sm:rounded-b-xl sm:rounded-t-none sm:border sm:border-t-0 sm:border-border sm:bg-card sm:overflow-hidden">
                {group.items.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-4 py-3 text-xs text-slate-500 sm:rounded-none sm:border-0 sm:px-4 sm:py-5">
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
                      onSelectChange={onSelectChange}
                      onCreateStatusOption={onCreateStatusOption}
                      gridTemplate={gridTemplate}
                      collapsedColumnIds={collapsedColumnIds}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>

          {!isVirtual && <div
            className="block sm:grid items-center gap-4 rounded-xl border border-border bg-card px-4 py-2 text-sm text-slate-400 shadow-sm hover:shadow-md transition-shadow"
            style={{
              gridTemplateColumns: gridTemplate ?? `minmax(0,2.2fr) repeat(${Math.max(board.columns.length - 1, 1)}, minmax(0,1fr))`,
            }}
          >
            <div className="flex items-center gap-2">
              <span className="text-slate-400">＋</span>
              <input
                aria-label="Add new item"
                className="w-full bg-transparent px-2 py-3 sm:py-1 text-sm text-foreground placeholder:text-slate-400 focus:outline-none min-h-[44px] sm:min-h-0"
                placeholder="+ Add Item"
                ref={addItemInputRef}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    const input = event.currentTarget;
                    const name = input.value.trim();
                    if (name && !createItem.isPending) {
                      createItem.mutate(
                        { groupId: group.id, name },
                        {
                          onSuccess: () => {
                            input.value = '';
                          },
                        },
                      );
                    }
                  }
                }}
              />
            </div>
            {board.columns.slice(1).map((column) => (
              <div key={column.id} className="hidden sm:block h-8" />
            ))}
          </div>}

          <div
            className="mt-2 hidden sm:grid items-center gap-4 px-4 py-2"
            style={{
              gridTemplateColumns: gridTemplate ?? `minmax(0,2.2fr) repeat(${Math.max(board.columns.length - 1, 1)}, minmax(0,1fr))`,
            }}
          >
            <div />
            {board.columns.slice(1).map((column) => {
              if (collapsedColumnIds?.has(column.id)) return <div key={column.id} />;
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

                if (total === 0) return <div key={column.id} className="h-2 rounded-full bg-border" />;

                return (
                  <div key={column.id} className="h-2 flex rounded-full overflow-hidden bg-border">
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

export function BoardTable({ board, filters, sort, onFiltersChange, onSortChange, seamlessTop, stickyOffset, headerSlot, showCreateGroup: showCreateGroupProp, onCreateGroupChange }: BoardTableProps) {
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
  const [showFilters, setShowFilters] = useState(false);
  const [localShowCreateGroup, setLocalShowCreateGroup] = useState(false);
  const showCreateGroup = showCreateGroupProp !== undefined ? showCreateGroupProp : localShowCreateGroup;
  const setShowCreateGroup = (v: boolean) => {
    if (onCreateGroupChange) onCreateGroupChange(v);
    else setLocalShowCreateGroup(v);
  };
  const [newGroupTitle, setNewGroupTitle] = useState('');
  const [renamingColumnId, setRenamingColumnId] = useState<string | null>(null);
  const [columnTitleDraft, setColumnTitleDraft] = useState('');
  const [collapsedColumnIds, setCollapsedColumnIds] = useState<Set<string>>(new Set());
  const [groupByColumnId, setGroupByColumnId] = useState<string | null>(null);
  const [columnWidths, setColumnWidthsState] = useState<Record<string, number>>({});
  const saveWidthsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const bodyScrollRef = useRef<HTMLDivElement>(null);
  const syncBodyScroll = useCallback(() => {
    if (headerScrollRef.current && bodyScrollRef.current) {
      headerScrollRef.current.scrollLeft = bodyScrollRef.current.scrollLeft;
    }
  }, []);

  // --- M18: Selection state for Shift+Click ---
  const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
  const lastClickedItemRef = useRef<string | null>(null);

  // --- M18: Keyboard navigation state ---
  const [focusedCell, setFocusedCell] = useState<{ row: number; col: number } | null>(null);
  const tableRef = useRef<HTMLDivElement>(null);

  const reorderColumns = trpc.columns.reorder.useMutation({
    onSettled: async () => {
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
  });

  const createColumn = trpc.columns.create.useMutation({
    onSuccess: async (column) => {
      setRenamingColumnId(column.id);
      setColumnTitleDraft(column.title);
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
    onError: () => {
      pushToast({
        title: 'Create failed',
        description: 'Unable to create column.',
        tone: 'error',
      });
    },
  });

  const updateColumn = trpc.columns.update.useMutation({
    onSuccess: async () => {
      setRenamingColumnId(null);
      setColumnTitleDraft('');
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
    onError: () => {
      pushToast({
        title: 'Update failed',
        description: 'Unable to update column.',
        tone: 'error',
      });
    },
  });

  const deleteColumn = trpc.columns.delete.useMutation({
    onSuccess: async () => {
      setRenamingColumnId(null);
      setColumnTitleDraft('');
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
    onError: () => {
      pushToast({
        title: 'Delete failed',
        description: 'Unable to delete column.',
        tone: 'error',
      });
    },
  });

  const { data: prefsData } = trpc.userBoardPrefs.get.useQuery(board.id ? { boardId: board.id } : skipToken);
  const saveWidths = trpc.userBoardPrefs.setColumnWidths.useMutation();

  useEffect(() => {
    if (prefsData?.columnWidths && typeof prefsData.columnWidths === 'object') {
      setColumnWidthsState(prefsData.columnWidths as Record<string, number>);
    }
  }, [prefsData]);

  const handleResizeStart = useCallback((e: React.MouseEvent, columnId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const cell = (e.currentTarget as HTMLElement).parentElement;
    const startWidth = cell ? cell.getBoundingClientRect().width : 140;

    const onMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX;
      const newWidth = Math.max(60, Math.round(startWidth + diff));
      setColumnWidthsState((prev) => ({ ...prev, [columnId]: newWidth }));
    };

    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setColumnWidthsState((prev) => {
        if (saveWidthsTimerRef.current) clearTimeout(saveWidthsTimerRef.current);
        saveWidths.mutate({ boardId: board.id, widths: prev });
        return prev;
      });
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [board.id, saveWidths]);

  const reorderGroups = trpc.groups.reorder.useMutation({
    onSettled: async () => {
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
  });

  const createGroup = trpc.groups.create.useMutation({
    onSuccess: async () => {
      setShowCreateGroup(false);
      setNewGroupTitle('');
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
    onError: () => {
      pushToast({
        title: 'Group failed',
        description: 'Unable to create group.',
        tone: 'error',
      });
    },
  });

  const reorderItems = trpc.items.reorder.useMutation({
    onMutate: async (newOrder) => {
      // Optimistically update the UI immediately
      await utils.boards.getDefault.cancel();
      await utils.boards.getById.cancel();

      const previousDefault = utils.boards.getDefault.getData();
      const previousById = utils.boards.getById.getData({ id: board.id });

      // Update getDefault cache
      if (previousDefault) {
        utils.boards.getDefault.setData(undefined, (old) => {
          if (!old) return old;
          return {
            ...old,
            groups: old.groups.map((g) => {
              if (g.id !== newOrder.groupId) return g;
              const reorderedItems = newOrder.itemIds
                .map((id, index) => {
                  const item = g.items.find((it) => it.id === id);
                  if (!item) return null;
                  return { ...item, position: index + 1, groupId: newOrder.groupId };
                })
                .filter(Boolean) as typeof g.items;
              return { ...g, items: reorderedItems };
            }),
          };
        });
      }

      // Update getById cache
      if (previousById) {
        utils.boards.getById.setData({ id: board.id }, (old) => {
          if (!old) return old;
          return {
            ...old,
            groups: old.groups.map((g) => {
              if (g.id !== newOrder.groupId) return g;
              const reorderedItems = newOrder.itemIds
                .map((id, index) => {
                  const item = g.items.find((it) => it.id === id);
                  if (!item) return null;
                  return { ...item, position: index + 1, groupId: newOrder.groupId };
                })
                .filter(Boolean) as typeof g.items;
              return { ...g, items: reorderedItems };
            }),
          };
        });
      }

      return { previousDefault, previousById };
    },
    onError: (error, newOrder, context) => {
      console.error('Reorder failed:', error);
      // Rollback on error
      if (context?.previousDefault) {
        utils.boards.getDefault.setData(undefined, context.previousDefault);
      }
      if (context?.previousById) {
        utils.boards.getById.setData({ id: board.id }, context.previousById);
      }
    },
    onSettled: async () => {
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
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
        if (sort.field !== 'manual') {
          onSortChange({ field: 'manual', dir: 'asc' });
        }
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
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
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
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
    },
  });

  const deleteGroup = trpc.groups.delete.useMutation({
    onSettled: async () => {
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
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
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
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
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
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
    onMutate: async (input) => {
      await utils.boards.getDefault.cancel();
      await utils.boards.getById.cancel();

      const previousDefault = utils.boards.getDefault.getData();
      const previousById = utils.boards.getById.getData({ id: board.id });

      const tempId = `temp-${Date.now()}`;
      const now = new Date().toISOString();

      const buildTempItem = (group: BoardData['groups'][number]) => ({
        id: tempId,
        groupId: input.groupId,
        name: input.name,
        description: null,
        externalId: null,
        position: (group.items.at(-1)?.position ?? group.items.length) + 1,
        createdAt: new Date(now),
        updatedAt: new Date(now),
        cellValues: board.columns.map((col) => ({
          id: `temp-${tempId}-${col.id}`,
          itemId: tempId,
          columnId: col.id,
          value: null,
          createdAt: new Date(now),
          updatedAt: new Date(now),
          column: col,
        })),
        _count: { attachments: 0, dependenciesAsSource: 0, dependenciesAsTarget: 0 },
        dependenciesAsSource: [],
        dependenciesAsTarget: [],
        recurrence: null,
        nextDueDate: null,
      });

      const updateBoard = (old: BoardData | undefined | null) => {
        if (!old) return old;
        return {
          ...old,
          groups: old.groups.map((g) => {
            if (g.id !== input.groupId) return g;
            const tempItem = buildTempItem(g);
            return { ...g, items: [...g.items, tempItem] };
          }),
        };
      };

      utils.boards.getDefault.setData(undefined, (old) => updateBoard(old));
      utils.boards.getById.setData({ id: board.id }, (old) => updateBoard(old));

      return { previousDefault, previousById, tempId };
    },
    onSuccess: (item, _input, ctx) => {
      const replaceTemp = (old: BoardData | undefined | null) => {
        if (!old || !ctx?.tempId) return old;
        return {
          ...old,
          groups: old.groups.map((g) => ({
            ...g,
            items: g.items.map((i) => {
              if (i.id !== ctx.tempId) return i;
              return { ...i, ...item, id: item.id, cellValues: i.cellValues };
            }),
          })),
        };
      };

      utils.boards.getDefault.setData(undefined, (old) => replaceTemp(old));
      utils.boards.getById.setData({ id: board.id }, (old) => replaceTemp(old));
    },
    onError: (err, _input, ctx) => {
      if (ctx?.previousDefault) {
        utils.boards.getDefault.setData(undefined, ctx.previousDefault);
      }
      if (ctx?.previousById) {
        utils.boards.getById.setData({ id: ctx.previousById.id }, ctx.previousById);
      }
      pushToast({
        title: 'Create failed',
        description: err.message || 'Unable to create item.',
        tone: 'error',
      });
    },
    onSettled: async () => {
      await Promise.all([utils.boards.getDefault.invalidate(), utils.boards.getById.invalidate()]);
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

  const handleCreateStatusOption = useCallback(
    (columnId: string, label: string, color: string) => {
      const column = board.columns.find((c) => c.id === columnId);
      if (!column) return;
      const existing = (column.settings as { options?: Record<string, string> })?.options ?? {};
      const key = label.toLowerCase().replace(/\s+/g, '_');
      updateColumn.mutate({
        id: columnId,
        settings: { ...(column.settings as object), options: { ...existing, [key]: color } },
      });
    },
    [board.columns, updateColumn],
  );

  const handleCollapseColumn = useCallback((columnId: string) => {
    setCollapsedColumnIds((prev) => {
      const next = new Set(prev);
      if (next.has(columnId)) next.delete(columnId);
      else next.add(columnId);
      return next;
    });
  }, []);

  const handleGroupByColumn = useCallback((columnId: string) => {
    setGroupByColumnId((prev) => (prev === columnId ? null : columnId));
  }, []);

  const handleDuplicateColumn = useCallback((columnId: string) => {
    const column = board.columns.find((c) => c.id === columnId);
    if (!column) return;
    createColumn.mutate({
      boardId: board.id,
      title: `${column.title} (copy)`,
      type: column.type as any,
      settings: column.settings as any,
    });
  }, [board.columns, board.id, createColumn]);

  const handleAddColumnRight = useCallback((columnId: string) => {
    const columnIndex = board.columns.findIndex((c) => c.id === columnId);
    createColumn.mutate(
      { boardId: board.id, title: 'New Column', type: 'TEXT' },
      {
        onSuccess: (newCol) => {
          const reordered = [
            ...board.columns.slice(0, columnIndex + 1).map((c) => c.id),
            newCol.id,
            ...board.columns.slice(columnIndex + 1).map((c) => c.id),
          ];
          reorderColumns.mutate({ boardId: board.id, columnIds: reordered });
        },
      },
    );
  }, [board.columns, board.id, createColumn, reorderColumns]);

  const handleChangeColumnType = useCallback((columnId: string, type: string) => {
    updateColumn.mutate({ id: columnId, type: type as any });
  }, [updateColumn]);

  // --- M18: Shift+Click handler ---
  const handleItemClick = useCallback(
    (itemId: string, e: React.MouseEvent) => {
      const target = e.target as HTMLElement | null;
      const isInteractive = !!target?.closest(
        'input, textarea, select, button, a, [role="button"]',
      );
      if (isInteractive) return;
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
        if (!e.metaKey && !e.ctrlKey) {
          setSelectedItemId(itemId);
        }
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

  const gridTemplate = useMemo(
    () =>
      board.columns
        .map((col, i) => {
          if (collapsedColumnIds.has(col.id)) return '28px';
          const w = columnWidths[col.id];
          if (w) return `${w}px`;
          return i === 0 ? 'minmax(220px, 2.2fr)' : 'minmax(140px, 1fr)';
        })
        .join(' '),
    [board.columns, collapsedColumnIds, columnWidths],
  );

  const statusFilterColumn = useMemo(
    () => board.columns.find((c) => c.type === 'STATUS' && !c.title.toLowerCase().includes('priority')) ?? board.columns.find((c) => c.type === 'STATUS') ?? null,
    [board.columns],
  );
  const priorityFilterColumn = useMemo(
    () => board.columns.find((c) => c.type === 'STATUS' && c.title.toLowerCase().includes('priority')) ?? null,
    [board.columns],
  );
  const personFilterColumn = useMemo(
    () => board.columns.find((c) => c.type === 'PERSON') ?? null,
    [board.columns],
  );
  const dateFilterColumn = useMemo(
    () => board.columns.find((c) => c.type === 'DATE') ?? null,
    [board.columns],
  );

  const statusFilterOptions = statusFilterColumn ? getStatusOptions(statusFilterColumn.settings) : [];
  const priorityFilterOptions = priorityFilterColumn ? getStatusOptions(priorityFilterColumn.settings) : [];
  const hasActiveFilters = filters.status !== null || filters.person !== null || filters.priority !== null || filters.dueDateFrom !== null || filters.dueDateTo !== null;
  const showFilterControls = showFilters || hasActiveFilters;

  // Apply filters and sort to groups, and optionally group-by a column
  const filteredGroups = useMemo(() => {
    const baseGroups = board.groups
      .map((group) => ({
        ...group,
        items: filterAndSortItems(group.items, filters, sort, board.columns),
      }))
      .filter((group) => group.items.length > 0 || !hasActiveFilters);

    if (!groupByColumnId) return baseGroups;

    const groupByColumn = board.columns.find((c) => c.id === groupByColumnId);
    if (!groupByColumn) return baseGroups;

    const allItems = baseGroups.flatMap((g) => g.items);
    const byValue = new Map<string, typeof allItems>();
    for (const item of allItems) {
      const cell = item.cellValues.find((c) => c.columnId === groupByColumnId);
      let key: string;
      if (groupByColumn.type === 'STATUS') {
        key = (cell?.value as { label?: string } | null)?.label ?? '(No status)';
      } else if (groupByColumn.type === 'PERSON') {
        key = (cell?.value as { name?: string } | null)?.name ?? '(Unassigned)';
      } else {
        key = cell?.value ? String(cell.value) : '(Empty)';
      }
      if (!byValue.has(key)) byValue.set(key, []);
      byValue.get(key)!.push(item);
    }

    const firstGroup = baseGroups[0];
    if (!firstGroup) return baseGroups;

    return Array.from(byValue.entries()).map(([key, items], i) => ({
      ...firstGroup,
      id: `virtual-${groupByColumnId}-${i}`,
      title: key,
      items,
      color: '#94a3b8',
    }));
  }, [board.groups, board.columns, filters, sort, hasActiveFilters, groupByColumnId]);
  const totalFilteredItems = filteredGroups.reduce((sum, g) => sum + g.items.length, 0);

  const visibleItemIds = useMemo(() => {
    const ids: string[] = [];
    for (const group of filteredGroups) {
      if (collapsedGroups.has(group.id)) continue;
      for (const item of group.items) ids.push(item.id);
    }
    return ids;
  }, [filteredGroups, collapsedGroups]);

  const allVisibleSelected = visibleItemIds.length > 0 && visibleItemIds.every((id) => selectedItemIds.has(id));

  const toggleSelectAllVisible = useCallback(() => {
    setSelectedItemIds((prev) => {
      if (visibleItemIds.length === 0) return prev;
      if (allVisibleSelected) return new Set<string>();
      return new Set(visibleItemIds);
    });
  }, [visibleItemIds, allVisibleSelected]);

  const handleSelectChange = useCallback((itemId: string, selected: boolean) => {
    setSelectedItemIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(itemId);
      else next.delete(itemId);
      return next;
    });
  }, []);

  if (board.columns.length === 0) {
    return (
      <section className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-end border-b border-border px-6 py-5 bg-background/50">
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs text-slate-500">
            Table View
          </span>
        </div>
        <div className="p-10 text-center">
          <h3 className="text-sm font-bold text-foreground">This board has no columns yet</h3>
          <p className="mt-1 text-xs text-slate-400">
            Add at least an Item column (and optional Status/Person/Date) using the Columns button.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section ref={tableRef} className={`border border-border bg-card shadow-sm ${headerSlot ? 'flex flex-col h-full rounded-xl overflow-hidden' : seamlessTop ? 'rounded-b-xl border-t-0' : 'rounded-xl'}`}>
      {/* ── Sticky header: controls bar + column headers ── */}
      <div
        className={`${headerSlot ? '' : 'sticky z-20'} bg-card shadow-[0_1px_0_0_theme(colors.border)]`}
        style={headerSlot ? undefined : { top: stickyOffset !== undefined ? `${stickyOffset}px` : '-24px' }}
      >
      {headerSlot}

      {/* Column headers — scroll-synced with body */}
      <div ref={headerScrollRef} className="overflow-x-hidden">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleColumnDragEnd}
      >
        <SortableContext
          items={board.columns.map((c) => c.id)}
          strategy={horizontalListSortingStrategy}
        >
          {groupByColumnId && (
            <div className="flex items-center gap-2 px-6 py-2 bg-primary/5 border-b border-primary/10 text-xs text-primary">
              <span className="font-medium">
                Grouped by: {board.columns.find((c) => c.id === groupByColumnId)?.title}
              </span>
              <button
                type="button"
                className="ml-auto rounded-md border border-primary/20 px-2 py-0.5 text-[11px] hover:bg-primary/10 transition-colors"
                onClick={() => setGroupByColumnId(null)}
              >
                × Clear grouping
              </button>
            </div>
          )}
          <div
            className="hidden sm:flex items-stretch border-b border-border bg-background/30"
            style={{ minWidth: 'max-content', width: '100%' }}
          >
          <div
            className="grid gap-4 px-6 py-3 text-[11px] font-bold tracking-wider text-slate-400 flex-1"
            style={{ gridTemplateColumns: gridTemplate }}
          >
            {board.columns.map((column, index) => (
              <div key={column.id} className={`relative flex flex-col gap-2 min-w-0 ${collapsedColumnIds.has(column.id) ? 'overflow-hidden' : ''}`}>
                <div className="flex items-center gap-2">
                  {index === 0 && !collapsedColumnIds.has(column.id) && (
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleSelectAllVisible}
                      className="h-4 w-4 accent-primary"
                      aria-label="Select all visible items"
                      data-select-all
                    />
                  )}
                  {index === 0 && selectedItemIds.size > 0 && (
                    <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[10px] text-primary font-semibold leading-none">
                      {selectedItemIds.size} selected
                    </span>
                  )}
                  {index === 0 && savingCell && (
                    <span className="text-[10px] font-medium text-amber-500">Saving…</span>
                  )}
                  <SortableColumnHeader
                    column={column}
                    index={index}
                    sort={sort}
                    onSortChange={onSortChange}
                    isRenaming={renamingColumnId === column.id}
                    draftTitle={renamingColumnId === column.id ? columnTitleDraft : column.title}
                    onStartRename={() => {
                      setRenamingColumnId(column.id);
                      setColumnTitleDraft(column.title);
                    }}
                    onDraftTitleChange={setColumnTitleDraft}
                    onCommitRename={() => {
                      if (renamingColumnId !== column.id) return;
                      const next = columnTitleDraft.trim();
                      if (!next) {
                        setRenamingColumnId(null);
                        setColumnTitleDraft('');
                        return;
                      }
                      if (next === column.title) {
                        setRenamingColumnId(null);
                        setColumnTitleDraft('');
                        return;
                      }
                      updateColumn.mutate({ id: column.id, title: next });
                    }}
                    onCancelRename={() => {
                      setRenamingColumnId(null);
                      setColumnTitleDraft('');
                    }}
                    onDeleteColumn={() => {
                      if (index === 0) return;
                      if (window.confirm(`Delete column "${column.title}"? This cannot be undone.`)) {
                        deleteColumn.mutate({ id: column.id });
                      }
                    }}
                    disableDelete={index === 0}
                    onFilter={() => setShowFilters(true)}
                    onCollapse={index > 0 ? () => handleCollapseColumn(column.id) : undefined}
                    onGroupBy={() => handleGroupByColumn(column.id)}
                    onDuplicate={() => handleDuplicateColumn(column.id)}
                    onAddRight={() => handleAddColumnRight(column.id)}
                    onChangeType={(type) => handleChangeColumnType(column.id, type)}
                    isCollapsed={collapsedColumnIds.has(column.id)}
                    statusOptions={column.type === 'STATUS' ? (statusOptionsLookup.get(column.id) ?? []) : undefined}
                    onCreateStatusOption={(label, color) => handleCreateStatusOption(column.id, label, color)}
                    allColumns={board.columns}
                    onUpdateDateSettings={(settings) => {
                      updateColumn.mutate({ id: column.id, settings: { ...(column.settings as object), ...settings } });
                    }}
                  />
                </div>
                {!collapsedColumnIds.has(column.id) && showFilterControls && column.id === statusFilterColumn?.id && (
                  <CustomSelect
                    value={filters.status ?? ''}
                    options={statusFilterOptions.map((opt) => ({ value: opt.label, label: opt.label }))}
                    onChange={(val) => onFiltersChange({ ...filters, status: val || null })}
                    placeholder="All Statuses"
                  />
                )}
                {!collapsedColumnIds.has(column.id) && showFilterControls && column.id === personFilterColumn?.id && (
                  <CustomSelect
                    value={filters.person ?? ''}
                    options={memberOptions.map((m) => ({ value: m.id, label: m.name }))}
                    onChange={(val) => onFiltersChange({ ...filters, person: val || null })}
                    placeholder="All People"
                  />
                )}
                {!collapsedColumnIds.has(column.id) && showFilterControls && column.id === priorityFilterColumn?.id && (
                  <CustomSelect
                    value={filters.priority ?? ''}
                    options={priorityFilterOptions.map((opt) => ({ value: opt.label, label: opt.label }))}
                    onChange={(val) => onFiltersChange({ ...filters, priority: val || null })}
                    placeholder="All Priorities"
                  />
                )}
                {!collapsedColumnIds.has(column.id) && showFilterControls && column.id === dateFilterColumn?.id && (
                  <div className="flex items-center gap-1">
                    <CustomDateInput
                      value={filters.dueDateFrom ?? ''}
                      onChange={(val) => onFiltersChange({ ...filters, dueDateFrom: val || null })}
                      className="flex-1"
                    />
                    <CustomDateInput
                      value={filters.dueDateTo ?? ''}
                      onChange={(val) => onFiltersChange({ ...filters, dueDateTo: val || null })}
                      className="flex-1"
                    />
                  </div>
                )}
                {!collapsedColumnIds.has(column.id) && (
                  <div
                    className="absolute right-0 top-0 h-full w-1.5 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 select-none z-10"
                    onMouseDown={(e) => handleResizeStart(e, column.id)}
                  />
                )}
              </div>
            ))}
          </div>{/* end inner grid */}
          <button
            className="flex items-center justify-center w-10 flex-shrink-0 text-slate-400 hover:text-primary hover:bg-background/50 border-l border-border transition-colors"
            onClick={() => { if (!createColumn.isPending) createColumn.mutate({ boardId: board.id, title: 'New Column', type: 'TEXT' }); }}
            type="button"
            disabled={createColumn.isPending}
            title="Add column"
            aria-label="Add column"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          </div>{/* end outer flex row */}
        </SortableContext>
      </DndContext>
      </div>{/* end headerScrollRef */}
      </div>{/* end sticky header block */}

      {/* ── Scrollable body ── */}
      <div ref={bodyScrollRef} className={headerSlot ? "flex-1 overflow-x-auto overflow-y-auto" : "overflow-x-auto"} onScroll={syncBodyScroll}>
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
            {hasActiveFilters && totalFilteredItems === 0 && (
              <div className="p-12 text-center">
                <div className="mx-auto w-16 h-16 rounded-full bg-background flex items-center justify-center text-slate-300 mb-4">
                  <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h3 className="text-sm font-bold text-foreground">No items match your filters</h3>
                <p className="mt-1 text-xs text-slate-400">Try adjusting or clearing your filters.</p>
                <button
                  type="button"
                  className="mt-3 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/70 hover:bg-background transition-colors"
                  onClick={() => onFiltersChange({ status: null, person: null, priority: null, dueDateFrom: null, dueDateTo: null })}
                >
                  Clear filters
                </button>
              </div>
            )}
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
                  onSelectChange={handleSelectChange}
                  onCreateStatusOption={handleCreateStatusOption}
                  gridTemplate={gridTemplate}
                  collapsedColumnIds={collapsedColumnIds}
                  isVirtual={group.id.startsWith('virtual-')}
                />
              );
            })}
          </SortableContext>
        </DndContext>

        {/* ── New group skeleton ── */}
        {showCreateGroup ? (
          <div className="flex items-center gap-2 border-t border-border px-4 py-3 sm:px-6 bg-background/30">
            <div className="w-2 h-2 rounded-sm bg-border flex-shrink-0" />
            <input
              autoFocus
              aria-label="Group name"
              className="flex-1 bg-transparent text-sm text-foreground placeholder:text-slate-400 focus:outline-none"
              placeholder="Group name…"
              value={newGroupTitle}
              onChange={(e) => setNewGroupTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newGroupTitle.trim() && !createGroup.isPending) {
                  createGroup.mutate({ boardId: board.id, title: newGroupTitle.trim(), color: '#3B82F6' }, {
                    onSuccess: () => { setNewGroupTitle(''); setShowCreateGroup(false); },
                  });
                }
                if (e.key === 'Escape') { setNewGroupTitle(''); setShowCreateGroup(false); }
              }}
            />
            <button
              className="rounded-lg bg-primary px-3 py-1 text-[11px] font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              onClick={() => {
                if (!newGroupTitle.trim() || createGroup.isPending) return;
                createGroup.mutate({ boardId: board.id, title: newGroupTitle.trim(), color: '#3B82F6' }, {
                  onSuccess: () => { setNewGroupTitle(''); setShowCreateGroup(false); },
                });
              }}
              type="button"
              disabled={!newGroupTitle.trim() || createGroup.isPending}
            >
              {createGroup.isPending ? 'Creating…' : 'Create'}
            </button>
            <button
              className="rounded-lg border border-border px-3 py-1 text-[11px] text-slate-500 hover:text-foreground transition-colors"
              onClick={() => { setNewGroupTitle(''); setShowCreateGroup(false); }}
              type="button"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="flex w-full items-center gap-2 border-t border-border px-4 py-3 sm:px-6 text-sm text-slate-400 hover:text-foreground hover:bg-background/30 transition-colors"
            onClick={() => setShowCreateGroup(true)}
          >
            <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            <span>Add group</span>
          </button>
        )}

      </div>{/* end divide-y */}
      </div>{/* end bodyScrollRef */}

      {selectedItemId && (
        <ItemDetailPanel
          itemId={selectedItemId}
          onClose={() => setSelectedItemId(null)}
        />
      )}
    </section>
  );
}
