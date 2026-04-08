'use client';

import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  renderSelected,
  variant = 'default',
  footer,
  onClose,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
  renderSelected?: (opt: { value: string; label: string } | undefined) => React.ReactNode;
  variant?: 'default' | 'flat';
  footer?: React.ReactNode;
  onClose?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, width: 0 });
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (
        (triggerRef.current && triggerRef.current.contains(t)) ||
        (dropdownRef.current && dropdownRef.current.contains(t))
      )
        return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  const handleOpen = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 4, left: rect.left, width: Math.max(rect.width, 128) });
    }
    setOpen((v) => !v);
  };

  const selected = options.find((o) => o.value === value);
  return (
    <div className={`relative w-full ${variant === 'flat' ? 'h-full' : ''}`}>
      <button
        ref={triggerRef}
        type="button"
        className={variant === 'flat'
          ? "flex w-full h-full items-center justify-between px-3 py-0 text-xs text-foreground hover:bg-background/50 focus:outline-none transition-colors"
          : "flex w-full min-h-[44px] items-center justify-between rounded-lg border border-border bg-background px-2 py-1.5 text-xs text-foreground hover:border-primary/40 hover:bg-card focus:outline-none focus:border-primary transition-colors"
        }
        onClick={handleOpen}
      >
        <span className="flex items-center gap-1.5 min-w-0 truncate">
          {renderSelected
            ? renderSelected(selected)
            : selected?.label ?? <span className="text-slate-400">{placeholder}</span>}
        </span>
        <svg
          className="ml-1.5 h-3 w-3 flex-shrink-0 text-slate-400"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {open &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{ position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width }}
            className="rounded-lg border border-border bg-card shadow-xl z-[200] overflow-hidden"
          >
            <button
              type="button"
              className="block w-full px-3 py-3 text-left text-xs text-slate-400 hover:bg-background min-h-[44px]"
              onClick={() => {
                onChange('');
                setOpen(false);
              }}
            >
              {placeholder}
            </button>
            <div className="border-t border-border" />
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`flex w-full items-center gap-2 px-3 py-3 text-left text-xs hover:bg-background min-h-[44px] ${opt.value === value ? 'bg-primary/5 text-primary font-semibold' : 'text-foreground'}`}
                onClick={() => {
                  onChange(opt.value);
                  setOpen(false);
                }}
              >
                {opt.value === value && <span className="text-primary">✓</span>}
                <span className="truncate">{opt.label}</span>
              </button>
            ))}
            {footer && (
              <>
                <div className="border-t border-border" />
                <div onClick={() => setOpen(false)}>
                  {footer}
                </div>
              </>
            )}
          </div>,
          document.body,
        )}
    </div>
  );
}
