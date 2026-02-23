export type SortField = 'manual' | 'created' | 'dueDate' | 'priority' | 'title';
export type SortDir = 'asc' | 'desc';

export type BoardFilters = {
  status: string | null;
  person: string | null;
  priority: string | null;
  dueDateFrom: string | null;
  dueDateTo: string | null;
};

export type BoardSort = {
  field: SortField;
  dir: SortDir;
};
