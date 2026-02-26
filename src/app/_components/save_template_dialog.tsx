'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';

type SaveTemplateDialogProps = {
  boardId: string;
  boardTitle: string;
  onClose: () => void;
};

export function SaveTemplateDialog({ boardId, boardTitle, onClose }: SaveTemplateDialogProps) {
  const { pushToast } = useToast();
  const [name, setName] = useState(`${boardTitle} Template`);
  const [description, setDescription] = useState('');
  const utils = trpc.useUtils();

  const createTemplate = trpc.templates.createFromBoard.useMutation({
    onSuccess: () => {
      pushToast({ title: 'Template saved!', tone: 'success' });
      void utils.templates.list.invalidate();
      onClose();
    },
    onError: () => pushToast({ title: 'Failed to save template', tone: 'error' }),
  });

  const handleSave = () => {
    if (!name.trim()) return;
    createTemplate.mutate({
      boardId,
      name: name.trim(),
      description: description.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30" onClick={onClose} role="dialog" aria-modal="true" aria-label="Save as template">
      <div className="w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl" onClick={e => e.stopPropagation()}>
        <h3 className="text-lg font-semibold text-foreground">Save as template</h3>
        <p className="mt-1 text-sm text-slate-500">Create a reusable template from this board&apos;s structure (columns and groups).</p>

        <div className="mt-4 space-y-3">
          <div>
            <label htmlFor="template-name" className="block text-sm font-medium text-foreground">Template name</label>
            <input
              id="template-name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="e.g. Sprint Board Template"
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
              autoFocus
            />
          </div>
          <div>
            <label htmlFor="template-desc" className="block text-sm font-medium text-foreground">Description (optional)</label>
            <textarea
              id="template-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="mt-1 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="What is this template for?"
              rows={2}
            />
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-500 hover:bg-muted transition-colors"
            type="button"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || createTemplate.isPending}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
            type="button"
          >
            {createTemplate.isPending ? 'Saving…' : 'Save template'}
          </button>
        </div>
      </div>
    </div>
  );
}
