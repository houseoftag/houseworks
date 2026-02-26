import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerWorkspaceTools(server: McpServer, prisma: PrismaClient) {
  /**
   * list_workspaces
   * Returns all workspaces with member count and board count.
   */
  server.tool(
    'list_workspaces',
    'List all Houseworks workspaces with member count and board count.',
    {},
    async () => {
      const workspaces = await prisma.workspace.findMany({
        orderBy: { createdAt: 'asc' },
        include: {
          _count: { select: { members: true, boards: true } },
          owner: { select: { id: true, name: true, email: true } },
        },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(workspaces, null, 2) }] };
    },
  );

  /**
   * get_workspace
   * Returns a workspace with its members and boards.
   */
  server.tool(
    'get_workspace',
    'Get a workspace by ID, including members and boards.',
    { workspaceId: z.string().describe('The workspace ID (cuid)') },
    async ({ workspaceId }) => {
      const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
        include: {
          owner: { select: { id: true, name: true, email: true } },
          members: {
            include: { user: { select: { id: true, name: true, email: true } } },
            orderBy: { createdAt: 'asc' },
          },
          boards: {
            orderBy: { createdAt: 'desc' },
            select: { id: true, title: true, description: true, createdAt: true },
          },
        },
      });
      if (!workspace) {
        return { content: [{ type: 'text' as const, text: `Workspace not found: ${workspaceId}` }], isError: true };
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(workspace, null, 2) }] };
    },
  );

  /**
   * list_users
   * Returns all users in the system — useful for finding user IDs for assignment.
   */
  server.tool(
    'list_users',
    'List all users in the system (useful for finding user IDs for assignment or mentions).',
    {},
    async () => {
      const users = await prisma.user.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, email: true, role: true, createdAt: true },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(users, null, 2) }] };
    },
  );

  /**
   * get_notification_preferences
   * Returns all notification preferences for a user.
   */
  server.tool(
    'get_notification_preferences',
    'Get all notification preferences for a user. Null type means global default; non-null boardId means board-specific override.',
    { userId: z.string().describe('The user ID (cuid)') },
    async ({ userId }) => {
      const prefs = await prisma.notificationPreference.findMany({
        where: { userId },
        orderBy: { createdAt: 'asc' },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(prefs, null, 2) }] };
    },
  );

  /**
   * set_board_subscription
   * Subscribe or unsubscribe a user to all notifications for a board.
   */
  server.tool(
    'set_board_subscription',
    'Subscribe or unsubscribe a user from a board. When subscribed=true the user receives all notification types for that board (subject to their global preferences).',
    {
      userId: z.string().describe('The user ID (cuid)'),
      boardId: z.string().describe('The board ID (cuid)'),
      subscribed: z.boolean().describe('true to subscribe, false to unsubscribe'),
    },
    async ({ userId, boardId, subscribed }) => {
      const prefs = await prisma.userBoardPrefs.upsert({
        where: { userId_boardId: { userId, boardId } },
        create: { userId, boardId, columnWidths: {}, subscribed },
        update: { subscribed },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(prefs, null, 2) }] };
    },
  );

  /**
   * update_user_profile
   * Updates a user's display name and/or avatar image URL.
   */
  server.tool(
    'update_user_profile',
    'Update a user\'s display name and/or avatar image URL.',
    {
      userId: z.string().describe('The user ID (cuid)'),
      name: z.string().optional().describe('New display name'),
      image: z.string().optional().describe('New avatar image URL (or empty string to clear)'),
    },
    async ({ userId, name, image }) => {
      const user = await prisma.user.update({
        where: { id: userId },
        data: {
          ...(name !== undefined && { name }),
          ...(image !== undefined && { image: image === '' ? null : image }),
        },
        select: { id: true, name: true, email: true, image: true },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(user, null, 2) }] };
    },
  );

  /**
   * create_workspace
   * Creates a new workspace owned by the specified user.
   */
  server.tool(
    'create_workspace',
    'Create a new workspace owned by the specified user.',
    {
      name: z.string().describe('Workspace name'),
      ownerId: z.string().describe('Owner user ID (cuid)'),
    },
    async ({ name, ownerId }) => {
      const workspace = await prisma.workspace.create({
        data: {
          name,
          ownerId,
          members: { create: { userId: ownerId, role: 'OWNER' } },
        },
        include: { _count: { select: { members: true, boards: true } } },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(workspace, null, 2) }] };
    },
  );
}
