'use client';

import { useEffect } from 'react';

export type HotkeyBinding = {
  /** Key combo like "ctrl+n", "mod+k", "?", "escape", "shift+click" */
  key: string;
  /** Human-readable description */
  description: string;
  /** Category for help overlay grouping */
  category: 'global' | 'navigation' | 'board' | 'editing';
  /** Handler */
  handler: (e: KeyboardEvent) => void;
  /** Whether the shortcut is currently enabled (default true) */
  enabled?: boolean;
};

/** Registered shortcuts for the help overlay */
const registeredBindings: HotkeyBinding[] = [];

export function getRegisteredBindings(): HotkeyBinding[] {
  return registeredBindings;
}

/**
 * Parse a key string like "mod+shift+k" into a matcher.
 * "mod" = Cmd on Mac, Ctrl elsewhere.
 */
function parseKey(key: string) {
  const parts = key.toLowerCase().split('+');
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);

  let ctrl = false;
  let meta = false;
  let shift = false;
  let alt = false;
  let mainKey = '';

  for (const part of parts) {
    if (part === 'mod') {
      if (isMac) meta = true;
      else ctrl = true;
    } else if (part === 'ctrl') ctrl = true;
    else if (part === 'meta' || part === 'cmd') meta = true;
    else if (part === 'shift') shift = true;
    else if (part === 'alt') alt = true;
    else mainKey = part;
  }

  return { ctrl, meta, shift, alt, mainKey };
}

function matchesEvent(parsed: ReturnType<typeof parseKey>, e: KeyboardEvent): boolean {
  const eventKey = e.key.toLowerCase();
  // For "?" key, the actual key is "?" with shift
  if (parsed.mainKey === '?' && eventKey === '?') {
    return !e.ctrlKey && !e.metaKey && !e.altKey;
  }

  const ctrlMatch = parsed.ctrl ? e.ctrlKey : !e.ctrlKey;
  const metaMatch = parsed.meta ? e.metaKey : !e.metaKey;
  const shiftMatch = parsed.shift ? e.shiftKey : !e.shiftKey;
  const altMatch = parsed.alt ? e.altKey : !e.altKey;

  // Special: "mod" means either ctrl or meta
  if (parsed.ctrl || parsed.meta) {
    const modMatch = (parsed.ctrl && e.ctrlKey) || (parsed.meta && e.metaKey);
    const otherMod = parsed.ctrl ? !e.metaKey : !e.ctrlKey;
    return modMatch && otherMod && shiftMatch && altMatch && eventKey === parsed.mainKey;
  }

  return ctrlMatch && metaMatch && shiftMatch && altMatch && eventKey === parsed.mainKey;
}

/**
 * Hook to register keyboard shortcuts.
 * Shortcuts are automatically unregistered on unmount.
 */
export function useHotkeys(bindings: HotkeyBinding[]) {
  useEffect(() => {
    // Register bindings for help overlay
    const active = bindings.filter((b) => b.enabled !== false);
    registeredBindings.push(...active);

    const handler = (e: KeyboardEvent) => {
      // Don't fire shortcuts when typing in inputs (except specific ones like Escape)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT' || target.isContentEditable;

      for (const binding of bindings) {
        if (binding.enabled === false) continue;
        const parsed = parseKey(binding.key);

        // Allow Escape and mod shortcuts even in inputs
        const allowInInput = parsed.mainKey === 'escape' || parsed.ctrl || parsed.meta;
        if (isInput && !allowInInput) continue;

        if (matchesEvent(parsed, e)) {
          e.preventDefault();
          binding.handler(e);
          return;
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => {
      window.removeEventListener('keydown', handler);
      // Unregister bindings
      for (const b of active) {
        const idx = registeredBindings.indexOf(b);
        if (idx >= 0) registeredBindings.splice(idx, 1);
      }
    };
  }, [bindings]);
}

/**
 * Format a key string for display.
 * Converts "mod+k" to "⌘K" on Mac, "Ctrl+K" elsewhere.
 */
export function formatHotkey(key: string): string {
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent);
  const parts = key.toLowerCase().split('+');

  return parts
    .map((p) => {
      if (p === 'mod') return isMac ? '⌘' : 'Ctrl';
      if (p === 'ctrl') return isMac ? '⌃' : 'Ctrl';
      if (p === 'meta' || p === 'cmd') return '⌘';
      if (p === 'shift') return isMac ? '⇧' : 'Shift';
      if (p === 'alt') return isMac ? '⌥' : 'Alt';
      if (p === 'escape') return 'Esc';
      if (p === 'enter') return '↵';
      if (p === 'arrowup') return '↑';
      if (p === 'arrowdown') return '↓';
      if (p === 'arrowleft') return '←';
      if (p === 'arrowright') return '→';
      return p.toUpperCase();
    })
    .join(isMac ? '' : '+');
}
