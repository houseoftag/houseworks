/**
 * HW-M11: Inline automation rule evaluation engine.
 * Evaluates automation rules synchronously in tRPC mutations
 * for immediate feedback, in addition to the BullMQ worker.
 */
import { prisma } from '@/server/db';
import { AutomationLogStatus } from '@prisma/client';
import { createNotification } from '@/server/notifications';

/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma Json fields require any */

type TriggerEvent = {
  type: 'STATUS_CHANGED' | 'PRIORITY_CHANGED' | 'ASSIGNEE_CHANGED' | 'ITEM_CREATED' | 'DUE_DATE_APPROACHING';
  itemId: string;
  columnId?: string;
  oldValue?: unknown;
  newValue?: unknown;
  userId: string;
  boardId: string;
  workspaceId: string;
};

type AutomationAction = {
  type: 'LOG' | 'NOTIFY' | 'MOVE_TO_GROUP' | 'SET_PERSON' | 'SET_STATUS' | 'SET_COLUMN';
  payload?: Record<string, unknown>;
};

type AutomationTrigger = {
  type: string;
  columnId?: string;
  to?: string;
  from?: string;
};

/**
 * Evaluate all enabled automations for a board given a trigger event.
 * Called inline from tRPC mutations for immediate rule processing.
 */
export async function evaluateAutomations(event: TriggerEvent): Promise<void> {
  const automations = await prisma.automation.findMany({
    where: {
      workspaceId: event.workspaceId,
      boardId: event.boardId,
      enabled: true,
    },
  });

  for (const automation of automations) {
    const trigger = automation.trigger as AutomationTrigger;
    if (!matchesTrigger(trigger, event)) continue;

    const actions = automation.actions as AutomationAction[];
    for (const action of actions) {
      try {
        await executeAction(action, event, automation.id);
      } catch (err) {
        console.error(`[automations] action failed for automation ${automation.id}:`, err);
        await prisma.automationLog.create({
          data: {
            automationId: automation.id,
            status: AutomationLogStatus.FAILED,
            payload: { event, action } as any,
            message: err instanceof Error ? err.message : 'Unknown error',
          },
        });
      }
    }
  }
}

function matchesTrigger(trigger: AutomationTrigger, event: TriggerEvent): boolean {
  if (trigger.type !== event.type) return false;

  // For column-specific triggers, check columnId match
  if (trigger.columnId && trigger.columnId !== event.columnId) return false;

  // Check "to" value match
  if (trigger.to) {
    const newLabel = extractLabel(event.newValue);
    if (newLabel !== trigger.to) return false;
  }

  // Check "from" value match
  if (trigger.from) {
    const oldLabel = extractLabel(event.oldValue);
    if (oldLabel !== trigger.from) return false;
  }

  return true;
}

function extractLabel(value: unknown): string | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.label === 'string') return v.label;
  if (typeof v.userId === 'string') return v.userId;
  return null;
}

async function executeAction(
  action: AutomationAction,
  event: TriggerEvent,
  automationId: string,
): Promise<void> {
  const payload = action.payload ?? {};

  switch (action.type) {
    case 'LOG': {
      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { event } as any,
          message: (payload.message as string) ?? 'Automation executed',
        },
      });
      break;
    }

    case 'NOTIFY': {
      const targetUserIds = payload.userIds as string[] | undefined;
      const message = payload.message as string | undefined;
      const item = await prisma.item.findUnique({
        where: { id: event.itemId },
        select: { name: true },
      });

      let recipients: string[] = [];
      if (targetUserIds?.length) {
        recipients = targetUserIds;
      } else if (payload.notifyAssignee) {
        // Notify whoever is assigned to the item
        const personCells = await prisma.cellValue.findMany({
          where: { itemId: event.itemId, column: { type: 'PERSON' } },
          select: { value: true },
        });
        recipients = personCells
          .map((c) => (c.value as { userId?: string } | null)?.userId)
          .filter((id): id is string => !!id);
      } else {
        // Notify all workspace members except the actor
        const members = await prisma.workspaceMember.findMany({
          where: { workspaceId: event.workspaceId },
          select: { userId: true },
        });
        recipients = members.map((m) => m.userId);
      }

      recipients = recipients.filter((id) => id !== event.userId);

      await Promise.all(
        recipients.map((uid) =>
          createNotification({
            userId: uid,
            type: 'STATUS_CHANGE',
            title: (payload.title as string) ?? 'Automation triggered',
            message: message ?? `Automation triggered on "${item?.name ?? 'Item'}"`,
            itemId: event.itemId,
            boardId: event.boardId,
            link: `/workspace/${event.workspaceId}/board?item=${event.itemId}`,
          }),
        ),
      );

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { event, action, recipientCount: recipients.length } as any,
          message: `Notified ${recipients.length} user(s)`,
        },
      });
      break;
    }

    case 'MOVE_TO_GROUP': {
      const targetGroupId = payload.groupId as string;
      if (!targetGroupId) break;

      // Verify the group exists on the same board
      const group = await prisma.group.findFirst({
        where: { id: targetGroupId, boardId: event.boardId },
      });
      if (!group) break;

      // Get next position
      const lastItem = await prisma.item.findFirst({
        where: { groupId: targetGroupId },
        orderBy: { position: 'desc' },
        select: { position: true },
      });

      await prisma.item.update({
        where: { id: event.itemId },
        data: {
          groupId: targetGroupId,
          position: (lastItem?.position ?? 0) + 1,
        },
      });

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { event, action } as any,
          message: `Moved item to group "${group.title}"`,
        },
      });
      break;
    }

    case 'SET_PERSON': {
      const targetUserId = payload.userId as string;
      const targetColumnId = payload.columnId as string;
      if (!targetUserId || !targetColumnId) break;

      // Get user info for the cell value
      const user = await prisma.user.findUnique({
        where: { id: targetUserId },
        select: { id: true, name: true, image: true },
      });
      if (!user) break;

      await prisma.cellValue.upsert({
        where: {
          itemId_columnId: { itemId: event.itemId, columnId: targetColumnId },
        },
        update: { value: { userId: user.id, name: user.name, image: user.image } as any },
        create: {
          itemId: event.itemId,
          columnId: targetColumnId,
          value: { userId: user.id, name: user.name, image: user.image } as any,
        },
      });

      // Notify the assigned user
      const item = await prisma.item.findUnique({
        where: { id: event.itemId },
        select: { name: true },
      });
      if (targetUserId !== event.userId) {
        await createNotification({
          userId: targetUserId,
          type: 'ASSIGNMENT',
          title: 'Auto-assigned',
          message: `You were automatically assigned to "${item?.name ?? 'Item'}"`,
          itemId: event.itemId,
          boardId: event.boardId,
          link: `/workspace/${event.workspaceId}/board?item=${event.itemId}`,
        });
      }

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { event, action } as any,
          message: `Auto-assigned to ${user.name ?? targetUserId}`,
        },
      });
      break;
    }

    case 'SET_STATUS': {
      const columnId = payload.columnId as string;
      const label = payload.label as string;
      const color = payload.color as string;
      if (!columnId || !label || !color) break;

      await prisma.cellValue.upsert({
        where: {
          itemId_columnId: { itemId: event.itemId, columnId },
        },
        update: { value: { label, color } as any },
        create: {
          itemId: event.itemId,
          columnId,
          value: { label, color } as any,
        },
      });

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { event, action } as any,
          message: `Set status to ${label}`,
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
          itemId_columnId: { itemId: event.itemId, columnId },
        },
        update: { value: value as any },
        create: {
          itemId: event.itemId,
          columnId,
          value: value as any,
        },
      });

      await prisma.automationLog.create({
        data: {
          automationId,
          status: AutomationLogStatus.SUCCESS,
          payload: { event, action } as any,
          message: `Updated column value`,
        },
      });
      break;
    }
  }
}
