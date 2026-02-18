import { prisma } from '@/server/db';
import type { NotificationType, ActivityType, EntityType } from '@prisma/client';

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
  return prisma.notification.create({
    data: { userId, type, title, message, itemId, boardId, link },
  });
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
