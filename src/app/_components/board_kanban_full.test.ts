import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Unit tests for board kanban column/task logic (pure functions extracted from board_kanban_full.tsx)

// --- Extracted pure helpers for testing ---

type StatusOption = { label: string; color: string };

function getStatusOptions(settings: unknown): StatusOption[] {
  if (!settings || typeof settings !== 'object') return [];
  const options = (settings as { options?: Record<string, string> }).options;
  if (!options || typeof options !== 'object') return [];
  return Object.entries(options).map(([label, color]) => ({
    label: label.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
    color,
  }));
}

function buildColumnOrder(statusOptions: StatusOption[]): string[] {
  const cols = statusOptions.map((o) => o.label);
  if (!cols.includes('No Status')) {
    cols.unshift('No Status');
  }
  return cols;
}

function renameStatusOption(
  currentSettings: { options: Record<string, string> },
  oldLabel: string,
  newLabel: string,
): Record<string, string> {
  const newOptions: Record<string, string> = {};
  for (const [label, color] of Object.entries(currentSettings.options)) {
    if (label === oldLabel) {
      newOptions[newLabel] = color;
    } else {
      newOptions[label] = color;
    }
  }
  return newOptions;
}

function deleteStatusOption(
  currentSettings: { options: Record<string, string> },
  label: string,
): Record<string, string> {
  const newOptions = { ...currentSettings.options };
  delete newOptions[label];
  return newOptions;
}

function groupItemsByStatus(
  items: Array<{ id: string; status: string | null }>,
  statusOptions: StatusOption[],
): Map<string, Array<{ id: string; status: string | null }>> {
  const map = new Map<string, Array<{ id: string; status: string | null }>>();
  for (const opt of statusOptions) {
    map.set(opt.label, []);
  }
  if (!map.has('No Status')) {
    map.set('No Status', []);
  }
  for (const item of items) {
    const label = item.status ?? 'No Status';
    const bucket = map.get(label);
    if (bucket) {
      bucket.push(item);
    } else {
      map.set(label, [item]);
    }
  }
  return map;
}

// --- Tests ---

describe('Column operations', () => {
  it('should parse status options from column settings', () => {
    const settings = {
      options: {
        'in_progress': '#f97316',
        'review': '#eab308',
        'done': '#22c55e',
      },
    };
    const result = getStatusOptions(settings);
    assert.strictEqual(result.length, 3);
    assert.strictEqual(result[0]!.label, 'In Progress');
    assert.strictEqual(result[0]!.color, '#f97316');
    assert.strictEqual(result[2]!.label, 'Done');
  });

  it('should return empty array for invalid settings', () => {
    assert.strictEqual(getStatusOptions(null).length, 0);
    assert.strictEqual(getStatusOptions(undefined).length, 0);
    assert.strictEqual(getStatusOptions('string').length, 0);
    assert.strictEqual(getStatusOptions({}).length, 0);
  });

  it('should build column order with No Status prepended', () => {
    const options: StatusOption[] = [
      { label: 'To Do', color: '#3b82f6' },
      { label: 'In Progress', color: '#f97316' },
      { label: 'Done', color: '#22c55e' },
    ];
    const order = buildColumnOrder(options);
    assert.deepStrictEqual(order, ['No Status', 'To Do', 'In Progress', 'Done']);
  });

  it('should rename a status option preserving order and other options', () => {
    const settings = {
      options: {
        'To Do': '#3b82f6',
        'In Progress': '#f97316',
        'Done': '#22c55e',
      },
    };
    const result = renameStatusOption(settings, 'In Progress', 'Working');
    assert.strictEqual(result['Working'], '#f97316');
    assert.strictEqual(result['In Progress'], undefined);
    assert.strictEqual(result['To Do'], '#3b82f6');
    assert.strictEqual(result['Done'], '#22c55e');
    assert.strictEqual(Object.keys(result).length, 3);
  });

  it('should delete a status option', () => {
    const settings = {
      options: {
        'To Do': '#3b82f6',
        'In Progress': '#f97316',
        'Done': '#22c55e',
      },
    };
    const result = deleteStatusOption(settings, 'In Progress');
    assert.strictEqual(result['In Progress'], undefined);
    assert.strictEqual(Object.keys(result).length, 2);
  });
});

describe('Task grouping by status', () => {
  it('should group items into correct status columns', () => {
    const options: StatusOption[] = [
      { label: 'To Do', color: '#3b82f6' },
      { label: 'Done', color: '#22c55e' },
    ];
    const items = [
      { id: '1', status: 'To Do' },
      { id: '2', status: 'Done' },
      { id: '3', status: null },
      { id: '4', status: 'To Do' },
    ];
    const grouped = groupItemsByStatus(items, options);
    assert.strictEqual(grouped.get('To Do')!.length, 2);
    assert.strictEqual(grouped.get('Done')!.length, 1);
    assert.strictEqual(grouped.get('No Status')!.length, 1);
  });

  it('should create bucket for unknown status labels', () => {
    const options: StatusOption[] = [
      { label: 'To Do', color: '#3b82f6' },
    ];
    const items = [
      { id: '1', status: 'Custom Status' },
    ];
    const grouped = groupItemsByStatus(items, options);
    assert.strictEqual(grouped.get('Custom Status')!.length, 1);
  });
});
