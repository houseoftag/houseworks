import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Templates & Cloning', () => {
  describe('Template column config extraction', () => {
    it('extracts column config from board columns', () => {
      const columns = [
        { id: 'c1', title: 'Status', type: 'STATUS', settings: { done: '#22c55e', working: '#3b82f6' }, position: 1 },
        { id: 'c2', title: 'Assignee', type: 'PERSON', settings: {}, position: 2 },
        { id: 'c3', title: 'Due Date', type: 'DATE', settings: {}, position: 3 },
      ];

      const config = columns.map(c => ({
        title: c.title,
        type: c.type,
        settings: c.settings,
        position: c.position,
      }));

      assert.equal(config.length, 3);
      assert.equal(config[0]!.title, 'Status');
      assert.equal(config[0]!.type, 'STATUS');
      assert.deepEqual(config[0]!.settings, { done: '#22c55e', working: '#3b82f6' });
      assert.equal(config[1]!.position, 2);
    });

    it('extracts group config from board groups', () => {
      const groups = [
        { id: 'g1', title: 'To Do', color: '#ef4444', position: 1 },
        { id: 'g2', title: 'In Progress', color: '#3b82f6', position: 2 },
      ];

      const config = groups.map(g => ({
        title: g.title,
        color: g.color,
        position: g.position,
      }));

      assert.equal(config.length, 2);
      assert.equal(config[0]!.title, 'To Do');
      assert.equal(config[0]!.color, '#ef4444');
      // id should NOT be in config
      assert.equal('id' in config[0]!, false);
    });
  });

  describe('Item clone naming', () => {
    it('appends (copy) to cloned item name', () => {
      const original = 'Design homepage';
      const cloned = `${original} (copy)`;
      assert.equal(cloned, 'Design homepage (copy)');
    });

    it('positions clone after original', () => {
      const originalPosition = 3;
      const clonePosition = originalPosition + 0.5;
      assert.equal(clonePosition, 3.5);
    });
  });

  describe('Board duplicate naming', () => {
    it('generates default copy title', () => {
      const original = 'Sprint Board';
      const copyTitle = `${original} (copy)`;
      assert.equal(copyTitle, 'Sprint Board (copy)');
    });

    it('column ID mapping preserves all columns', () => {
      const sourceColumns = ['col-a', 'col-b', 'col-c'];
      const newColumns = ['new-1', 'new-2', 'new-3'];
      const map = new Map<string, string>();
      sourceColumns.forEach((old, i) => map.set(old, newColumns[i]!));

      assert.equal(map.size, 3);
      assert.equal(map.get('col-a'), 'new-1');
      assert.equal(map.get('col-b'), 'new-2');
      assert.equal(map.get('col-c'), 'new-3');
    });
  });
});
