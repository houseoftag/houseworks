import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerBoardTools(server: McpServer, prisma: PrismaClient) {
  /**
   * list_boards
   * Returns all boards in a workspace (summary — no items).
   */
  server.tool(
    'list_boards',
    'List all boards in a workspace. Returns title, description, and creation date (no items).',
    { workspaceId: z.string().describe('The workspace ID') },
    async ({ workspaceId }) => {
      const boards = await prisma.board.findMany({
        where: { workspaceId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          _count: { select: { groups: true, columns: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(boards, null, 2) }] };
    },
  );

  /**
   * get_board
   * Returns a full board: columns, groups, and all items with their cell values.
   */
  server.tool(
    'get_board',
    'Get a full board by ID: columns, groups, items, and all cell values.',
    { boardId: z.string().describe('The board ID') },
    async ({ boardId }) => {
      const board = await prisma.board.findUnique({
        where: { id: boardId },
        include: {
          columns: { orderBy: { position: 'asc' } },
          groups: {
            orderBy: { position: 'asc' },
            include: {
              items: {
                orderBy: { position: 'asc' },
                include: {
                  cellValues: { include: { column: { select: { id: true, title: true, type: true } } } },
                  _count: { select: { updates: true, attachments: true, dependenciesAsSource: true } },
                },
              },
            },
          },
        },
      });
      if (!board) {
        return { content: [{ type: 'text' as const, text: `Board not found: ${boardId}` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(board, null, 2) }] };
    },
  );

  /**
   * create_board
   * Creates a new board in a workspace. Optionally applies a default set of columns.
   */
  server.tool(
    'create_board',
    'Create a new board in a workspace. Optionally seeds it with default Status, Person, and Date columns.',
    {
      workspaceId: z.string().describe('The workspace ID'),
      title: z.string().describe('Board title'),
      description: z.string().optional().describe('Optional board description'),
      ownerId: z.string().optional().describe('User ID of the board owner'),
      withDefaultColumns: z
        .boolean()
        .optional()
        .describe('If true, creates Status, Person, and Date columns automatically (default: true)'),
    },
    async ({ workspaceId, title, description, ownerId, withDefaultColumns = true }) => {
      const board = await prisma.board.create({
        data: { workspaceId, title, description, ownerId },
      });

      // Seed a default group
      await prisma.group.create({
        data: { boardId: board.id, title: 'Group 1', position: 1 },
      });

      // Seed default columns
      if (withDefaultColumns) {
        await prisma.column.createMany({
          data: [
            { boardId: board.id, title: 'Status', type: 'STATUS', position: 1, settings: { options: [{ label: 'Not Started', color: '#c4c4c4' }, { label: 'In Progress', color: '#fdbc64' }, { label: 'Done', color: '#00c875' }] } },
            { boardId: board.id, title: 'Owner', type: 'PERSON', position: 2, settings: {} },
            { boardId: board.id, title: 'Due Date', type: 'DATE', position: 3, settings: {} },
          ],
        });
      }

      const created = await prisma.board.findUnique({
        where: { id: board.id },
        include: { columns: true, groups: true },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(created, null, 2) }] };
    },
  );

  /**
   * update_board
   * Updates a board's title or description.
   */
  server.tool(
    'update_board',
    'Update a board title or description.',
    {
      boardId: z.string().describe('The board ID'),
      title: z.string().optional().describe('New title'),
      description: z.string().optional().describe('New description'),
    },
    async ({ boardId, title, description }) => {
      const board = await prisma.board.update({
        where: { id: boardId },
        data: { ...(title !== undefined && { title }), ...(description !== undefined && { description }) },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(board, null, 2) }] };
    },
  );

  /**
   * delete_board
   * Permanently deletes a board and all its contents.
   */
  server.tool(
    'delete_board',
    'Permanently delete a board and all its groups, items, and data. This is irreversible.',
    { boardId: z.string().describe('The board ID to delete') },
    async ({ boardId }) => {
      await prisma.board.delete({ where: { id: boardId } });
      return { content: [{ type: 'text' as const, text: `Board ${boardId} deleted.` }] };
    },
  );
}
