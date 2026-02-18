'use client';

import { useState, useEffect, useRef, useCallback, useId } from 'react';
import { trpc } from '@/trpc/react';

interface SearchCommandProps {
  onSelectItem?: (itemId: string, boardId: string) => void;
  onSelectBoard?: (boardId: string) => void;
}

/** Simple debounce hook */
function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export function SearchCommand({ onSelectItem, onSelectBoard }: SearchCommandProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const { data, isFetching, isError } = trpc.search.query.useQuery(
    { q: debouncedQuery, limit: 15 },
    {
      enabled: debouncedQuery.length >= 1,
      keepPreviousData: true,
    },
  );

  const allResults = [
    ...(data?.boards?.map((b) => ({ type: 'board' as const, ...b })) ?? []),
    ...(data?.items?.map((i) => ({ type: 'item' as const, ...i })) ?? []),
  ];

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            setQuery('');
            setSelectedIndex(0);
          }
          return !prev;
        });
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Focus input when opened
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
    prevOpenRef.current = open;
  }, [open]);

  // Focus trap: keep Tab cycling within the dialog
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handler = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'input, button, [tabindex]:not([tabindex="-1"])',
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  // Clamp selected index to results length
  const clampedIndex = allResults.length > 0 ? Math.min(selectedIndex, allResults.length - 1) : 0;

  const resultId = (idx: number) => `${listboxId}-option-${idx}`;

  const handleSelect = useCallback(
    (result: (typeof allResults)[number]) => {
      setOpen(false);
      if (result.type === 'board') {
        onSelectBoard?.(result.id);
      } else {
        onSelectItem?.(result.id, result.group.board.id);
      }
    },
    [onSelectBoard, onSelectItem],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, allResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && allResults[clampedIndex]) {
      e.preventDefault();
      handleSelect(allResults[clampedIndex]);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setQuery(''); setSelectedIndex(0); setOpen(true); }}
        className="flex items-center gap-2 rounded-md border border-border bg-white px-3 py-1.5 text-xs text-slate-400 shadow-sm transition hover:border-slate-300 hover:text-slate-500"
        aria-label="Search"
      >
        <svg
          className="h-3.5 w-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" strokeLinecap="round" />
        </svg>
        <span className="hidden sm:inline">Search…</span>
        <kbd className="hidden rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:inline">
          ⌘K
        </kbd>
      </button>
    );
  }

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={() => setOpen(false)}
        aria-hidden="true"
      />

      {/* Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        className="fixed left-1/2 top-[15%] z-50 w-[90vw] max-w-lg -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-white shadow-2xl"
      >
        {/* Search input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <svg
            className="h-4 w-4 shrink-0 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            strokeWidth={2}
          >
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            placeholder="Search items, boards…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-slate-400"
            aria-label="Search query"
            role="combobox"
            aria-expanded={allResults.length > 0}
            aria-controls={listboxId}
            aria-activedescendant={allResults.length > 0 ? resultId(clampedIndex) : undefined}
            aria-autocomplete="list"
          />
          {isFetching && (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-primary" />
          )}
          <kbd
            className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 cursor-pointer"
            onClick={() => setOpen(false)}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div className="max-h-[60vh] overflow-y-auto p-2" role="listbox" id={listboxId}>
          {query.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-slate-400">
              Type to search across all your items and boards
            </div>
          )}

          {query.length > 0 && isError && (
            <div className="px-3 py-8 text-center text-xs text-red-500">
              Search unavailable — please try again
            </div>
          )}

          {query.length > 0 && !isError && allResults.length === 0 && !isFetching && (
            <div className="px-3 py-8 text-center text-xs text-slate-400">
              No results for &ldquo;{query}&rdquo;
            </div>
          )}

          {/* Boards section */}
          {data?.boards && data.boards.length > 0 && (
            <div className="mb-1">
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Boards
              </div>
              {data.boards.map((board) => {
                const idx = allResults.findIndex(
                  (r) => r.type === 'board' && r.id === board.id,
                );
                return (
                  <div
                    key={board.id}
                    id={resultId(idx)}
                    role="option"
                    aria-selected={idx === clampedIndex}
                    onClick={() =>
                      handleSelect({ type: 'board', ...board })
                    }
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                      idx === clampedIndex
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-100 text-xs">
                      📋
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{board.title}</div>
                      <div className="text-[10px] text-slate-400">
                        {board._count.groups} group{board._count.groups !== 1 ? 's' : ''}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Items section */}
          {data?.items && data.items.length > 0 && (
            <div>
              <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Items
              </div>
              {data.items.map((item) => {
                const idx = allResults.findIndex(
                  (r) => r.type === 'item' && r.id === item.id,
                );
                const statusCell = item.cellValues.find(
                  (cv) => cv.column.type === 'STATUS' && /status/i.test(cv.column.title),
                ) as { value?: unknown; column: { type: string; title: string } } | undefined;
                return (
                  <div
                    key={item.id}
                    id={resultId(idx)}
                    role="option"
                    aria-selected={idx === clampedIndex}
                    onClick={() =>
                      handleSelect({ type: 'item', ...item })
                    }
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition ${
                      idx === clampedIndex
                        ? 'bg-primary/10 text-primary'
                        : 'text-foreground hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-50 text-xs text-slate-400">
                      ◻
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{item.name}</div>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400">
                        <span className="truncate">
                          {item.group.board.title} › {item.group.title}
                        </span>
                        {statusCell?.value != null && (
                          <>
                            <span>·</span>
                            <span className="shrink-0">
                              {typeof statusCell.value === 'object' && statusCell.value !== null
                                ? (statusCell.value as { label?: string }).label ?? ''
                                : String(statusCell.value)}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {allResults.length > 0 && (
          <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-slate-400">
            <span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5">↑↓</kbd>{' '}
              navigate
            </span>
            <span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5">↵</kbd>{' '}
              select
            </span>
            <span>
              <kbd className="rounded border border-slate-200 bg-slate-50 px-1 py-0.5">esc</kbd>{' '}
              close
            </span>
          </div>
        )}
      </div>
    </>
  );
}
