'use client';

import { useState, useEffect, useRef } from 'react';
import { useHotkeys, formatHotkey } from './use_hotkeys';

type ShortcutEntry = {
  key: string;
  description: string;
};

type ShortcutCategory = {
  label: string;
  shortcuts: ShortcutEntry[];
};

const SHORTCUT_CATEGORIES: ShortcutCategory[] = [
  {
    label: 'Global',
    shortcuts: [
      { key: 'mod+n', description: 'New item' },
      { key: 'mod+k', description: 'Search / Command palette' },
      { key: '?', description: 'Show keyboard shortcuts' },
    ],
  },
  {
    label: 'Navigation',
    shortcuts: [
      { key: 'escape', description: 'Close panel / dialog' },
    ],
  },
  {
    label: 'Board — Table View',
    shortcuts: [
      { key: 'ArrowUp', description: 'Move focus up' },
      { key: 'ArrowDown', description: 'Move focus down' },
      { key: 'ArrowLeft', description: 'Move focus left' },
      { key: 'ArrowRight', description: 'Move focus right' },
      { key: 'Enter', description: 'Edit focused cell' },
      { key: 'Escape', description: 'Stop editing cell' },
    ],
  },
  {
    label: 'Editing',
    shortcuts: [
      { key: 'mod+z', description: 'Undo last cell edit' },
      { key: 'mod+shift+z', description: 'Redo cell edit' },
      { key: 'shift+click', description: 'Select range of items' },
    ],
  },
];

export function ShortcutHelpOverlay() {
  const [open, setOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  useHotkeys([
    {
      key: '?',
      description: 'Show keyboard shortcuts',
      category: 'global',
      handler: () => setOpen((prev) => !prev),
    },
  ]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40" onClick={() => setOpen(false)}>
      <div
        ref={overlayRef}
        className="w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-foreground">Keyboard Shortcuts</h2>
          <button
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-slate-400 hover:text-foreground hover:bg-muted"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-5 max-h-[60vh] overflow-y-auto">
          {SHORTCUT_CATEGORIES.map((category) => (
            <div key={category.label}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {category.label}
              </h3>
              <div className="space-y-1">
                {category.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.key}
                    className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-background"
                  >
                    <span className="text-sm text-foreground">{shortcut.description}</span>
                    <kbd className="rounded-md border border-border bg-background px-2 py-0.5 text-xs font-mono text-foreground/70">
                      {formatHotkey(shortcut.key)}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 pt-4 border-t border-border text-center">
          <p className="text-xs text-slate-400">
            Press <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono">?</kbd> to toggle this overlay
          </p>
        </div>
      </div>
    </div>
  );
}
