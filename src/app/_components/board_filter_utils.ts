import type { BoardFilters, BoardSort } from './board_filters';

type CellValue = { columnId: string; value: unknown };
type ItemLike = { id: string; name: string; createdAt: Date | string; cellValues: CellValue[] };
type ColumnLike = { id: string; type: string; title: string; settings: unknown };

function getCellValue(item: ItemLike, columnId: string): unknown {
  return item.cellValues.find((c) => c.columnId === columnId)?.value ?? null;
}

function getStatusLabel(item: ItemLike, statusColumnId: string | null): string | null {
  if (!statusColumnId) return null;
  const v = getCellValue(item, statusColumnId);
  if (!v || typeof v !== 'object') return null;
  return (v as { label?: string }).label ?? null;
}

function getPersonUserId(item: ItemLike, personColumnId: string | null): string | null {
  if (!personColumnId) return null;
  const v = getCellValue(item, personColumnId);
  if (!v || typeof v !== 'object') return null;
  return (v as { userId?: string }).userId ?? null;
}

function getDateValue(item: ItemLike, dateColumnId: string | null): string | null {
  if (!dateColumnId) return null;
  const v = getCellValue(item, dateColumnId);
  if (!v || typeof v !== 'string') return null;
  return v;
}

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  urgent: 1,
  high: 2,
  medium: 3,
  normal: 4,
  low: 5,
};

function getPriorityRank(item: ItemLike, priorityColumnId: string | null): number {
  if (!priorityColumnId) return 99;
  const v = getCellValue(item, priorityColumnId);
  if (!v || typeof v !== 'object') return 99;
  const label = ((v as { label?: string }).label ?? '').toLowerCase();
  return PRIORITY_ORDER[label] ?? 50;
}

export function filterAndSortItems<T extends ItemLike>(
  items: T[],
  filters: BoardFilters,
  sort: BoardSort,
  columns: ColumnLike[],
): T[] {
  const statusCol = columns.find((c) => c.type === 'STATUS' && !c.title.toLowerCase().includes('priority')) ?? columns.find((c) => c.type === 'STATUS') ?? null;
  const personCol = columns.find((c) => c.type === 'PERSON') ?? null;
  const dateCol = columns.find((c) => c.type === 'DATE') ?? null;
  const priorityCol = columns.find((c) => c.type === 'STATUS' && c.title.toLowerCase().includes('priority')) ?? null;

  // Filter
  let result = items.filter((item) => {
    if (filters.status) {
      const label = getStatusLabel(item, statusCol?.id ?? null);
      if (label !== filters.status) return false;
    }
    if (filters.person) {
      const userId = getPersonUserId(item, personCol?.id ?? null);
      if (userId !== filters.person) return false;
    }
    if (filters.priority) {
      const label = getStatusLabel(item, priorityCol?.id ?? null);
      if (label !== filters.priority) return false;
    }
    if (filters.dueDateFrom || filters.dueDateTo) {
      const dateStr = getDateValue(item, dateCol?.id ?? null);
      if (!dateStr) return false;
      const d = new Date(dateStr).getTime();
      if (filters.dueDateFrom && d < new Date(filters.dueDateFrom).getTime()) return false;
      if (filters.dueDateTo && d > new Date(filters.dueDateTo).getTime()) return false;
    }
    return true;
  });

  // Sort
  const dir = sort.dir === 'asc' ? 1 : -1;
  result = [...result].sort((a, b) => {
    let cmp = 0;
    switch (sort.field) {
      case 'title':
        cmp = a.name.localeCompare(b.name);
        break;
      case 'created': {
        const aT = new Date(a.createdAt).getTime();
        const bT = new Date(b.createdAt).getTime();
        cmp = aT - bT;
        break;
      }
      case 'dueDate': {
        const aD = getDateValue(a, dateCol?.id ?? null);
        const bD = getDateValue(b, dateCol?.id ?? null);
        if (!aD && !bD) cmp = 0;
        else if (!aD) cmp = 1;
        else if (!bD) cmp = -1;
        else cmp = new Date(aD).getTime() - new Date(bD).getTime();
        break;
      }
      case 'priority': {
        const aP = getPriorityRank(a, priorityCol?.id ?? null);
        const bP = getPriorityRank(b, priorityCol?.id ?? null);
        cmp = aP - bP;
        break;
      }
    }
    return cmp * dir;
  });

  return result;
}
