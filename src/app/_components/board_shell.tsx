export type BoardShellColumn = {
  id: string;
  title: string;
};

export type BoardShellItem = {
  id: string;
  name: string;
  status?: { label: string; color: string };
  person?: { name: string; initials: string };
  date?: string;
};

export type BoardShellGroup = {
  id: string;
  title: string;
  color: string;
  progress: number;
  items: BoardShellItem[];
};

export type BoardShellProps = {
  workspaceName: string;
  boardTitle: string;
  columns: BoardShellColumn[];
  groups: BoardShellGroup[];
};

export function BoardShell({
  workspaceName,
  boardTitle,
  columns,
  groups,
}: BoardShellProps) {
  return (
    <section className="rounded-2xl border border-slate-800/80 bg-slate-950/70 shadow-[0_0_0_1px_rgba(15,23,42,0.6)]">
      <div className="flex items-center justify-between border-b border-slate-800/80 px-6 py-5">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
            Workspace · {workspaceName}
          </p>
          <h2 className="text-xl font-semibold text-slate-100">{boardTitle}</h2>
        </div>
        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="rounded-full border border-slate-700/70 px-3 py-1">
            Table View
          </span>
          <span className="rounded-full border border-slate-700/70 px-3 py-1">
            {groups.length} groups
          </span>
        </div>
      </div>

      <div
        className="grid gap-4 border-b border-slate-800/80 px-6 py-3 text-xs uppercase tracking-[0.24em] text-slate-500"
        style={{
          gridTemplateColumns: `minmax(0,2.2fr) repeat(${Math.max(
            columns.length - 1,
            1,
          )}, minmax(0,1fr))`,
        }}
      >
        {columns.map((column) => (
          <span key={column.id}>{column.title}</span>
        ))}
      </div>

      <div className="divide-y divide-slate-800/80">
        {groups.map((group) => (
          <div key={group.id} className="px-6 py-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: group.color }}
                />
                <h3 className="text-sm font-semibold text-slate-100">
                  {group.title}
                </h3>
              </div>
              <div className="w-40">
                <div className="h-1 rounded-full bg-slate-800">
                  <div
                    className="h-1 rounded-full bg-emerald-400"
                    style={{ width: `${group.progress * 100}%` }}
                  />
                </div>
                <p className="mt-2 text-[11px] uppercase tracking-[0.24em] text-slate-500">
                  {Math.round(group.progress * 100)}% Done
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-3">
              {group.items.map((item) => (
                <div
                  key={item.id}
                  className="grid items-center gap-4 rounded-xl border border-slate-800/70 bg-slate-900/60 px-4 py-3 text-sm text-slate-200"
                  style={{
                    gridTemplateColumns: `minmax(0,2.2fr) repeat(${Math.max(
                      columns.length - 1,
                      1,
                    )}, minmax(0,1fr))`,
                  }}
                >
                  <span className="truncate">{item.name}</span>
                  <span
                    className="inline-flex w-fit items-center rounded-full px-3 py-1 text-xs font-medium"
                    style={{
                      backgroundColor: `${item.status?.color ?? '#64748b'}1a`,
                      color: item.status?.color ?? '#94a3b8',
                    }}
                  >
                    {item.status?.label ?? '—'}
                  </span>
                  <span className="inline-flex items-center gap-2 text-slate-300">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-xs font-semibold">
                      {item.person?.initials ?? '--'}
                    </span>
                    {item.person?.name ?? 'Unassigned'}
                  </span>
                  <span className="text-slate-300">{item.date ?? '—'}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
