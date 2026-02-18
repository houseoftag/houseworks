/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Json fields require any */
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient, AutomationLogStatus } from '@prisma/client';

const workerName = process.env.WORKER_NAME ?? 'automation-worker';
const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

const connection = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});

const prisma = new PrismaClient();

const worker = new Worker(
  'automation',
  async (job) => {
    console.log(`[worker] job ${job.name} ${job.id}`);
    if (job.name === 'cell.updated') {
      const { itemId, columnId, value } = job.data as {
        itemId: string;
        columnId: string;
        value: unknown;
      };

      const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: {
          group: {
            select: {
              boardId: true,
              board: {
                select: { workspaceId: true },
              },
            },
          },
        },
      });

      if (!item) {
        return;
      }

      // Determine trigger type based on column
      const column = await prisma.column.findUnique({
        where: { id: columnId },
        select: { type: true, title: true },
      });

      if (!column) return;

      let triggerTypes: string[];
      if (column.type === 'STATUS') {
        // Check if this is a priority column by name convention
        if (/priority/i.test(column.title)) {
          triggerTypes = ['STATUS_CHANGED', 'PRIORITY_CHANGED'];
        } else {
          triggerTypes = ['STATUS_CHANGED'];
        }
      } else if (column.type === 'PERSON') {
        triggerTypes = ['ASSIGNEE_CHANGED'];
      } else {
        triggerTypes = [];
      }

      if (triggerTypes.length === 0) return;

      const automations = await prisma.automation.findMany({
        where: {
          workspaceId: item.group.board.workspaceId,
          boardId: item.group.boardId,
          enabled: true,
        },
      });

      for (const automation of automations) {
        const trigger = automation.trigger as {
          type?: string;
          columnId?: string;
          to?: string;
          from?: string;
        };

        if (!trigger?.type || !triggerTypes.includes(trigger.type)) continue;

        // Column match
        if (trigger.columnId && trigger.columnId !== columnId) continue;

        // Value match
        if (trigger.to) {
          const newLabel = extractLabel(value);
          if (newLabel !== trigger.to) continue;
        }

        await executeActions(automation, {
          itemId,
          columnId,
          value,
          boardId: item.group.boardId,
          workspaceId: item.group.board.workspaceId,
        });
      }
    }

    if (job.name === 'item.created') {
      const { itemId, groupId } = job.data as {
        itemId: string;
        groupId: string;
      };

      const item = await prisma.item.findUnique({
        where: { id: itemId },
        include: {
          group: {
            select: {
              boardId: true,
              board: {
                select: { workspaceId: true },
              },
            },
          },
        },
      });

      if (!item) return;

      const automations = await prisma.automation.findMany({
        where: {
          workspaceId: item.group.board.workspaceId,
          boardId: item.group.boardId,
          enabled: true,
        },
      });

      for (const automation of automations) {
        const trigger = automation.trigger as { type?: string };
        if (trigger?.type === 'ITEM_CREATED') {
          await executeActions(automation, {
            itemId,
            groupId,
            boardId: item.group.boardId,
            workspaceId: item.group.board.workspaceId,
          });
        }
      }
    }
  },
  {
    connection,
  },
);

function extractLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.label === 'string') return v.label;
  if (typeof v.userId === 'string') return v.userId;
  return null;
}

type ActionContext = {
  itemId: string;
  columnId?: string;
  groupId?: string;
  value?: unknown;
  boardId: string;
  workspaceId: string;
};

async function executeActions(automation: any, context: ActionContext) {
  const actions = automation.actions as any[];
  for (const action of actions) {
    try {
      await executeSingleAction(action, context, automation.id);
    } catch (err) {
      console.error(`[worker] action failed for automation ${automation.id}:`, err);
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          status: AutomationLogStatus.FAILED,
          payload: context,
          message: err instanceof Error ? err.message : 'Unknown error',
        },
      });
    }
  }
}

async function executeSingleAction(
  action: any,
  context: ActionContext,
  automationId: string,
) {
  const payload = action.payload ?? {};

  switch (action.type) {
    case 'LOG': {
      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: context,
          message: payload.message ?? 'Automation executed',
        },
      });
      break;
    }

    case 'SET_STATUS': {
      const { columnId, label, color } = payload as {
        columnId: string;
        label: string;
        color: string;
      };

      await prisma.cellValue.upsert({
        where: {
          itemId_columnId: { itemId: context.itemId, columnId },
        },
        update: { value: { label, color } },
        create: {
          itemId: context.itemId,
          columnId,
          value: { label, color },
        },
      });

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { ...context, action },
          message: `Set status to ${label}`,
        },
      });
      break;
    }

    case 'SET_PERSON': {
      const targetUserId = payload.userId as string;
      const targetColumnId = payload.columnId as string;
      if (!targetUserId || !targetColumnId) break;

      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, image: true },
      });
      if (!user) break;

      await prisma.cellValue.upsert({
        where: {
          itemId_columnId: { itemId: context.itemId, columnId: targetColumnId },
        },
        update: { value: { userId: user.id, name: user.name, image: user.image } },
        create: {
          itemId: context.itemId,
          columnId: targetColumnId,
          value: { userId: user.id, name: user.name, image: user.image },
        },
      });

      // Notify assigned user
      const item = await prisma.item.findUnique({
        where: { id: context.itemId },
        select: { name: true },
      });

      await prisma.notification.create({
        data: {
          userId: targetUserId,
          title: 'Auto-assigned',
          message: `You were automatically assigned to "${item?.name ?? 'Item'}"`,
        },
      });

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { ...context, action },
          message: `Auto-assigned to ${user.name ?? targetUserId}`,
        },
      });
      break;
    }

    case 'NOTIFY': {
      const message = payload.message as string | undefined;
      const item = await prisma.item.findUnique({
        where: { id: context.itemId },
        select: { name: true },
      });

      let recipients: string[] = [];
      if (payload.userIds) {
        recipients = payload.userIds as string[];
      } else if (payload.notifyAssignee) {
        const personCells = await prisma.cellValue.findMany({
          where: { itemId: context.itemId, column: { type: 'PERSON' } },
          select: { value: true },
        });
        recipients = personCells
          .map((c) => (c.value as { userId?: string } | null)?.userId)
          .filter((id): id is string => !!id);
      } else {
        const members = await prisma.workspaceMember.findMany({
          where: { workspaceId: context.workspaceId },
          select: { userId: true },
        });
        recipients = members.map((m) => m.userId);
      }

      await Promise.all(
        recipients.map((uid) =>
          prisma.notification.create({
            data: {
              userId: uid,
              title: (payload.title as string) ?? 'Automation triggered',
              message: message ?? `Automation triggered on "${item?.name ?? 'Item'}"`,
            },
          }),
        ),
      );

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { ...context, action, recipientCount: recipients.length },
          message: `Notified ${recipients.length} user(s)`,
        },
      });
      break;
    }

    case 'MOVE_TO_GROUP': {
      const targetGroupId = payload.groupId as string;
      if (!targetGroupId) break;

      const group = await prisma.group.findFirst({
        where: { id: targetGroupId, boardId: context.boardId },
      });
      if (!group) break;

      const lastItem = await prisma.item.findFirst({
        where: { groupId: targetGroupId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      await prisma.item.update({
        where: { id: context.itemId },
        data: {
          groupId: targetGroupId,
          position: (lastItem?.position ?? 0) + 1,
        },
      });

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { ...context, action },
          message: `Moved item to group "${group.title}"`,
        },
      });
      break;
    }

    case 'SET_COLUMN': {
      const columnId = payload.columnId as string;
      const value = payload.value;
      if (!columnId || value === undefined) break;

      await prisma.cellValue.upsert({
        where: {
          itemId_columnId: { itemId: context.itemId, columnId },
        },
        update: { value: value as any },
        create: {
          itemId: context.itemId,
          columnId,
          value: value as any,
        },
      });

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { ...context, action },
          message: `Updated column value`,
        },
      });
      break;
    }
  }
}

const start = async () => {
  console.log(`[worker] starting ${workerName}`);
  console.log(`[worker] redis: ${redisUrl}`);
};

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`[worker] received ${signal}, shutting down`);
  await worker.close();
  await connection.quit();
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

start().catch((error) => {
  console.error('[worker] failed to start', error);
  process.exit(1);
});
