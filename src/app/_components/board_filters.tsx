'use client';

import { useMemo } from 'react';
import type { RouterOutputs } from '@/trpc/types';

type BoardData = NonNullable<RouterOutputs['boards']['getDefault']>;

type StatusOption = { label: string; color: string };

export type SortField = 'created' | 'dueDate' | 'priority' | 'title';
export type SortDir = 'asc' | 'desc';

export type BoardFilters = {
  status: string | null;
  person: string | null;
  priority: string | null;
  dueDateFrom: string | null;
  dueDateTo: string | null;
};

export type BoardSort = {
  field: SortField;
  dir: SortDir;
};

type BoardFiltersBarProps = {
  board: BoardData;
  filters: BoardFilters;
  sort: BoardSort;
  onChange: (filters: BoardFilters) => void;
  onSortChange: (sort: BoardSort) => void;
  memberOptions: { id: string; name: string }[];
};

const getStatusOptions = (settings: unknown): StatusOption[] => {
  if (!settings || typeof settings !== 'object') return [];
  const options = (settings as { options?: Record<string, string> }).options;
  if (!options || typeof options !== 'object') return [];
  return Object.entries(options).map(([label, color]) => ({
    label: label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
    color,
  }));
};

const getPriorityOptions = (board: BoardData): string[] => {
  const opts: string[] = [];
  const seen = new Set<string>();
  for (const col of board.columns) {
    if (col.type === 'STATUS' && col.title.toLowerCase().includes('priority')) {
      for (const opt of getStatusOptions(col.settings)) {
        if (!seen.has(opt.label)) {
          seen.add(opt.label);
          opts.push(opt.label);
        }
      }
    }
  }
  return opts;
};

export function BoardFiltersBar({ board, filters, sort, onChange, onSortChange, memberOptions }: BoardFiltersBarProps) {
  const allStatusOptions = useMemo(() => {
    const opts: StatusOption[] = [];
    const seen = new Set<string>();
    for (const col of board.columns) {
      if (col.type === 'STATUS' && !col.title.toLowerCase().includes('priority')) {
        for (const opt of getStatusOptions(col.settings)) {
          if (!seen.has(opt.label)) {
            seen.add(opt.label);
            opts.push(opt);
          }
        }
      }
    }
    return opts;
  }, [board.columns]);

  const priorityOptions = useMemo(() => getPriorityOptions(board), [board]);

  const hasActiveFilter = filters.status !== null || filters.person !== null || filters.priority !== null || filters.dueDateFrom !== null || filters.dueDateTo !== null;

  const selectClass = 'rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary';
  const dateClass = 'rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary';

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-semibold text-slate-400">
          <svg className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filter
        </span>

        <select
          className={selectClass}
          value={filters.status ?? ''}
          onChange={(e) => onChange({ ...filters, status: e.target.value || null })}
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {allStatusOptions.map((opt) => (
            <option key={opt.label} value={opt.label}>{opt.label}</option>
          ))}
        </select>

        <select
          className={selectClass}
          value={filters.person ?? ''}
          onChange={(e) => onChange({ ...filters, person: e.target.value || null })}
          aria-label="Filter by person"
        >
          <option value="">All People</option>
          {memberOptions.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>

        {priorityOptions.length > 0 && (
          <select
            className={selectClass}
            value={filters.priority ?? ''}
            onChange={(e) => onChange({ ...filters, priority: e.target.value || null })}
            aria-label="Filter by priority"
          >
            <option value="">All Priorities</option>
            {priorityOptions.map((p) => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>
        )}

        <div className="flex items-center gap-1">
          <label htmlFor="filter-due-from" className="text-[10px] text-slate-400">Due:</label>
          <input
            id="filter-due-from"
            type="date"
            className={dateClass}
            value={filters.dueDateFrom ?? ''}
            onChange={(e) => onChange({ ...filters, dueDateFrom: e.target.value || null })}
            aria-label="Due date from"
          />
          <span className="text-[10px] text-slate-400" aria-hidden="true">–</span>
          <input
            id="filter-due-to"
            type="date"
            className={dateClass}
            value={filters.dueDateTo ?? ''}
            onChange={(e) => onChange({ ...filters, dueDateTo: e.target.value || null })}
            aria-label="Due date to"
          />
        </div>

        {hasActiveFilter && (
          <button
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:text-foreground hover:border-slate-300 transition-colors"
            onClick={() => onChange({ status: null, person: null, priority: null, dueDateFrom: null, dueDateTo: null })}
            type="button"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-2 sm:ml-auto">
        <span className="text-xs font-semibold text-slate-400">
          <svg className="inline-block w-3.5 h-3.5 mr-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
          </svg>
          Sort
        </span>
        <select
          className={selectClass}
          value={sort.field}
          onChange={(e) => onSortChange({ ...sort, field: e.target.value as SortField })}
          aria-label="Sort by field"
        >
          <option value="created">Created date</option>
          <option value="dueDate">Due date</option>
          <option value="priority">Priority</option>
          <option value="title">Title</option>
        </select>
        <button
          className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs text-slate-500 hover:text-foreground hover:border-slate-300 transition-colors"
          onClick={() => onSortChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}
          type="button"
          title={sort.dir === 'asc' ? 'Ascending' : 'Descending'}
        >
          {sort.dir === 'asc' ? '↑ Asc' : '↓ Desc'}
        </button>
      </div>
    </div>
  );
}
