'use client';

import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

type BoardView = {
  id: string;
  name: string;
};

type BoardHeaderProps = {
  boardName: string;
  memberCount: number;
  onManageColumns?: () => void;
  onManageAutomations?: () => void;
  onSaveAsTemplate?: () => void;
  onDuplicateBoard?: () => void;
  onDeleteBoard?: () => void;
  isDeleting?: boolean;
  onOpenSearch?: () => void;
  // Views
  views?: BoardView[];
  activeViewId?: string | null;
  onViewSelect?: (viewId: string | null) => void;
  onViewDelete?: (viewId: string) => void;
  onSaveView?: (name: string) => void;
};

export function BoardHeader({
  boardName,
  memberCount,
  onManageColumns,
  onManageAutomations,
  onSaveAsTemplate,
  onDuplicateBoard,
  onDeleteBoard,
  isDeleting,
  onOpenSearch,
  views,
  activeViewId,
  onViewSelect,
  onViewDelete,
  onSaveView,
}: BoardHeaderProps) {
  const [moreOpen, setMoreOpen] = useState(false);
  const [morePos, setMorePos] = useState({ top: 0, left: 0 });
  const moreTriggerRef = useRef<HTMLButtonElement | null>(null);
  const moreDropdownRef = useRef<HTMLDivElement | null>(null);

  const [viewsOpen, setViewsOpen] = useState(false);
  const [viewsPos, setViewsPos] = useState({ top: 0, left: 0 });
  const viewsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const viewsDropdownRef = useRef<HTMLDivElement | null>(null);
  const [savingView, setSavingView] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  useEffect(() => {
    if (!moreOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        (moreTriggerRef.current && moreTriggerRef.current.contains(t)) ||
        (moreDropdownRef.current && moreDropdownRef.current.contains(t))
      ) return;
      setMoreOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [moreOpen]);

  useEffect(() => {
    if (!viewsOpen) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        (viewsTriggerRef.current && viewsTriggerRef.current.contains(t)) ||
        (viewsDropdownRef.current && viewsDropdownRef.current.contains(t))
      ) return;
      setViewsOpen(false);
      setSavingView(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [viewsOpen]);

  const hasMoreItems = onSaveAsTemplate || onDuplicateBoard || onDeleteBoard;
  const activeView = views?.find((v) => v.id === activeViewId);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm sm:gap-4 sm:px-6 sm:py-4">
      {/* Board name + views chevron */}
      <div className="flex items-center gap-2 min-w-0">
        <div className="min-w-0">
          <h2 className="text-base font-bold text-foreground sm:text-lg truncate">{boardName}</h2>
          <p className="mt-0.5 text-xs text-slate-400">
            {memberCount} {memberCount === 1 ? 'member' : 'members'}
          </p>
        </div>
        {/* View switcher chevron */}
        {views !== undefined && onViewSelect && (
          <div className="flex flex-col items-start">
            <button
              ref={viewsTriggerRef}
              type="button"
              className="flex items-center gap-1 rounded-md px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-100 transition-colors"
              onClick={() => {
                if (viewsTriggerRef.current) {
                  const rect = viewsTriggerRef.current.getBoundingClientRect();
                  setViewsPos({ top: rect.bottom + 4, left: rect.left });
                }
                setViewsOpen((v) => !v);
                setSavingView(false);
                setNewViewName('');
              }}
              title="Switch view"
            >
              <span className="font-medium truncate max-w-[100px]">
                {activeView?.name ?? 'All Items'}
              </span>
              <svg className="h-3 w-3 flex-shrink-0 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            {viewsOpen && createPortal(
              <div
                ref={viewsDropdownRef}
                style={{ position: 'fixed', top: viewsPos.top, left: viewsPos.left, minWidth: 200 }}
                className="rounded-lg border border-slate-200 bg-white shadow-xl z-[200] overflow-hidden py-1"
              >
                {/* All Items (default) */}
                <button
                  type="button"
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                  onClick={() => { onViewSelect(null); setViewsOpen(false); }}
                >
                  {!activeViewId && <span className="text-primary">✓</span>}
                  {!!activeViewId && <span className="w-3" />}
                  <span className="flex-1">All Items</span>
                </button>
                {/* Saved views */}
                {(views ?? []).map((view) => (
                  <div key={view.id} className="flex items-center gap-1 px-3 py-1.5 hover:bg-slate-50">
                    <button
                      type="button"
                      className="flex flex-1 items-center gap-2 text-left text-xs text-slate-700"
                      onClick={() => { onViewSelect(view.id); setViewsOpen(false); }}
                    >
                      {view.id === activeViewId ? <span className="text-primary">✓</span> : <span className="w-3" />}
                      <span className="flex-1 truncate">{view.name}</span>
                    </button>
                    {onViewDelete && (
                      <button
                        type="button"
                        className="ml-1 text-slate-300 hover:text-rose-500 transition-colors text-xs"
                        onClick={(e) => { e.stopPropagation(); onViewDelete(view.id); }}
                        title="Delete view"
                        aria-label={`Delete view ${view.name}`}
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
                {/* Divider + save current view */}
                {onSaveView && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    {savingView ? (
                      <div className="flex items-center gap-1.5 px-3 py-2">
                        <input
                          autoFocus
                          type="text"
                          value={newViewName}
                          onChange={(e) => setNewViewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newViewName.trim()) {
                              onSaveView(newViewName.trim());
                              setViewsOpen(false);
                              setSavingView(false);
                              setNewViewName('');
                            }
                            if (e.key === 'Escape') { setSavingView(false); setNewViewName(''); }
                          }}
                          placeholder="View name…"
                          className="flex-1 rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-foreground focus:border-primary focus:bg-white focus:outline-none"
                        />
                        <button
                          type="button"
                          className="rounded bg-primary px-2 py-1 text-xs font-semibold text-white disabled:opacity-50"
                          disabled={!newViewName.trim()}
                          onClick={() => {
                            if (newViewName.trim()) {
                              onSaveView(newViewName.trim());
                              setViewsOpen(false);
                              setSavingView(false);
                              setNewViewName('');
                            }
                          }}
                        >
                          Save
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-500 hover:bg-slate-50"
                        onClick={() => setSavingView(true)}
                      >
                        <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Save current view…
                      </button>
                    )}
                  </>
                )}
              </div>,
              document.body,
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Search button */}
        {onOpenSearch && (
          <button
            type="button"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-foreground transition-colors"
            onClick={onOpenSearch}
            title="Search (⌘K)"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <span className="hidden sm:inline">Search</span>
            <kbd className="hidden sm:inline text-[10px] text-slate-300 font-mono">⌘K</kbd>
          </button>
        )}

        {/* Columns button */}
        {onManageColumns && (
          <button
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-foreground transition-colors"
            onClick={onManageColumns}
            type="button"
            title="Add or edit columns"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            <span className="hidden sm:inline">Columns</span>
          </button>
        )}

        {/* Automations icon button */}
        {onManageAutomations && (
          <button
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-foreground transition-colors"
            onClick={onManageAutomations}
            type="button"
            title="Automations"
          >
            <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <span className="hidden sm:inline">Automations</span>
          </button>
        )}

        {/* ⋯ more menu for delete / duplicate / template */}
        {hasMoreItems && (
          <>
            <button
              ref={moreTriggerRef}
              type="button"
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-foreground transition-colors"
              title="More options"
              onClick={() => {
                if (moreTriggerRef.current) {
                  const rect = moreTriggerRef.current.getBoundingClientRect();
                  setMorePos({ top: rect.bottom + 4, left: rect.right - 160 });
                }
                setMoreOpen((v) => !v);
              }}
            >
              <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                <circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" />
              </svg>
            </button>
            {moreOpen && createPortal(
              <div
                ref={moreDropdownRef}
                style={{ position: 'fixed', top: morePos.top, left: morePos.left, minWidth: 160 }}
                className="rounded-lg border border-slate-200 bg-white shadow-xl z-[200] overflow-hidden py-1"
              >
                {onDuplicateBoard && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => { setMoreOpen(false); onDuplicateBoard(); }}
                  >
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Duplicate board
                  </button>
                )}
                {onSaveAsTemplate && (
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-slate-700 hover:bg-slate-50"
                    onClick={() => { setMoreOpen(false); onSaveAsTemplate(); }}
                  >
                    <svg className="h-3.5 w-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                    </svg>
                    Save as template
                  </button>
                )}
                {onDeleteBoard && (
                  <>
                    {(onDuplicateBoard || onSaveAsTemplate) && (
                      <div className="my-1 border-t border-slate-100" />
                    )}
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      onClick={() => { setMoreOpen(false); onDeleteBoard(); }}
                      disabled={!!isDeleting}
                    >
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      {isDeleting ? 'Deleting…' : 'Delete board'}
                    </button>
                  </>
                )}
              </div>,
              document.body,
            )}
          </>
        )}
      </div>
    </div>
  );
}
