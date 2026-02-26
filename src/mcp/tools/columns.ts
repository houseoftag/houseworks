import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient, ColumnType, Prisma } from '@prisma/client';
import { z } from 'zod';

const columnTypeEnum = z.enum(['TEXT', 'STATUS', 'PERSON', 'DATE', 'LINK', 'NUMBER', 'TIMELINE']);

export function registerColumnTools(server: McpServer, prisma: PrismaClient) {
  /**
   * list_columns
   * Returns all columns on a board ordered by position.
   */
  server.tool(
    'list_columns',
    'List all columns on a board in position order.',
    { boardId: z.string().describe('The board ID') },
    async ({ boardId }) => {
      const columns = await prisma.column.findMany({
        where: { boardId },
        orderBy: { position: 'asc' },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(columns, null, 2) }] };
    },
  );

  /**
   * create_column
   * Creates a new column on a board.
   *
   * Column types:
   *   TEXT       — free text
   *   STATUS     — status dropdown; settings.options = [{ label, color }]
   *   PERSON     — user assignment; value = userId
   *   DATE       — ISO date string
   *   LINK       — URL string
   *   NUMBER     — numeric value
   *   TIMELINE   — { start, end } ISO date pair
   */
  server.tool(
    'create_column',
    `Create a new column on a board.
Types: TEXT | STATUS | PERSON | DATE | LINK | NUMBER | TIMELINE
For STATUS columns, pass settings.options = [{ label, color }].`,
    {
      boardId: z.string().describe('The board ID'),
      title: z.string().describe('Column title'),
      type: columnTypeEnum.describe('Column type'),
      settings: z
        .record(z.string(), z.unknown())
        .optional()
        .describe(
          'Column settings JSON. For STATUS: { options: [{ label: string, color: string }] }',
        ),
    },
    async ({ boardId, title, type, settings }) => {
      const last = await prisma.column.findFirst({
        where: { boardId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });
      const position = (last?.position ?? 0) + 1;
      const column = await prisma.column.create({
        data: { boardId, title, type: type as ColumnType, position, settings: (settings ?? {}) as Prisma.InputJsonValue },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(column, null, 2) }] };
    },
  );

  /**
   * update_column
   * Updates a column's title or settings.
   */
  server.tool(
    'update_column',
    'Update a column title or settings.',
    {
      columnId: z.string().describe('The column ID'),
      title: z.string().optional().describe('New title'),
      settings: z.record(z.string(), z.unknown()).optional().describe('New settings object (replaces existing)'),
    },
    async ({ columnId, title, settings }) => {
      const column = await prisma.column.update({
        where: { id: columnId },
        data: { ...(title !== undefined && { title }), ...(settings !== undefined && { settings: settings as Prisma.InputJsonValue }) },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(column, null, 2) }] };
    },
  );

  /**
   * delete_column
   * Deletes a column and all associated cell values.
   */
  server.tool(
    'delete_column',
    'Delete a column and all its cell values. This is irreversible.',
    { columnId: z.string().describe('The column ID to delete') },
    async ({ columnId }) => {
      await prisma.column.delete({ where: { id: columnId } });
      return { content: [{ type: 'text' as const, text: `Column ${columnId} deleted.` }] };
    },
  );
}
