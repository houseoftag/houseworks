import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerCellTools(server: McpServer, prisma: PrismaClient) {
  /**
   * get_cell_values
   * Returns all cell values for an item, with column metadata.
   */
  server.tool(
    'get_cell_values',
    'Get all cell values for an item with column metadata (title, type).',
    { itemId: z.string().describe('The item ID') },
    async ({ itemId }) => {
      const cells = await prisma.cellValue.findMany({
        where: { itemId },
        include: { column: { select: { id: true, title: true, type: true, settings: true } } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(cells, null, 2) }] };
    },
  );

  /**
   * set_cell_value
   * Sets (upserts) the value for an item+column cell.
   *
   * Value format by column type:
   *   TEXT       — string, e.g. "Notes here"
   *   STATUS     — string matching an option label, e.g. "In Progress"
   *   PERSON     — user ID string, e.g. "clxxxxxxxxx"
   *   DATE       — ISO date string, e.g. "2026-03-01"
   *               NOTE: DATE columns with `deadlineMode: true` in their column settings will trigger
   *               hourly deadline notifications to the linked assignee when the date has passed and
   *               the linked status column does not show the configured "complete" value.
   *   LINK       — URL string, e.g. "https://example.com"
   *   NUMBER     — number, e.g. 42
   *   TIMELINE   — { start: "2026-03-01", end: "2026-03-15" }
   */
  server.tool(
    'set_cell_value',
    `Set (upsert) a cell value for an item+column combination.
Value format by type:
  TEXT: string
  STATUS: string matching a status option label (e.g. "In Progress")
  PERSON: userId string
  DATE: ISO date string (e.g. "2026-03-01")
  LINK: URL string
  NUMBER: number
  TIMELINE: { start: "YYYY-MM-DD", end: "YYYY-MM-DD" }`,
    {
      itemId: z.string().describe('The item ID'),
      columnId: z.string().describe('The column ID'),
      value: z.unknown().describe('The new value (format depends on column type — see description)'),
    },
    async ({ itemId, columnId, value }) => {
      const cell = await prisma.cellValue.upsert({
        where: { itemId_columnId: { itemId, columnId } },
        create: { itemId, columnId, value: value as object },
        update: { value: value as object },
        include: { column: { select: { id: true, title: true, type: true } } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(cell, null, 2) }] };
    },
  );

  /**
   * clear_cell_value
   * Removes a cell value (resets the cell to empty).
   */
  server.tool(
    'clear_cell_value',
    'Clear (delete) a cell value, resetting the cell to empty.',
    {
      itemId: z.string().describe('The item ID'),
      columnId: z.string().describe('The column ID'),
    },
    async ({ itemId, columnId }) => {
      await prisma.cellValue.deleteMany({ where: { itemId, columnId } });
      return { content: [{ type: 'text' as const, text: `Cell cleared for item ${itemId} column ${columnId}.` }] };
    },
  );
}
