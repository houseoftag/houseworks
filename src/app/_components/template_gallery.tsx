'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/react';
import { useToast } from './toast_provider';

type TemplateGalleryProps = {
  workspaceId: string;
  onBoardCreated: (boardId: string) => void;
  onClose?: () => void;
};

export function TemplateGallery({ workspaceId, onBoardCreated, onClose }: TemplateGalleryProps) {
  const { pushToast } = useToast();
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [newBoardTitle, setNewBoardTitle] = useState('');
  const utils = trpc.useUtils();

  const { data: templates, isLoading, isError, error } = trpc.templates.list.useQuery({ workspaceId });

  const createFromTemplate = trpc.templates.createBoardFromTemplate.useMutation({
    onSuccess: (board) => {
      pushToast({ title: 'Board created from template', tone: 'success' });
      void utils.boards.dashboardStats.invalidate();
      setSelectedTemplateId(null);
      setNewBoardTitle('');
      onBoardCreated(board.id);
    },
    onError: () => pushToast({ title: 'Failed to create board', tone: 'error' }),
  });

  const deleteTemplate = trpc.templates.delete.useMutation({
    onSuccess: () => {
      pushToast({ title: 'Template deleted', tone: 'success' });
      void utils.templates.list.invalidate();
    },
    onError: () => pushToast({ title: 'Failed to delete template', tone: 'error' }),
  });

  const handleCreate = () => {
    if (!selectedTemplateId || !newBoardTitle.trim()) return;
    createFromTemplate.mutate({
      templateId: selectedTemplateId,
      workspaceId,
      title: newBoardTitle.trim(),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">Template Gallery</h3>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-sm text-slate-500 hover:bg-muted transition-colors"
            type="button"
          >
            Close
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      )}

      {!isLoading && isError && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-rose-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-rose-600">Failed to load templates</p>
          <p className="mt-1 text-xs text-rose-500">{error?.message ?? 'An unexpected error occurred'}</p>
        </div>
      )}

      {!isLoading && !isError && (!templates || templates.length === 0) && (
        <div className="rounded-xl border border-border bg-background p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
          </svg>
          <p className="mt-3 text-sm font-medium text-slate-500">No templates yet</p>
          <p className="mt-1 text-xs text-slate-400">Save a board as a template to reuse its structure</p>
        </div>
      )}

      {templates && templates.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map(t => (
            <div
              key={t.id}
              className={`cursor-pointer rounded-xl border p-4 transition-all hover:shadow-md ${
                selectedTemplateId === t.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary'
                  : 'border-border bg-card hover:border-border'
              }`}
              onClick={() => {
                setSelectedTemplateId(t.id);
                setNewBoardTitle(`New ${t.name}`);
              }}
              role="button"
              tabIndex={0}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { setSelectedTemplateId(t.id); setNewBoardTitle(`New ${t.name}`); } }}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h4 className="truncate text-sm font-semibold text-foreground">{t.name}</h4>
                  {t.description && (
                    <p className="mt-1 text-xs text-slate-500 line-clamp-2">{t.description}</p>
                  )}
                </div>
                <button
                  onClick={e => {
                    e.stopPropagation();
                    if (window.confirm(`Delete template "${t.name}"?`)) {
                      deleteTemplate.mutate({ id: t.id });
                    }
                  }}
                  className="ml-2 shrink-0 rounded p-1 text-slate-400 hover:bg-rose-500/10 hover:text-rose-500 transition-colors"
                  title="Delete template"
                  type="button"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                  </svg>
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                <span>{(t.columnConfig as unknown[]).length} columns</span>
                <span>·</span>
                <span>{(t.groupConfig as unknown[]).length} groups</span>
              </div>
              {t.createdBy?.name && (
                <p className="mt-1 text-xs text-slate-400">by {t.createdBy.name}</p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* New from Template form */}
      {selectedTemplateId && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
          <h4 className="text-sm font-semibold text-foreground">New board from template</h4>
          <div className="mt-3 flex gap-2">
            <input
              value={newBoardTitle}
              onChange={e => setNewBoardTitle(e.target.value)}
              placeholder="Board title"
              className="flex-1 rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary"
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); }}
            />
            <button
              onClick={handleCreate}
              disabled={!newBoardTitle.trim() || createFromTemplate.isPending}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary/90 disabled:opacity-50 transition-colors"
              type="button"
            >
              {createFromTemplate.isPending ? 'Creating…' : 'Create board'}
            </button>
            <button
              onClick={() => { setSelectedTemplateId(null); setNewBoardTitle(''); }}
              className="rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-muted transition-colors"
              type="button"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
