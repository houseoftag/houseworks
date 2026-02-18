'use client';

type ViewMode = 'table' | 'board' | 'timeline';

type BoardHeaderProps = {
  boardName: string;
  memberCount: number;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSaveAsTemplate?: () => void;
  onDuplicateBoard?: () => void;
};

export function BoardHeader({
  boardName,
  memberCount,
  viewMode,
  onViewModeChange,
  onSaveAsTemplate,
  onDuplicateBoard,
}: BoardHeaderProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-border bg-card px-6 py-4 shadow-sm">
      <div>
        <h2 className="text-lg font-bold text-foreground">{boardName}</h2>
        <p className="mt-0.5 text-xs text-slate-400">
          {memberCount} {memberCount === 1 ? 'member' : 'members'}
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {onSaveAsTemplate && (
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-foreground transition-colors"
            onClick={onSaveAsTemplate}
            type="button"
            title="Save board structure as a reusable template"
          >
            Save as template
          </button>
        )}
        {onDuplicateBoard && (
          <button
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50 hover:text-foreground transition-colors"
            onClick={onDuplicateBoard}
            type="button"
            title="Duplicate this board"
          >
            Duplicate
          </button>
        )}
        <div className="flex items-center gap-1" role="group" aria-label="View mode">
          <button
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'table'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-foreground'
            }`}
            onClick={() => onViewModeChange('table')}
            type="button"
            aria-pressed={viewMode === 'table'}
          >
            Table
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'board'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-foreground'
            }`}
            onClick={() => onViewModeChange('board')}
            type="button"
            aria-pressed={viewMode === 'board'}
          >
            Board
          </button>
          <button
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
              viewMode === 'timeline'
                ? 'bg-primary text-white shadow-sm'
                : 'bg-white border border-slate-200 text-slate-500 hover:text-foreground'
            }`}
            onClick={() => onViewModeChange('timeline')}
            type="button"
            aria-pressed={viewMode === 'timeline'}
          >
            Timeline
          </button>
        </div>
      </div>
    </div>
  );
}
