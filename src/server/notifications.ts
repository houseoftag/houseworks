import { prisma } from '@/server/db';
import type { NotificationType, ActivityType, EntityType } from '@prisma/client';

/**
 * Check whether a notification should be sent to a user.
 * Priority: board-specific pref > global type pref > default (enabled).
 */
export async function shouldNotify(
  userId: string,
  type: NotificationType,
  boardId?: string | null,
): Promise<boolean> {
  // 1. Board-specific + type pref
  if (boardId) {
    const boardTypePref = await prisma.notificationPreference.findUnique({
      where: { userId_type_boardId: { userId, type, boardId } },
      select: { enabled: true },
    });
    if (boardTypePref !== null) return boardTypePref.enabled;
  }

  // 2. Global type pref (boardId = null)
  // Prisma unique on nullable fields: use findFirst
  const globalTypePref = await prisma.notificationPreference.findFirst({
    where: { userId, type, boardId: null },
    select: { enabled: true },
  });
  if (globalTypePref !== null) return globalTypePref.enabled;

  // 3. Default: enabled
  return true;
}

export async function createNotification({
  userId,
  type,
  title,
  message,
  itemId,
  boardId,
  link,
}: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  itemId?: string;
  boardId?: string;
  link?: string;
}) {
  const allowed = await shouldNotify(userId, type, boardId);
  if (!allowed) return null;
  return prisma.notification.create({
    data: { userId, type, title, message, itemId, boardId, link },
  });
}

/**
 * Scans all DATE columns with deadlineMode=true and fires DUE_DATE notifications
 * for overdue items where the linked status column is not complete.
 */
export async function checkDeadlines() {
  const dateColumns = await prisma.column.findMany({
    where: { type: 'DATE' },
    include: {
      board: {
        include: {
          workspace: { include: { members: true } },
        },
      },
    },
  });

  for (const col of dateColumns) {
    const settings = col.settings as {
      deadlineMode?: boolean;
      linkedStatusColumnId?: string;
      completeStatusValue?: string;
      linkedAssigneeColumnId?: string;
    } | null;
    if (!settings?.deadlineMode) continue;

    const linkedStatusColId = settings.linkedStatusColumnId;
    const completeStatusValue = settings.completeStatusValue ?? 'Done';
    const linkedAssigneeColId = settings.linkedAssigneeColumnId;

    const linkedColIds = [linkedStatusColId, linkedAssigneeColId].filter(Boolean) as string[];

    type CellWithItem = {
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

    const cells = (await prisma.cellValue.findMany({
      where: { columnId: col.id },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            cellValues: linkedColIds.length > 0
              ? { where: { columnId: { in: linkedColIds } }, select: { id: true, columnId: true, value: true } }
              : { select: { id: true, columnId: true, value: true }, take: 0 },
          },
        },
      },
    })) as CellWithItem[];

    for (const cell of cells) {
      const dateStr = cell.value;
      if (!dateStr || typeof dateStr !== 'string') continue;
      const deadlineDate = new Date(dateStr + 'T23:59:59');
      if (deadlineDate > new Date()) continue;

      // Check completion
      const statusCell = linkedStatusColId
        ? cell.item.cellValues.find((cv) => cv.columnId === linkedStatusColId)
        : null;
      const statusRaw = statusCell?.value;
      const statusLabel =
        typeof statusRaw === 'object' && statusRaw !== null && 'label' in statusRaw
          ? (statusRaw as { label: string }).label
          : typeof statusRaw === 'string'
            ? statusRaw
            : null;
      if (statusLabel?.toLowerCase() === completeStatusValue.toLowerCase()) continue;

      // Get assignee
      const assigneeCell = linkedAssigneeColId
        ? cell.item.cellValues.find((cv) => cv.columnId === linkedAssigneeColId)
        : null;
      const assigneeRaw = assigneeCell?.value;
      const assigneeId = typeof assigneeRaw === 'object' && assigneeRaw !== null && 'userId' in assigneeRaw
        ? (assigneeRaw as { userId?: string }).userId ?? null
        : null;

      const targets = new Set<string>();
      if (assigneeId) targets.add(assigneeId);
      // Also notify workspace admins/owners
      col.board.workspace.members
        .filter((m) => m.role === 'OWNER' || m.role === 'ADMIN')
        .forEach((m) => targets.add(m.userId));

      for (const targetUserId of targets) {
        await createNotification({
          userId: targetUserId,
          type: 'DUE_DATE',
          title: `Deadline passed: ${cell.item.name}`,
          message: `Item "${cell.item.name}" is overdue.`,
          itemId: cell.itemId,
          boardId: col.boardId,
        });
      }
    }
  }
}

export async function logActivity({
  workspaceId,
  boardId,
  itemId,
  userId,
  type,
  entityType,
  entityId,
  field,
  oldValue,
  newValue,
  metadata,
}: {
  workspaceId: string;
  boardId?: string;
  itemId?: string;
  userId: string;
  type: ActivityType;
  entityType?: EntityType;
  entityId?: string;
  field?: string;
  oldValue?: unknown;
  newValue?: unknown;
  metadata?: unknown;
}) {
  return prisma.activityLog.create({
    data: {
      workspaceId,
      boardId,
      itemId,
      userId,
      type,
      entityType,
      entityId,
      field,
      oldValue: oldValue as object | undefined,
      newValue: newValue as object | undefined,
      metadata: metadata as object | undefined,
    },
  });
}
