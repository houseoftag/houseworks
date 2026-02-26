/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Json fields require any */
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient, AutomationLogStatus } from '@prisma/client';
import { syncAllEmails } from '@/server/crm/email_sync';
import { syncQuickBooks } from '@/server/crm/quickbooks';

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

// --- Deadline check helpers ---

interface DeadlineDateColSettings {
  deadlineMode?: boolean;
  linkedStatusColumnId?: string;
  completeStatusValue?: string;
  linkedAssigneeColumnId?: string;
}

async function checkDeadlines() {
  // Find all DATE columns with deadlineMode enabled
  const dateColumns = await prisma.column.findMany({
    where: { type: 'DATE' },
  });

  for (const col of dateColumns) {
    const settings = col.settings as DeadlineDateColSettings | null;
    if (!settings?.deadlineMode) continue;

    const linkedStatusColumnId = settings.linkedStatusColumnId;
    const linkedAssigneeColumnId = settings.linkedAssigneeColumnId;
    const completeStatusValue = settings.completeStatusValue ?? 'Done';

    const linkedColumnIds = [linkedStatusColumnId, linkedAssigneeColumnId].filter((id): id is string => !!id);

    type DeadlineCellRow = {
      id: string;
      itemId: string;
      columnId: string;
      value: unknown;
      item: {
        id: string;
        name: string;
        cellValues: { id: string; columnId: string; value: unknown }[];
      };
    };

    const overdueCells = (await prisma.cellValue.findMany({
      where: { columnId: col.id },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            cellValues: linkedColumnIds.length > 0
              ? { where: { columnId: { in: linkedColumnIds } }, select: { id: true, columnId: true, value: true } }
              : { select: { id: true, columnId: true, value: true }, take: 0 },
          },
        },
      },
    })) as DeadlineCellRow[];

    for (const cell of overdueCells) {
      const dateStr = cell.value;
      if (!dateStr || typeof dateStr !== 'string') continue;
      const deadlineDate = new Date(dateStr + 'T23:59:59');
      if (deadlineDate > new Date()) continue; // not overdue

      // Check status
      const statusCell = linkedStatusColumnId
        ? cell.item.cellValues.find((cv) => cv.columnId === linkedStatusColumnId)
        : null;
      const statusRaw = statusCell?.value;
      const statusLabel = typeof statusRaw === 'object' && statusRaw !== null && 'label' in statusRaw
        ? (statusRaw as { label: string }).label
        : typeof statusRaw === 'string' ? statusRaw : null;
      if (statusLabel?.toLowerCase() === completeStatusValue.toLowerCase()) continue; // complete

      // Get assignee if linked
      const assigneeCell = linkedAssigneeColumnId
        ? cell.item.cellValues.find((cv) => cv.columnId === linkedAssigneeColumnId)
        : null;
      const assigneeRaw = assigneeCell?.value;
      const assigneeId = typeof assigneeRaw === 'object' && assigneeRaw !== null && 'userId' in assigneeRaw
        ? (assigneeRaw as { userId?: string }).userId ?? null
        : null;

      if (assigneeId) {
        // Check if a DUE_DATE notification for this item was already created recently (within 24h) to avoid spam
        const recentNotif = await prisma.notification.findFirst({
          where: {
            userId: assigneeId,
            type: 'DUE_DATE',
            itemId: cell.itemId,
            createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
          },
        });
        if (recentNotif) continue;

        await prisma.notification.create({
          data: {
            userId: assigneeId,
            type: 'DUE_DATE',
            title: `Deadline passed: ${cell.item.name}`,
            message: `Item "${cell.item.name}" is overdue.`,
            itemId: cell.itemId,
            boardId: col.boardId,
          },
        });
        console.log(`[deadline] notified user ${assigneeId} — item "${cell.item.name}" is overdue`);
      }
    }
  }
}

// --- Deadline BullMQ queue ---
const deadlineQueue = new Queue('deadline', { connection });
const deadlineWorker = new Worker(
  'deadline',
  async (job) => {
    console.log(`[deadline-worker] job ${job.name} ${job.id}`);
    if (job.name === 'deadline.check') {
      await checkDeadlines();
    }
  },
  { connection },
);

// --- Cron automation queue ---
const cronQueue = new Queue('automation-cron', { connection });

/** Build a cron expression from an automation's trigger fields */
function buildCronPattern(trigger: {
  type: string;
  intervalHours?: number;
  time?: string;
  dayOfWeek?: string;
}): string | null {
  if (trigger.type === 'CRON_INTERVAL') {
    const hours = Math.max(1, Math.min(168, trigger.intervalHours ?? 24));
    return `0 */${hours} * * *`;
  }
  if (trigger.type === 'CRON_DAILY') {
    const [hh = '9', mm = '0'] = (trigger.time ?? '09:00').split(':');
    return `${mm} ${hh} * * *`;
  }
  if (trigger.type === 'CRON_WEEKLY') {
    const [hh = '9', mm = '0'] = (trigger.time ?? '09:00').split(':');
    const dow = trigger.dayOfWeek ?? '1';
    return `${mm} ${hh} * * ${dow}`;
  }
  return null;
}

/** Register a BullMQ repeating job for a cron automation */
async function registerCronAutomation(automationId: string) {
  const automation = await prisma.automation.findUnique({ where: { id: automationId } });
  if (!automation || !automation.enabled) return;

  const trigger = automation.trigger as {
    type?: string;
    intervalHours?: number;
    time?: string;
    dayOfWeek?: string;
  };

  if (!trigger?.type) return;
  const pattern = buildCronPattern(trigger as { type: string; intervalHours?: number; time?: string; dayOfWeek?: string });
  if (!pattern) return;

  const jobName = `automation.cron.${automationId}`;
  // Remove any existing repeating job for this automation first
  await unregisterCronAutomation(automationId);

  await cronQueue.add(
    jobName,
    { automationId },
    {
      repeat: { pattern },
      jobId: jobName,
    },
  );
  console.log(`[worker] registered cron job ${jobName} with pattern ${pattern}`);
}

/** Remove a BullMQ repeating job for a cron automation */
async function unregisterCronAutomation(automationId: string) {
  const jobName = `automation.cron.${automationId}`;
  const repeatableJobs = await cronQueue.getRepeatableJobs();
  const existing = repeatableJobs.find((j) => j.name === jobName);
  if (existing) {
    await cronQueue.removeRepeatableByKey(existing.key);
    console.log(`[worker] removed cron job ${jobName}`);
  }
}

const cronWorker = new Worker(
  'automation-cron',
  async (job) => {
    const { automationId } = job.data as { automationId: string };
    console.log(`[cron-worker] executing automation ${automationId}`);

    const automation = await prisma.automation.findUnique({ where: { id: automationId } });
    if (!automation || !automation.enabled) return;

    // For cron automations, find all items on the board and execute actions on each
    if (!automation.boardId) return;

    const items = await prisma.item.findMany({
      where: { group: { boardId: automation.boardId } },
      include: { group: { select: { boardId: true, board: { select: { workspaceId: true } } } } },
    });

    for (const item of items) {
      await executeActions(automation, {
        itemId: item.id,
        boardId: item.group.boardId,
        workspaceId: item.group.board.workspaceId,
      });
    }
  },
  { connection },
);

// --- CRM sync queue ---
const crmQueue = new Queue('crm', { connection });

const crmWorker = new Worker(
  'crm',
  async (job) => {
    console.log(`[crm-worker] job ${job.name} ${job.id}`);
    if (job.name === 'crm.email_sync') {
      await syncAllEmails();
    } else if (job.name === 'crm.quickbooks_sync') {
      const { workspaceId } = job.data as { workspaceId?: string };
      if (workspaceId) {
        await syncQuickBooks(workspaceId);
      } else {
        // Sync all workspaces with QB integration
        const integrations = await prisma.quickBooksIntegration.findMany({ select: { workspaceId: true } });
        for (const { workspaceId: wsId } of integrations) {
          await syncQuickBooks(wsId);
        }
      }
    }
  },
  { connection },
);

const start = async () => {
  console.log(`[worker] starting ${workerName}`);
  console.log(`[worker] redis: ${redisUrl}`);

  // Schedule hourly deadline check (stable jobId prevents duplicates)
  await deadlineQueue.add(
    'deadline.check',
    {},
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'deadline.check',
    },
  );
  console.log('[worker] deadline.check job scheduled (hourly)');

  // Schedule hourly CRM email sync
  await crmQueue.add(
    'crm.email_sync',
    {},
    {
      repeat: { pattern: '0 * * * *' },
      jobId: 'crm.email_sync',
    },
  );
  console.log('[worker] crm.email_sync job scheduled (hourly)');

  // Schedule daily QuickBooks sync (2am)
  await crmQueue.add(
    'crm.quickbooks_sync',
    {},
    {
      repeat: { pattern: '0 2 * * *' },
      jobId: 'crm.quickbooks_sync',
    },
  );
  console.log('[worker] crm.quickbooks_sync job scheduled (daily 2am)');

  // Register cron automations from DB on startup
  const cronTypes = ['CRON_INTERVAL', 'CRON_DAILY', 'CRON_WEEKLY'];
  const cronAutomations = await prisma.automation.findMany({
    where: { enabled: true },
  });
  let registered = 0;
  for (const automation of cronAutomations) {
    const trigger = automation.trigger as { type?: string } | null;
    if (trigger?.type && cronTypes.includes(trigger.type)) {
      await registerCronAutomation(automation.id);
      registered++;
    }
  }
  if (registered > 0) {
    console.log(`[worker] registered ${registered} cron automation(s) from DB`);
  }
};

const shutdown = async (signal: NodeJS.Signals) => {
  console.log(`[worker] received ${signal}, shutting down`);
  await worker.close();
  await deadlineWorker.close();
  await deadlineQueue.close();
  await cronWorker.close();
  await cronQueue.close();
  await crmWorker.close();
  await crmQueue.close();
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
