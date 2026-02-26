import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';

export function registerAutomationTools(server: McpServer, prisma: PrismaClient) {
  /**
   * list_automations
   * Returns all automations for a given board.
   */
  server.tool(
    'list_automations',
    'List all automations for a board',
    { boardId: z.string().describe('The board ID (cuid)') },
    async ({ boardId }) => {
      const automations = await prisma.automation.findMany({
        where: { boardId },
        orderBy: { createdAt: 'asc' },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(automations, null, 2) }] };
    },
  );

  /**
   * toggle_automation
   * Enable or disable an automation by ID.
   */
  server.tool(
    'toggle_automation',
    'Enable or disable an automation',
    {
      id: z.string().describe('The automation ID (cuid)'),
      enabled: z.boolean().describe('Whether the automation should be enabled'),
    },
    async ({ id, enabled }) => {
      const automation = await prisma.automation.update({
        where: { id },
        data: { enabled },
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(automation, null, 2) }] };
    },
  );
}
