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
        };

        if (trigger?.type === 'STATUS_CHANGED') {
          const statusValue =
            typeof value === 'object' && value
              ? (value as { label?: string }).label
              : null;

          if (trigger.columnId === columnId && trigger.to === statusValue) {
            await executeActions(automation, { itemId, columnId, value });
          }
        }
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
          await executeActions(automation, { itemId, groupId });
        }
      }
    }
  },
  {
    connection,
  },
);

async function executeActions(automation: any, context: any) {
  const actions = automation.actions as any[];
  for (const action of actions) {
    if (action.type === 'LOG') {
      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          status: AutomationLogStatus.SUCCESS,
          payload: context,
          message: action.payload?.message ?? 'Automation executed',
        },
      });
    }

    if (action.type === 'SET_STATUS') {
      const { columnId, label, color } = action.payload as {
        columnId: string;
        label: string;
        color: string;
      };

      await prisma.cellValue.upsert({
        where: {
          itemId_columnId: {
            itemId: context.itemId,
            columnId,
          },
        },
        update: {
          value: { label, color },
        },
        create: {
          itemId: context.itemId,
          columnId,
          value: { label, color },
        },
      });

      // Notify item owner if it's a person column assignment
      const item = await prisma.item.findUnique({
        where: { id: context.itemId },
        include: { cellValues: true }
      });

      const personCell = item?.cellValues.find(cv => {
        const val = cv.value as any;
        return val && typeof val === 'object' && 'userId' in val;
      });

      if (personCell) {
        const userId = (personCell.value as any).userId;
        await prisma.notification.create({
          data: {
            userId,
            title: 'Item Status Updated',
            message: `Status for "${item?.name}" has been automatically set to ${label}.`,
          }
        });
      }

      await prisma.automationLog.create({
        data: {
          automationId: automation.id,
          status: AutomationLogStatus.SUCCESS,
          payload: { ...context, action },
          message: `Set status to ${label}`,
        },
      });
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
