'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';

type ItemDetailPanelProps = {
  itemId: string;
  onClose: () => void;
};

/* ------------------------------------------------------------------ */
/*  Inline‑editable text field                                         */
/* ------------------------------------------------------------------ */
function InlineEdit({
  value,
  onSave,
  className,
  tag: Tag = 'span',
  placeholder = 'Click to edit',
}: {
  value: string;
  onSave: (v: string) => void;
  className?: string;
  tag?: 'span' | 'h2';
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  };

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
          if (e.key === 'Escape') { e.stopPropagation(); setDraft(value); setEditing(false); }
        }}
        className={`bg-transparent border-b border-primary outline-none ${className ?? ''}`}
      />
    );
  }

  return (
    <Tag
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-slate-100 rounded px-1 -mx-1 transition-colors ${className ?? ''}`}
      title="Click to edit"
    >
      {value || <span className="text-slate-400 italic">{placeholder}</span>}
    </Tag>
  );
}

/* ------------------------------------------------------------------ */
/*  Cell value editors per column type                                 */
/* ------------------------------------------------------------------ */
function StatusEditor({
  value,
  settings,
  onSave,
}: {
  value: { label?: string; color?: string } | null;
  settings: Record<string, string>;
  onSave: (v: { label: string; color: string } | null) => void;
}) {
  const options = Object.entries(settings).map(([label, color]) => ({ label, color }));

  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => {
        const isActive = value?.label === opt.label;
        return (
          <button
            key={opt.label}
            onClick={() => onSave(isActive ? null : { label: opt.label, color: opt.color })}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-all ${
              isActive
                ? 'ring-2 ring-slate-300 shadow-lg scale-105'
                : 'opacity-60 hover:opacity-100'
            }`}
            style={{ backgroundColor: opt.color, color: '#fff' }}
          >
            {opt.label.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        );
      })}
    </div>
  );
}

function PersonEditor({
  value,
  workspaceId,
  onSave,
}: {
  value: { userId?: string; name?: string } | null;
  workspaceId: string;
  onSave: (v: { userId: string; name: string } | null) => void;
}) {
  const { data: members } = trpc.workspaces.members.useQuery({ workspaceId });

  return (
    <select
      value={value?.userId ?? ''}
      onChange={(e) => {
        if (!e.target.value) return onSave(null);
        const m = members?.find((m) => m.user.id === e.target.value);
        if (m) onSave({ userId: m.user.id, name: m.user.name ?? m.user.email ?? 'Unknown' });
      }}
      className="bg-slate-50 border border-border rounded-lg px-3 py-2 text-sm text-foreground w-full focus:border-primary focus:outline-none"
    >
      <option value="">Unassigned</option>
      {members?.map((m) => (
        <option key={m.user.id} value={m.user.id}>
          {m.user.name ?? m.user.email ?? 'Unknown'}
        </option>
      ))}
    </select>
  );
}

/* ------------------------------------------------------------------ */
/*  Main panel                                                         */
/* ------------------------------------------------------------------ */
export function ItemDetailPanel({ itemId, onClose }: ItemDetailPanelProps) {
  const { data: item, isLoading } = trpc.items.getDetail.useQuery({ id: itemId });
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [newUpdate, setNewUpdate] = useState('');
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Escape key handler
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  // Click-outside handler
  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose],
  );

  const invalidateAll = useCallback(() => {
    void utils.items.getDetail.invalidate({ id: itemId });
    void utils.boards.getDefault.invalidate();
    void utils.boards.getById.invalidate();
  }, [utils, itemId]);

  const cloneItem = trpc.items.clone.useMutation({
    onSuccess: () => {
      invalidateAll();
      pushToast({ title: 'Item duplicated', tone: 'success' });
    },
    onError: () => pushToast({ title: 'Failed to duplicate item', tone: 'error' }),
  });

  const updateItem = trpc.items.update.useMutation({
    onSuccess: () => {
      invalidateAll();
      pushToast({ title: 'Updated', tone: 'success' });
    },
  });

  const updateCell = trpc.cells.update.useMutation({
    onSuccess: invalidateAll,
  });

  const createUpdate = trpc.items.createUpdate.useMutation({
    onSuccess: () => {
      setNewUpdate('');
      invalidateAll();
      pushToast({ title: 'Update posted', tone: 'success' });
    },
  });

  if (isLoading) {
    return (
      <div ref={overlayRef} onClick={handleOverlayClick} className="fixed inset-0 z-50 bg-black/20">
        <div className="fixed inset-y-0 right-0 w-full sm:w-[500px] border-l border-border bg-white p-6 shadow-2xl animate-pulse">
          <div className="h-8 w-48 bg-slate-100 rounded mb-4" />
          <div className="h-4 w-full bg-slate-100 rounded mb-8" />
          <div className="space-y-4">
            <div className="h-20 w-full bg-slate-100 rounded" />
            <div className="h-20 w-full bg-slate-100 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (!item) return null;

  const columns = item.group.board.columns;
  const workspaceId = item.group.board.workspaceId;

  // Build cell lookup: columnId → cellValue
  const cellMap = new Map(item.cellValues.map((cv) => [cv.columnId, cv]));

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 bg-black/20"
      data-testid="item-detail-overlay"
    >
      <div
        ref={panelRef}
        className="fixed inset-y-0 right-0 z-50 w-full sm:w-[500px] flex flex-col border-l border-border bg-white shadow-2xl animate-panel-slide-in"
        data-testid="item-detail-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-4">
          <InlineEdit
            tag="h2"
            value={item.name}
            onSave={(name) => updateItem.mutate({ id: item.id, name })}
            className="text-xl font-semibold text-foreground"
          />
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => {
                if (window.confirm(`Duplicate item "${item.name}"?`)) {
                  cloneItem.mutate({ id: item.id });
                }
              }}
              disabled={cloneItem.isPending}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-foreground transition-colors disabled:opacity-50"
              title="Duplicate item"
              type="button"
            >
              {cloneItem.isPending ? 'Duplicating…' : 'Duplicate'}
            </button>
            <button
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
              aria-label="Close panel"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Metadata */}
          <div className="flex gap-4 text-xs text-slate-400">
            <span>Created {new Date(item.createdAt).toLocaleDateString()}</span>
            <span>Updated {new Date(item.updatedAt).toLocaleDateString()}</span>
          </div>

          {/* Cell values by column */}
          <div className="space-y-5">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Fields</h3>
            {columns.map((col) => {
              const cell = cellMap.get(col.id);
              const rawValue = cell?.value ?? null;

              return (
                <div key={col.id} className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500">
                    {col.title}
                  </label>

                  {col.type === 'STATUS' && (
                    <StatusEditor
                      value={rawValue as { label?: string; color?: string } | null}
                      settings={((col.settings as { options?: Record<string, string> })?.options) ?? {}}
                      onSave={(v) => updateCell.mutate({ itemId: item.id, columnId: col.id, value: v })}
                    />
                  )}

                  {col.type === 'PERSON' && (
                    <PersonEditor
                      value={rawValue as { userId?: string; name?: string } | null}
                      workspaceId={workspaceId}
                      onSave={(v) => updateCell.mutate({ itemId: item.id, columnId: col.id, value: v })}
                    />
                  )}

                  {col.type === 'DATE' && (
                    <input
                      type="date"
                      value={typeof rawValue === 'string' ? rawValue.slice(0, 10) : ''}
                      onChange={(e) =>
                        updateCell.mutate({
                          itemId: item.id,
                          columnId: col.id,
                          value: e.target.value || null,
                        })
                      }
                      className="bg-slate-50 border border-border rounded-lg px-3 py-2 text-sm text-foreground w-full focus:border-primary focus:outline-none"
                    />
                  )}

                  {col.type === 'TEXT' && (
                    <InlineEdit
                      value={(rawValue as string) ?? ''}
                      onSave={(v) => updateCell.mutate({ itemId: item.id, columnId: col.id, value: v })}
                      className="text-sm text-foreground block w-full"
                      placeholder="Add text..."
                    />
                  )}

                  {col.type === 'NUMBER' && (
                    <input
                      type="number"
                      defaultValue={typeof rawValue === 'number' ? rawValue : ''}
                      onBlur={(e) => {
                        const num = e.target.value === '' ? null : Number(e.target.value);
                        updateCell.mutate({ itemId: item.id, columnId: col.id, value: num });
                      }}
                      className="bg-slate-50 border border-border rounded-lg px-3 py-2 text-sm text-foreground w-full focus:border-primary focus:outline-none"
                      placeholder="Enter number..."
                    />
                  )}

                  {col.type === 'LINK' && (
                    <InlineEdit
                      value={((rawValue as { url?: string })?.url) ?? ''}
                      onSave={(v) => updateCell.mutate({ itemId: item.id, columnId: col.id, value: { url: v } })}
                      className="text-sm text-primary underline block w-full"
                      placeholder="Add link..."
                    />
                  )}

                  {col.type === 'TIMELINE' && (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        defaultValue={((rawValue as { start?: string })?.start) ?? ''}
                        onBlur={(e) => {
                          const end = ((rawValue as { end?: string })?.end) ?? e.target.value;
                          updateCell.mutate({
                            itemId: item.id,
                            columnId: col.id,
                            value: { start: e.target.value, end },
                          });
                        }}
                        className="bg-slate-50 border border-border rounded-lg px-3 py-2 text-sm text-foreground flex-1 focus:border-primary focus:outline-none"
                      />
                      <input
                        type="date"
                        defaultValue={((rawValue as { end?: string })?.end) ?? ''}
                        onBlur={(e) => {
                          const start = ((rawValue as { start?: string })?.start) ?? e.target.value;
                          updateCell.mutate({
                            itemId: item.id,
                            columnId: col.id,
                            value: { start, end: e.target.value },
                          });
                        }}
                        className="bg-slate-50 border border-border rounded-lg px-3 py-2 text-sm text-foreground flex-1 focus:border-primary focus:outline-none"
                      />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Recurrence */}
          <RecurrenceSection itemId={itemId} item={item} />

          {/* Dependencies */}
          <DependenciesSection itemId={itemId} />

          {/* Attachments */}
          <AttachmentsSection itemId={itemId} />

          {/* Activity / Updates */}
          <div>
            <h3 className="mb-4 text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Activity &amp; Comments
            </h3>
            <div className="rounded-xl border border-border bg-slate-50 p-4 mb-6 focus-within:border-primary transition-colors">
              <textarea
                value={newUpdate}
                onChange={(e) => setNewUpdate(e.target.value)}
                placeholder="Write a comment..."
                className="w-full bg-transparent text-foreground placeholder:text-slate-400 focus:outline-none resize-none min-h-[80px]"
              />
              <div className="flex justify-end mt-2">
                <button
                  disabled={!newUpdate.trim() || createUpdate.isPending}
                  onClick={() => createUpdate.mutate({ itemId, content: newUpdate })}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-opacity"
                >
                  {createUpdate.isPending ? 'Posting...' : 'Post'}
                </button>
              </div>
            </div>

            <ActivityFeed itemId={itemId} updates={item.updates ?? []} />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Recurrence Section                                                 */
/* ------------------------------------------------------------------ */

const RECURRENCE_TYPES = [
  { value: 'daily', label: 'Daily', interval: 1 },
  { value: 'weekly', label: 'Weekly', interval: 1 },
  { value: 'biweekly', label: 'Every 2 weeks', interval: 1 },
  { value: 'monthly', label: 'Monthly', interval: 1 },
  { value: 'custom', label: 'Custom (days)', interval: 1 },
] as const;

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

type RecurrenceRule = {
  type: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'custom';
  interval: number;
  dayOfWeek?: number;
  dayOfMonth?: number;
};

function recurrenceToText(rule: RecurrenceRule): string {
  switch (rule.type) {
    case 'daily':
      return rule.interval === 1 ? 'Every day' : `Every ${rule.interval} days`;
    case 'weekly':
      return rule.dayOfWeek != null ? `Every ${DAY_NAMES[rule.dayOfWeek]}` : rule.interval === 1 ? 'Every week' : `Every ${rule.interval} weeks`;
    case 'biweekly':
      return rule.dayOfWeek != null ? `Every other ${DAY_NAMES[rule.dayOfWeek]}` : 'Every 2 weeks';
    case 'monthly':
      if (rule.dayOfMonth != null) {
        const suffix = rule.dayOfMonth === 1 ? 'st' : rule.dayOfMonth === 2 ? 'nd' : rule.dayOfMonth === 3 ? 'rd' : 'th';
        return rule.interval === 1 ? `Monthly on the ${rule.dayOfMonth}${suffix}` : `Every ${rule.interval} months on the ${rule.dayOfMonth}${suffix}`;
      }
      return rule.interval === 1 ? 'Every month' : `Every ${rule.interval} months`;
    case 'custom':
      return `Every ${rule.interval} days`;
    default:
      return 'Recurring';
  }
}

/* ------------------------------------------------------------------ */
/*  Dependencies Section                                               */
/* ------------------------------------------------------------------ */

const DEP_TYPE_LABELS: Record<string, string> = {
  BLOCKS: 'Blocks',
  BLOCKED_BY: 'Blocked by',
  RELATES_TO: 'Related to',
  DUPLICATES: 'Duplicates',
};

const DEP_TYPE_ICONS: Record<string, string> = {
  BLOCKS: '🚫',
  BLOCKED_BY: '⛔',
  RELATES_TO: '🔗',
  DUPLICATES: '📋',
};

function DependenciesSection({ itemId }: { itemId: string }) {
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [adding, setAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<'BLOCKS' | 'BLOCKED_BY' | 'RELATES_TO' | 'DUPLICATES'>('BLOCKS');
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data, isLoading } = trpc.dependencies.listByItem.useQuery({ itemId });
  const searchResults = trpc.search.query.useQuery(
    { q: searchQuery, limit: 10 },
    { enabled: searchQuery.length >= 1 },
  );

  const createDep = trpc.dependencies.create.useMutation({
    onSuccess: () => {
      void utils.dependencies.listByItem.invalidate({ itemId });
      void utils.boards.getDefault.invalidate();
      void utils.boards.getById.invalidate();
      pushToast({ title: 'Dependency added', tone: 'success' });
      setAdding(false);
      setSearchQuery('');
    },
    onError: (err) => pushToast({ title: err.message || 'Failed to add dependency', tone: 'error' }),
  });

  const deleteDep = trpc.dependencies.delete.useMutation({
    onSuccess: () => {
      void utils.dependencies.listByItem.invalidate({ itemId });
      void utils.boards.getDefault.invalidate();
      void utils.boards.getById.invalidate();
      pushToast({ title: 'Dependency removed', tone: 'success' });
    },
    onError: () => pushToast({ title: 'Failed to remove dependency', tone: 'error' }),
  });

  useEffect(() => {
    if (adding) searchInputRef.current?.focus();
  }, [adding]);

  // Group dependencies by type
  type DepEntry = { id: string; type: string; linkedItem: { id: string; name: string; boardTitle: string } };
  const grouped: Record<string, DepEntry[]> = {};

  if (data) {
    for (const d of data.asSource) {
      const type = d.type;
      if (!grouped[type]) grouped[type] = [];
      grouped[type].push({
        id: d.id,
        type,
        linkedItem: {
          id: d.targetItem.id,
          name: d.targetItem.name,
          boardTitle: d.targetItem.group.board.title,
        },
      });
    }
    // For asTarget, show the inverse type label
    for (const d of data.asTarget) {
      // If someone created A BLOCKS B, and we're looking at B, show "Blocked by A"
      const inverseType = d.type === 'BLOCKS' ? 'BLOCKED_BY' : d.type === 'BLOCKED_BY' ? 'BLOCKS' : d.type;
      if (!grouped[inverseType]) grouped[inverseType] = [];
      grouped[inverseType].push({
        id: d.id,
        type: inverseType,
        linkedItem: {
          id: d.sourceItem.id,
          name: d.sourceItem.name,
          boardTitle: d.sourceItem.group.board.title,
        },
      });
    }
  }

  const totalDeps = Object.values(grouped).reduce((sum, arr) => sum + arr.length, 0);

  const filteredResults = searchResults.data?.items.filter((i) => i.id !== itemId) ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Dependencies {totalDeps > 0 && <span className="text-slate-300">({totalDeps})</span>}
        </h3>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="text-xs font-medium text-primary hover:text-primary/80"
            type="button"
          >
            Add dependency
          </button>
        )}
      </div>

      {adding && (
        <div className="rounded-lg border border-primary/20 bg-slate-50 p-3 mb-3 space-y-2">
          <div className="flex gap-2">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as typeof selectedType)}
              className="rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-foreground focus:border-primary focus:outline-none"
            >
              {Object.entries(DEP_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setHighlightedIndex(-1); }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => Math.min(prev + 1, filteredResults.length - 1));
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault();
                  setHighlightedIndex((prev) => Math.max(prev - 1, 0));
                } else if (e.key === 'Enter' && highlightedIndex >= 0 && filteredResults[highlightedIndex]) {
                  e.preventDefault();
                  createDep.mutate({ sourceItemId: itemId, targetItemId: filteredResults[highlightedIndex].id, type: selectedType });
                } else if (e.key === 'Escape') {
                  setAdding(false); setSearchQuery('');
                }
              }}
              placeholder="Search items..."
              className="flex-1 rounded-lg border border-border bg-white px-3 py-1.5 text-sm text-foreground focus:border-primary focus:outline-none"
              role="combobox"
              aria-expanded={searchQuery.length >= 1}
              aria-activedescendant={highlightedIndex >= 0 ? `dep-search-result-${highlightedIndex}` : undefined}
              aria-controls="dep-search-results"
            />
            <button
              onClick={() => { setAdding(false); setSearchQuery(''); }}
              className="text-xs text-slate-400 hover:text-slate-600 px-2"
              type="button"
            >
              Cancel
            </button>
          </div>
          {searchQuery.length >= 1 && (
            <div id="dep-search-results" role="listbox" className="max-h-48 overflow-y-auto rounded-lg border border-border bg-white divide-y divide-border">
              {searchResults.isLoading && (
                <div className="px-3 py-2 text-xs text-slate-400">Searching...</div>
              )}
              {filteredResults.length === 0 && !searchResults.isLoading && (
                <div className="px-3 py-2 text-xs text-slate-400">No items found</div>
              )}
              {filteredResults.map((result, idx) => (
                <button
                  key={result.id}
                  id={`dep-search-result-${idx}`}
                  role="option"
                  aria-selected={highlightedIndex === idx}
                  onClick={() => createDep.mutate({ sourceItemId: itemId, targetItemId: result.id, type: selectedType })}
                  disabled={createDep.isPending}
                  className={`w-full text-left px-3 py-2 transition-colors disabled:opacity-50 ${highlightedIndex === idx ? 'bg-primary/10' : 'hover:bg-slate-50'}`}
                  type="button"
                >
                  <p className="text-sm font-medium text-foreground truncate">{result.name}</p>
                  <p className="text-[10px] text-slate-400">{result.group.board.title}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {isLoading && <div className="text-xs text-slate-400 italic">Loading...</div>}

      {totalDeps === 0 && !isLoading && !adding && (
        <div className="text-xs text-slate-400 italic">No dependencies</div>
      )}

      {Object.entries(grouped).map(([type, deps]) => (
        <div key={type} className="mb-2">
          <p className="text-[10px] font-semibold text-slate-400 uppercase mb-1">
            {DEP_TYPE_ICONS[type]} {DEP_TYPE_LABELS[type] ?? type}
          </p>
          <div className="space-y-1">
            {deps.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-slate-50 px-3 py-1.5 group"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground truncate">{dep.linkedItem.name}</p>
                  <p className="text-[10px] text-slate-400">{dep.linkedItem.boardTitle}</p>
                </div>
                <button
                  onClick={() => deleteDep.mutate({ id: dep.id })}
                  disabled={deleteDep.isPending}
                  className="text-xs text-rose-400 hover:text-rose-600 opacity-60 hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-50 flex-shrink-0 rounded focus:outline-none focus:ring-2 focus:ring-rose-300"
                  title="Remove dependency"
                  type="button"
                  aria-label={`Remove dependency ${dep.linkedItem.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function RecurrenceSection({ itemId, item }: { itemId: string; item: { recurrence?: unknown; nextDueDate?: string | Date | null; cellValues: { column: { type: string }; value: unknown }[] } }) {
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const [editing, setEditing] = useState(false);
  const [recType, setRecType] = useState<RecurrenceRule['type']>('weekly');
  const [interval, setInterval] = useState(1);
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [startDate, setStartDate] = useState('');

  const recurrence = item.recurrence as RecurrenceRule | null;

  const setRecurrence = trpc.items.setRecurrence.useMutation({
    onSuccess: () => {
      void utils.items.getDetail.invalidate({ id: itemId });
      void utils.boards.getDefault.invalidate();
      void utils.boards.getById.invalidate();
      pushToast({ title: recurrence ? 'Recurrence updated' : 'Recurrence set', tone: 'success' });
      setEditing(false);
    },
    onError: () => pushToast({ title: 'Failed to set recurrence', tone: 'error' }),
  });

  const handleSave = () => {
    const rule: RecurrenceRule = { type: recType, interval };
    if ((recType === 'weekly' || recType === 'biweekly') && dayOfWeek != null) {
      rule.dayOfWeek = dayOfWeek;
    }
    if (recType === 'monthly' && dayOfMonth != null) {
      rule.dayOfMonth = dayOfMonth;
    }
    setRecurrence.mutate({
      itemId,
      recurrence: rule,
      startDate: startDate || undefined,
    });
  };

  const handleRemove = () => {
    setRecurrence.mutate({ itemId, recurrence: null });
  };

  // Initialize form from existing recurrence
  const startEditing = () => {
    if (recurrence) {
      setRecType(recurrence.type);
      setInterval(recurrence.interval);
      if (recurrence.dayOfWeek != null) setDayOfWeek(recurrence.dayOfWeek);
      if (recurrence.dayOfMonth != null) setDayOfMonth(recurrence.dayOfMonth);
    }
    // Pre-fill start date from date cell
    const dateCell = item.cellValues.find((cv) => cv.column.type === 'DATE');
    if (dateCell?.value && typeof dateCell.value === 'string') {
      setStartDate(dateCell.value.slice(0, 10));
    }
    setEditing(true);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Repeat</h3>
        {!editing && (
          <button
            onClick={startEditing}
            className="text-xs font-medium text-primary hover:text-primary/80"
            type="button"
          >
            {recurrence ? 'Edit' : 'Set repeat'}
          </button>
        )}
      </div>

      {recurrence && !editing && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm">
          <span className="text-base" role="img" aria-label="Recurring">🔄</span>
          <span className="text-foreground font-medium">{recurrenceToText(recurrence)}</span>
          {item.nextDueDate && (
            <span className="text-xs text-slate-400 ml-auto">
              Next: {new Date(item.nextDueDate).toLocaleDateString()}
            </span>
          )}
        </div>
      )}

      {!recurrence && !editing && (
        <div className="text-xs text-slate-400 italic">No recurrence set</div>
      )}

      {editing && (
        <div className="space-y-3 rounded-lg border border-primary/20 bg-slate-50 p-3">
          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Frequency</label>
            <select
              value={recType}
              onChange={(e) => setRecType(e.target.value as RecurrenceRule['type'])}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            >
              {RECURRENCE_TYPES.map((rt) => (
                <option key={rt.value} value={rt.value}>{rt.label}</option>
              ))}
            </select>
          </div>

          {(recType === 'weekly' || recType === 'biweekly') && (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Day of week</label>
              <select
                value={dayOfWeek}
                onChange={(e) => setDayOfWeek(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {DAY_NAMES.map((d, i) => (
                  <option key={i} value={i}>{d}</option>
                ))}
              </select>
            </div>
          )}

          {recType === 'monthly' && (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Day of month</label>
              <select
                value={dayOfMonth}
                onChange={(e) => setDayOfMonth(Number(e.target.value))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              >
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>{d}{d === 1 ? 'st' : d === 2 ? 'nd' : d === 3 ? 'rd' : 'th'}</option>
                ))}
              </select>
            </div>
          )}

          {(recType === 'custom' || recType === 'daily') && (
            <div>
              <label className="text-xs font-medium text-slate-500 block mb-1">Every N days</label>
              <input
                type="number"
                min={1}
                value={interval}
                onChange={(e) => setInterval(Math.max(1, Number(e.target.value)))}
                className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
              />
            </div>
          )}

          <div>
            <label className="text-xs font-medium text-slate-500 block mb-1">Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-lg border border-border bg-white px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleSave}
              disabled={setRecurrence.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50"
              type="button"
            >
              {setRecurrence.isPending ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditing(false)}
              className="rounded-lg px-4 py-2 text-sm text-slate-400 hover:text-slate-600"
              type="button"
            >
              Cancel
            </button>
            {recurrence && (
              <button
                onClick={handleRemove}
                disabled={setRecurrence.isPending}
                className="rounded-lg px-4 py-2 text-sm text-rose-500 hover:text-rose-600 ml-auto"
                type="button"
              >
                Remove
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Attachments Section                                                */
/* ------------------------------------------------------------------ */

const FILE_ICONS: Record<string, string> = {
  'image/': '🖼️',
  'application/pdf': '📄',
  'application/msword': '📝',
  'application/vnd.openxmlformats-officedocument.wordprocessingml': '📝',
  'application/vnd.ms-excel': '📊',
  'application/vnd.openxmlformats-officedocument.spreadsheetml': '📊',
  'text/csv': '📊',
};

function getFileIcon(fileType: string): string {
  for (const [prefix, icon] of Object.entries(FILE_ICONS)) {
    if (fileType.startsWith(prefix)) return icon;
  }
  return '📎';
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

function AttachmentsSection({ itemId }: { itemId: string }) {
  const { data: attachments = [], isLoading } = trpc.attachments.list.useQuery({ itemId });
  const utils = trpc.useUtils();
  const { pushToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const attachBtnRef = useRef<HTMLButtonElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  const invalidateAttachments = useCallback(() => {
    void utils.attachments.list.invalidate({ itemId });
    void utils.boards.getDefault.invalidate();
    void utils.boards.getById.invalidate();
  }, [utils, itemId]);

  const createAttachment = trpc.attachments.create.useMutation({
    onSuccess: () => {
      invalidateAttachments();
      pushToast({ title: 'File attached', tone: 'success' });
      // F13: return focus to attach button after upload
      attachBtnRef.current?.focus();
    },
  });

  const deleteAttachment = trpc.attachments.delete.useMutation({
    onSuccess: () => {
      invalidateAttachments();
      pushToast({ title: 'Attachment deleted', tone: 'success' });
      attachBtnRef.current?.focus();
    },
  });

  const uploadFile = useCallback(async (file: File) => {
    // F9: client-side size validation
    if (file.size > MAX_FILE_SIZE) {
      pushToast({ title: `File too large (${formatFileSize(file.size)}). Max 10 MB.`, tone: 'error' });
      return;
    }

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: formData });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        // F1: toast instead of alert()
        pushToast({ title: err.error ?? 'Upload failed', tone: 'error' });
        return;
      }
      const data = (await res.json()) as { fileName: string; fileType: string; fileSize: number; url: string };
      await createAttachment.mutateAsync({
        itemId,
        fileName: data.fileName,
        fileType: data.fileType,
        fileSize: data.fileSize,
        url: data.url,
      });
    } catch {
      // F1: toast instead of alert()
      pushToast({ title: 'Upload failed', tone: 'error' });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, [itemId, createAttachment, pushToast]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    // F7: support multiple files
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
  };

  // F5: drag-and-drop handlers
  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragOver(true); };
  const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setDragOver(false); };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    for (const file of Array.from(files)) {
      await uploadFile(file);
    }
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`rounded-lg transition-colors ${dragOver ? 'ring-2 ring-primary ring-dashed bg-primary/5' : ''}`}
      role="region"
      aria-label="Attachments"
    >
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Attachments {attachments.length > 0 && `(${attachments.length})`}
        </h3>
        <button
          ref={attachBtnRef}
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="text-xs font-medium text-primary hover:text-primary/80 disabled:opacity-50 inline-flex items-center gap-1.5"
          type="button"
          aria-label="Attach file"
        >
          {uploading ? (
            <>
              {/* F4: spinner during upload */}
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Uploading…
            </>
          ) : (
            'Attach file'
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv"
          aria-label="Choose files to attach"
        />
      </div>

      {/* F9: hint about limits */}
      <p className="text-[10px] text-slate-400 mb-2">Max 10 MB · Images, PDFs, documents</p>

      {isLoading ? (
        <div className="h-8 bg-slate-100 rounded animate-pulse" />
      ) : attachments.length === 0 ? (
        <div className="border-2 border-dashed border-slate-200 rounded-lg py-6 text-center text-xs text-slate-400">
          Drop files here or click &ldquo;Attach file&rdquo;
        </div>
      ) : (
        <div className="space-y-2" role="list" aria-label="Attachment list">
          {attachments.map((att) => {
            const isImage = att.fileType.startsWith('image/');
            return (
              <div
                key={att.id}
                className="flex items-center gap-3 rounded-lg border border-border bg-slate-50 px-3 py-2"
                role="listitem"
              >
                {/* F6: image thumbnail or emoji icon */}
                {isImage ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img
                    src={att.url}
                    alt={`Preview of ${att.fileName}`}
                    className="h-10 w-10 rounded object-cover flex-shrink-0"
                  />
                ) : (
                  <span className="text-lg flex-shrink-0" role="img" aria-label={`${att.fileType} file`}>
                    {getFileIcon(att.fileType)}
                  </span>
                )}
                <div className="flex-1 min-w-0">
                  {/* F3: use download attribute only, add download icon */}
                  <a
                    href={att.url}
                    download={att.fileName}
                    className="text-sm font-medium text-primary hover:underline truncate block inline-flex items-center gap-1"
                    aria-label={`Download ${att.fileName}`}
                  >
                    {att.fileName}
                    <svg className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
                    </svg>
                  </a>
                  <p className="text-[10px] text-slate-400">
                    {formatFileSize(att.fileSize)} · {new Date(att.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {/* F2: aria-label on delete button */}
                <button
                  onClick={() => {
                    if (window.confirm(`Delete "${att.fileName}"?`)) {
                      deleteAttachment.mutate({ id: att.id });
                    }
                  }}
                  className="text-xs text-rose-500 hover:text-rose-600 flex-shrink-0"
                  type="button"
                  aria-label={`Delete attachment ${att.fileName}`}
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Combined Activity Feed (comments + changes)                        */
/* ------------------------------------------------------------------ */

const ACTIVITY_ICONS: Record<string, string> = {
  COMMENT: '💬',
  STATUS_CHANGE: '🔄',
  ASSIGNMENT: '👤',
  FIELD_EDIT: '✏️',
};

type UpdateEntry = {
  id: string;
  content: string;
  createdAt: string | Date;
  user: { id: string; name: string | null; image: string | null };
};

function ActivityFeed({ itemId, updates }: { itemId: string; updates: UpdateEntry[] }) {
  const { data: activityLogs = [] } = trpc.items.getActivity.useQuery({ itemId });

  // Merge comments and activity logs into a single timeline
  type TimelineEntry = {
    id: string;
    kind: 'comment' | 'activity';
    type?: string;
    userName: string;
    timestamp: Date;
    content?: string;
    field?: string | null;
    oldValue?: unknown;
    newValue?: unknown;
  };

  const timeline: TimelineEntry[] = [
    ...updates.map((u) => ({
      id: `update-${u.id}`,
      kind: 'comment' as const,
      userName: u.user.name ?? 'Unknown',
      timestamp: new Date(u.createdAt),
      content: u.content,
    })),
    ...activityLogs
      .filter((a) => a.type !== 'COMMENT') // Comments are already shown via updates
      .map((a) => ({
        id: `activity-${a.id}`,
        kind: 'activity' as const,
        type: a.type,
        userName: a.user.name ?? 'Unknown',
        timestamp: new Date(a.createdAt),
        field: a.field,
        oldValue: a.oldValue,
        newValue: a.newValue,
      })),
  ].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

  if (timeline.length === 0) {
    return (
      <div className="text-center py-8 text-slate-400">
        <p className="text-sm">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {timeline.map((entry) => (
        <div key={entry.id} className="flex items-start gap-3">
          <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs">
            {entry.kind === 'comment' ? '💬' : ACTIVITY_ICONS[entry.type ?? ''] ?? '📝'}
          </div>
          <div className="flex-1 min-w-0">
            {entry.kind === 'comment' ? (
              <div className="rounded-xl border border-border bg-slate-50 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-foreground">{entry.userName}</span>
                  <span className="text-[10px] text-slate-400">
                    {entry.timestamp.toLocaleString()}
                  </span>
                </div>
                <p className="text-sm text-slate-600 whitespace-pre-wrap leading-relaxed">
                  {entry.content}
                </p>
              </div>
            ) : (
              <div className="py-1">
                <p className="text-xs text-slate-500">
                  <span className="font-medium text-foreground">{entry.userName}</span>
                  {' '}
                  {formatActivityMessage(entry)}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {entry.timestamp.toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function formatActivityMessage(entry: {
  type?: string;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
}): string {
  switch (entry.type) {
    case 'STATUS_CHANGE': {
      const oldLabel = (entry.oldValue as { label?: string } | null)?.label ?? 'None';
      const newLabel = (entry.newValue as { label?: string } | null)?.label ?? 'None';
      return `changed status from "${oldLabel}" to "${newLabel}"`;
    }
    case 'ASSIGNMENT': {
      const oldName = (entry.oldValue as { name?: string } | null)?.name;
      const newName = (entry.newValue as { name?: string } | null)?.name;
      if (!oldName && newName) return `assigned ${newName}`;
      if (oldName && !newName) return `unassigned ${oldName}`;
      return `changed assignment from ${oldName} to ${newName}`;
    }
    case 'FIELD_EDIT':
      return `updated ${entry.field ?? 'a field'}`;
    default:
      return 'made a change';
  }
}
