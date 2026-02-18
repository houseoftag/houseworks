'use client';

import { useMemo, useState, useCallback, useRef, useEffect } from 'react';
import { trpc } from '@/trpc/react';
import type { RouterOutputs } from '@/trpc/types';
import type { BoardFilters, BoardSort } from './board_filters';
import { filterAndSortItems } from './board_filter_utils';
import { useToast } from './toast_provider';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;
type ZoomLevel = 'day' | 'week' | 'month';

/* ------------------------------------------------------------------ */
/*  Date helpers                                                       */
/* ------------------------------------------------------------------ */

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function formatDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function formatHeader(d: Date, zoom: ZoomLevel): string {
  if (zoom === 'day') {
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }
  if (zoom === 'week') {
    const end = addDays(d, 6);
    return `${d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { day: 'numeric' })}`;
  }
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

function getColumnWidth(zoom: ZoomLevel): number {
  switch (zoom) {
    case 'day': return 40;
    case 'week': return 120;
    case 'month': return 180;
  }
}

function getStepDays(zoom: ZoomLevel): number {
  switch (zoom) {
    case 'day': return 1;
    case 'week': return 7;
    case 'month': return 30;
  }
}

/* ------------------------------------------------------------------ */
/*  Extract start/due dates from cell values                           */
/* ------------------------------------------------------------------ */

type TimelineItem = {
  id: string;
  name: string;
  groupId: string;
  groupTitle: string;
  groupColor: string;
  startDate: Date | null;
  dueDate: Date | null;
  startColumnId: string | null;
  dueColumnId: string | null;
};

function extractTimelineItems(board: BoardData, filters: BoardFilters, sort: BoardSort): TimelineItem[] {
  const columns = board.columns ?? [];

  // Find date columns - look for ones named start/due or use first two DATE columns
  const dateColumns = columns.filter((c) => c.type === 'DATE');
  let startCol: typeof columns[number] | undefined;
  let dueCol: typeof columns[number] | undefined;

  for (const col of dateColumns) {
    const lower = col.title.toLowerCase();
    if (lower.includes('start')) startCol = col;
    else if (lower.includes('due') || lower.includes('end') || lower.includes('deadline')) dueCol = col;
  }

  // Fallback: if only one date col, use it as due date
  if (!startCol && !dueCol && dateColumns.length >= 2) {
    startCol = dateColumns[0];
    dueCol = dateColumns[1];
  } else if (!startCol && !dueCol && dateColumns.length === 1) {
    dueCol = dateColumns[0];
  }

  // Also check TIMELINE column type
  const timelineCol = columns.find((c) => c.type === 'TIMELINE');

  const items: TimelineItem[] = [];

  for (const group of board.groups ?? []) {
    const filtered = filterAndSortItems(group.items, filters, sort, columns);
    for (const item of filtered) {
      let startDate: Date | null = null;
      let dueDate: Date | null = null;
      let startColumnId: string | null = null;
      let dueColumnId: string | null = null;

      // Check timeline column first (stores {start, end})
      if (timelineCol) {
        const cell = item.cellValues?.find((cv: { columnId: string }) => cv.columnId === timelineCol.id);
        if (cell?.value) {
          const val = cell.value as { start?: string; end?: string };
          if (val.start) startDate = new Date(val.start);
          if (val.end) dueDate = new Date(val.end);
          startColumnId = timelineCol.id;
          dueColumnId = timelineCol.id;
        }
      }

      // Fall back to individual date columns
      if (!startDate && startCol) {
        const cell = item.cellValues?.find((cv: { columnId: string }) => cv.columnId === startCol!.id);
        if (cell?.value) {
          const v = typeof cell.value === 'string' ? cell.value : (cell.value as { value?: string })?.value;
          if (v) { startDate = new Date(v); startColumnId = startCol.id; }
        }
      }
      if (!dueDate && dueCol) {
        const cell = item.cellValues?.find((cv: { columnId: string }) => cv.columnId === dueCol!.id);
        if (cell?.value) {
          const v = typeof cell.value === 'string' ? cell.value : (cell.value as { value?: string })?.value;
          if (v) { dueDate = new Date(v); dueColumnId = dueCol.id; }
        }
      }

      items.push({
        id: item.id,
        name: item.name,
        groupId: group.id,
        groupTitle: group.title,
        groupColor: group.color,
        startDate,
        dueDate,
        startColumnId,
        dueColumnId,
      });
    }
  }

  return items;
}

/* ------------------------------------------------------------------ */
/*  Dependency arrows (SVG)                                            */
/* ------------------------------------------------------------------ */

function DependencyArrows({
  dependencies,
  itemPositions,
}: {
  dependencies: { sourceItemId: string; targetItemId: string; type: string }[];
  itemPositions: Map<string, { x: number; y: number; width: number; row: number }>;
}) {
  const paths: JSX.Element[] = [];

  for (const dep of dependencies) {
    const src = itemPositions.get(dep.sourceItemId);
    const tgt = itemPositions.get(dep.targetItemId);
    if (!src || !tgt) continue;

    const startX = src.x + src.width;
    const startY = src.y + 16;
    const endX = tgt.x;
    const endY = tgt.y + 16;
    const midX = (startX + endX) / 2;

    paths.push(
      <g key={dep.sourceItemId + '-' + dep.targetItemId}>
        <path
          d={`M${startX},${startY} C${midX},${startY} ${midX},${endY} ${endX},${endY}`}
          fill="none"
          stroke="#6366f1"
          strokeWidth={1.5}
          strokeDasharray="4 2"
          opacity={0.6}
        />
        {/* Arrow head */}
        <polygon
          points={`${endX},${endY} ${endX - 6},${endY - 4} ${endX - 6},${endY + 4}`}
          fill="#6366f1"
          opacity={0.6}
        />
      </g>,
    );
  }

  return <>{paths}</>;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

export function BoardTimeline({
  board,
  filters,
  sort,
}: {
  board: BoardData;
  filters: BoardFilters;
  sort: BoardSort;
}) {
  const { pushToast } = useToast();
  const utils = trpc.useUtils();
  const [zoom, setZoom] = useState<ZoomLevel>('week');
  const scrollRef = useRef<HTMLDivElement>(null);

  const updateCell = trpc.cells.update.useMutation({
    onSuccess: async () => {
      await utils.boards.getDefault.invalidate();
      await utils.boards.getById.invalidate();
    },
    onError: () => {
      pushToast({ title: 'Failed to update date', tone: 'error' });
    },
  });

  const { data: dependencies } = trpc.dependencies.listByBoard.useQuery(
    { boardId: board.id },
  );

  const items = useMemo(() => extractTimelineItems(board, filters, sort), [board, filters, sort]);

  // Compute date range
  const { rangeStart, rangeEnd, totalDays } = useMemo(() => {
    const today = startOfDay(new Date());
    let min = addDays(today, -14);
    let max = addDays(today, 60);

    for (const item of items) {
      if (item.startDate && item.startDate < min) min = addDays(item.startDate, -7);
      if (item.dueDate && item.dueDate > max) max = addDays(item.dueDate, 7);
    }

    return {
      rangeStart: startOfDay(min),
      rangeEnd: startOfDay(max),
      totalDays: diffDays(max, min) + 1,
    };
  }, [items]);

  const colWidth = getColumnWidth(zoom);
  const stepDays = getStepDays(zoom);
  const totalWidth = Math.ceil(totalDays / stepDays) * colWidth;
  const rowHeight = 40;
  const headerHeight = 48;
  const labelWidth = 220;

  // Column headers
  const headers = useMemo(() => {
    const result: { date: Date; label: string; x: number; width: number }[] = [];
    let current = new Date(rangeStart);
    let x = 0;
    while (current <= rangeEnd) {
      result.push({
        date: new Date(current),
        label: formatHeader(current, zoom),
        x,
        width: colWidth,
      });
      current = addDays(current, stepDays);
      x += colWidth;
    }
    return result;
  }, [rangeStart, rangeEnd, zoom, colWidth, stepDays]);

  // Group items by group
  const groups = useMemo(() => {
    const map = new Map<string, { title: string; color: string; items: TimelineItem[] }>();
    for (const item of items) {
      let g = map.get(item.groupId);
      if (!g) {
        g = { title: item.groupTitle, color: item.groupColor, items: [] };
        map.set(item.groupId, g);
      }
      g.items.push(item);
    }
    return Array.from(map.values());
  }, [items]);

  // Flatten for row indexing
  const flatRows = useMemo(() => {
    const rows: { type: 'group'; title: string; color: string }[] | { type: 'item'; item: TimelineItem }[] = [];
    const result: ({ type: 'group'; title: string; color: string } | { type: 'item'; item: TimelineItem })[] = [];
    for (const g of groups) {
      result.push({ type: 'group', title: g.title, color: g.color });
      for (const item of g.items) {
        result.push({ type: 'item', item });
      }
    }
    return result;
  }, [groups]);

  // Today marker position
  const today = startOfDay(new Date());
  const todayX = diffDays(today, rangeStart) * (colWidth / stepDays);

  // Scroll to today on mount
  useEffect(() => {
    if (scrollRef.current) {
      const scrollTo = todayX - scrollRef.current.clientWidth / 3;
      scrollRef.current.scrollLeft = Math.max(0, scrollTo);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Item positions for dependency arrows
  const itemPositions = useMemo(() => {
    const map = new Map<string, { x: number; y: number; width: number; row: number }>();
    let rowIdx = 0;
    for (const row of flatRows) {
      if (row.type === 'group') {
        rowIdx++;
        continue;
      }
      const item = row.item;
      const sd = item.startDate ?? item.dueDate;
      const ed = item.dueDate ?? item.startDate;
      if (sd && ed) {
        const x = diffDays(startOfDay(sd), rangeStart) * (colWidth / stepDays);
        const w = Math.max((diffDays(startOfDay(ed), startOfDay(sd)) + 1) * (colWidth / stepDays), colWidth / stepDays);
        const y = headerHeight + rowIdx * rowHeight;
        map.set(item.id, { x, y, width: w, row: rowIdx });
      }
      rowIdx++;
    }
    return map;
  }, [flatRows, rangeStart, colWidth, stepDays]);

  // Drag state
  const [dragging, setDragging] = useState<{
    itemId: string;
    mode: 'move' | 'resize-start' | 'resize-end';
    initialMouseX: number;
    initialStart: Date;
    initialEnd: Date;
    startColumnId: string | null;
    dueColumnId: string | null;
  } | null>(null);

  const [dragOffset, setDragOffset] = useState(0);

  const handleMouseDown = useCallback(
    (
      e: React.MouseEvent,
      item: TimelineItem,
      mode: 'move' | 'resize-start' | 'resize-end',
    ) => {
      e.preventDefault();
      const sd = item.startDate ?? item.dueDate ?? today;
      const ed = item.dueDate ?? item.startDate ?? today;
      setDragging({
        itemId: item.id,
        mode,
        initialMouseX: e.clientX,
        initialStart: startOfDay(sd),
        initialEnd: startOfDay(ed),
        startColumnId: item.startColumnId,
        dueColumnId: item.dueColumnId,
      });
      setDragOffset(0);
    },
    [today],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - dragging.initialMouseX;
      setDragOffset(dx);
    },
    [dragging],
  );

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;

    const pixelsPerDay = colWidth / stepDays;
    const daysDelta = Math.round(dragOffset / pixelsPerDay);

    if (daysDelta !== 0) {
      const { mode, initialStart, initialEnd, startColumnId, dueColumnId } = dragging;

      if (mode === 'move' || mode === 'resize-start') {
        const newStart = addDays(initialStart, mode === 'resize-end' ? 0 : daysDelta);
        if (startColumnId) {
          updateCell.mutate({
            itemId: dragging.itemId,
            columnId: startColumnId,
            value: formatDate(newStart),
          });
        }
      }

      if (mode === 'move' || mode === 'resize-end') {
        const newEnd = addDays(initialEnd, mode === 'resize-start' ? 0 : daysDelta);
        if (dueColumnId) {
          updateCell.mutate({
            itemId: dragging.itemId,
            columnId: dueColumnId,
            value: formatDate(newEnd),
          });
        }
      }
    }

    setDragging(null);
    setDragOffset(0);
  }, [dragging, dragOffset, colWidth, stepDays, updateCell]);

  const contentHeight = headerHeight + flatRows.length * rowHeight + 20;

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-2">
        <h3 className="text-sm font-semibold text-foreground">Timeline</h3>
        <div className="flex items-center gap-1">
          {(['day', 'week', 'month'] as ZoomLevel[]).map((z) => (
            <button
              key={z}
              className={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                zoom === z
                  ? 'bg-primary text-white'
                  : 'text-slate-500 hover:text-foreground hover:bg-slate-100'
              }`}
              onClick={() => setZoom(z)}
              type="button"
            >
              {z.charAt(0).toUpperCase() + z.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Timeline body */}
      <div className="flex">
        {/* Label column */}
        <div
          className="shrink-0 border-r border-border bg-slate-50/50"
          style={{ width: labelWidth }}
        >
          <div
            className="flex items-center border-b border-border px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider"
            style={{ height: headerHeight }}
          >
            Item
          </div>
          {flatRows.map((row, i) =>
            row.type === 'group' ? (
              <div
                key={`g-${i}`}
                className="flex items-center gap-2 px-3 text-xs font-bold text-foreground"
                style={{ height: rowHeight }}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: row.color }}
                />
                {row.title}
              </div>
            ) : (
              <div
                key={row.item.id}
                className="flex items-center px-3 pl-7 text-xs text-slate-600 truncate"
                style={{ height: rowHeight }}
                title={row.item.name}
              >
                {row.item.name}
              </div>
            ),
          )}
        </div>

        {/* Scrollable timeline */}
        <div
          ref={scrollRef}
          className="overflow-x-auto flex-1"
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <div style={{ width: totalWidth, height: contentHeight, position: 'relative' }}>
            {/* Header columns */}
            <div className="flex border-b border-border" style={{ height: headerHeight }}>
              {headers.map((h, i) => (
                <div
                  key={i}
                  className="shrink-0 flex items-center justify-center text-[10px] font-medium text-slate-400 border-r border-border/50"
                  style={{ width: h.width }}
                >
                  {h.label}
                </div>
              ))}
            </div>

            {/* Grid lines */}
            <svg
              className="absolute top-0 left-0 pointer-events-none"
              width={totalWidth}
              height={contentHeight}
            >
              {/* Vertical grid lines */}
              {headers.map((h, i) => (
                <line
                  key={i}
                  x1={h.x}
                  y1={headerHeight}
                  x2={h.x}
                  y2={contentHeight}
                  stroke="#e2e8f0"
                  strokeWidth={0.5}
                />
              ))}

              {/* Today marker */}
              <line
                x1={todayX}
                y1={0}
                x2={todayX}
                y2={contentHeight}
                stroke="#ef4444"
                strokeWidth={2}
                opacity={0.7}
              />
              <text
                x={todayX + 4}
                y={headerHeight - 8}
                fill="#ef4444"
                fontSize={10}
                fontWeight={600}
              >
                Today
              </text>

              {/* Dependency arrows */}
              {dependencies && (
                <DependencyArrows
                  dependencies={dependencies}
                  itemPositions={itemPositions}
                />
              )}
            </svg>

            {/* Item bars */}
            {flatRows.map((row, rowIdx) => {
              if (row.type !== 'item') return null;
              const item = row.item;
              const sd = item.startDate ?? item.dueDate;
              const ed = item.dueDate ?? item.startDate;
              if (!sd || !ed) {
                // No dates - show placeholder
                return (
                  <div
                    key={item.id}
                    className="absolute flex items-center text-[10px] text-slate-400 italic"
                    style={{
                      top: headerHeight + rowIdx * rowHeight + 10,
                      left: todayX + 8,
                      height: rowHeight - 20,
                    }}
                  >
                    No dates set
                  </div>
                );
              }

              const pixelsPerDay = colWidth / stepDays;
              let barStart = diffDays(startOfDay(sd), rangeStart) * pixelsPerDay;
              let barEnd = (diffDays(startOfDay(ed), rangeStart) + 1) * pixelsPerDay;

              // Apply drag offset
              if (dragging?.itemId === item.id) {
                if (dragging.mode === 'move') {
                  barStart += dragOffset;
                  barEnd += dragOffset;
                } else if (dragging.mode === 'resize-start') {
                  barStart += dragOffset;
                } else if (dragging.mode === 'resize-end') {
                  barEnd += dragOffset;
                }
              }

              const barWidth = Math.max(barEnd - barStart, 6);
              const y = headerHeight + rowIdx * rowHeight + 8;

              return (
                <div
                  key={item.id}
                  className="absolute group"
                  style={{
                    left: barStart,
                    top: y,
                    width: barWidth,
                    height: rowHeight - 16,
                  }}
                >
                  {/* Resize handle left */}
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-black/10 rounded-l-md"
                    onMouseDown={(e) => handleMouseDown(e, item, 'resize-start')}
                  />
                  {/* Main bar */}
                  <div
                    className="absolute inset-0 rounded-md cursor-grab active:cursor-grabbing transition-shadow hover:shadow-md flex items-center px-2 text-[10px] font-medium text-white truncate select-none"
                    style={{
                      backgroundColor: item.groupColor + 'cc',
                      borderLeft: `3px solid ${item.groupColor}`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, item, 'move')}
                    title={`${item.name}\n${formatDate(sd)} → ${formatDate(ed)}`}
                  >
                    {barWidth > 60 ? item.name : ''}
                  </div>
                  {/* Resize handle right */}
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize z-10 hover:bg-black/10 rounded-r-md"
                    onMouseDown={(e) => handleMouseDown(e, item, 'resize-end')}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
