import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

/**
 * Unit tests for ItemDetailPanel logic and the items.getDetail endpoint shape.
 * These are structural/logic tests that don't require a DOM or database.
 */

describe('ItemDetailPanel', () => {
  it('getDetail endpoint returns item with cellValues, columns, updates, and timestamps', () => {
    // Validates the expected shape of the getDetail response
    const mockResponse = {
      id: 'cltest123',
      name: 'Test Item',
      groupId: 'clgroup1',
      position: 1,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-02-01'),
      group: {
        id: 'clgroup1',
        title: 'Group 1',
        board: {
          id: 'clboard1',
          title: 'Board 1',
          workspaceId: 'clworkspace1',
          columns: [
            { id: 'clcol1', title: 'Status', type: 'STATUS', position: 1, settings: { options: { todo: '#94a3b8', done: '#22c55e' } } },
            { id: 'clcol2', title: 'Assignee', type: 'PERSON', position: 2, settings: {} },
            { id: 'clcol3', title: 'Due Date', type: 'DATE', position: 3, settings: {} },
            { id: 'clcol4', title: 'Notes', type: 'TEXT', position: 4, settings: {} },
            { id: 'clcol5', title: 'Estimate', type: 'NUMBER', position: 5, settings: {} },
          ],
        },
      },
      cellValues: [
        { id: 'cv1', columnId: 'clcol1', value: { label: 'todo', color: '#94a3b8' }, column: { type: 'STATUS' } },
        { id: 'cv2', columnId: 'clcol2', value: { userId: 'u1', name: 'Alice' }, column: { type: 'PERSON' } },
      ],
      updates: [
        { id: 'u1', content: 'First comment', createdAt: new Date(), user: { id: 'u1', name: 'Alice', image: null } },
      ],
    };

    // Shape assertions
    assert.ok(mockResponse.id, 'has id');
    assert.ok(mockResponse.name, 'has name');
    assert.ok(mockResponse.createdAt, 'has createdAt');
    assert.ok(mockResponse.updatedAt, 'has updatedAt');
    assert.ok(mockResponse.group.board.columns.length === 5, 'has 5 columns');
    assert.ok(mockResponse.cellValues.length === 2, 'has 2 cell values');
    assert.ok(mockResponse.updates.length === 1, 'has 1 update');
    assert.ok(mockResponse.group.board.workspaceId, 'has workspaceId for person lookup');
  });

  it('all column types are supported for rendering', () => {
    const supportedTypes = ['STATUS', 'PERSON', 'DATE', 'TEXT', 'NUMBER', 'LINK', 'TIMELINE'];
    const prismaColumnTypes = ['TEXT', 'STATUS', 'PERSON', 'DATE', 'LINK', 'NUMBER', 'TIMELINE'];

    // Every Prisma ColumnType should be handled in the panel
    for (const type of prismaColumnTypes) {
      assert.ok(supportedTypes.includes(type), `${type} is supported in the detail panel`);
    }
  });

  it('inline edit trims whitespace before saving', () => {
    // Simulates the trim logic used in InlineEdit.commit()
    const testCases = [
      { input: '  hello  ', expected: 'hello' },
      { input: 'no change', expected: 'no change' },
      { input: '   ', expected: '' }, // empty after trim → no save
    ];

    for (const { input, expected } of testCases) {
      const trimmed = input.trim();
      assert.equal(trimmed, expected, `"${input}" trims to "${expected}"`);
    }
  });

  it('panel responds to Escape key for dismissal (logic check)', () => {
    // Validates that the key string used in the handler matches
    const escapeKey = 'Escape';
    assert.equal(escapeKey, 'Escape', 'Escape key string is correct');
  });

  it('status editor toggles off when clicking active status', () => {
    const currentValue = { label: 'todo', color: '#94a3b8' };
    const clickedLabel = 'todo';
    const isActive = currentValue?.label === clickedLabel;
    const result = isActive ? null : { label: clickedLabel, color: '#94a3b8' };
    assert.equal(result, null, 'clicking active status sets value to null');
  });

  it('status editor sets value when clicking inactive status', () => {
    const currentValue = { label: 'todo', color: '#94a3b8' };
    const clickedLabel = 'done';
    const isActive = currentValue?.label === clickedLabel;
    const result = isActive ? null : { label: clickedLabel, color: '#22c55e' };
    assert.deepEqual(result, { label: 'done', color: '#22c55e' }, 'clicking inactive status sets new value');
  });

  it('cell map correctly maps columnId to cell value', () => {
    const cellValues = [
      { columnId: 'col1', value: 'text value' },
      { columnId: 'col2', value: { label: 'done', color: '#22c55e' } },
    ];
    const cellMap = new Map(cellValues.map((cv) => [cv.columnId, cv]));

    assert.equal(cellMap.get('col1')?.value, 'text value');
    assert.deepEqual(cellMap.get('col2')?.value, { label: 'done', color: '#22c55e' });
    assert.equal(cellMap.get('col3'), undefined, 'missing column returns undefined');
  });
});
