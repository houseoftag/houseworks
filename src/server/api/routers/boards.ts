import { z } from 'zod';
import { prisma } from '@/server/db';
import { logActivity } from '@/server/services/activity';
import { protectedProcedure, router } from '../trpc';
import { TRPCError } from '@trpc/server';
import { ColumnType } from '@prisma/client';

const boardSelect = {
  include: {
    workspace: {
      select: {
        id: true,
        name: true,
      },
    },
    columns: {
      orderBy: { position: 'asc' },
    },
    groups: {
      orderBy: { position: 'asc' },
      include: {
        items: {
          orderBy: { position: 'asc' },
          include: {
            cellValues: {
              include: {
                column: true,
              },
            },
            _count: { select: { attachments: true, dependenciesAsSource: true, dependenciesAsTarget: true } },
            dependenciesAsSource: { select: { id: true, type: true } },
            dependenciesAsTarget: { select: { id: true, type: true } },
          },
        },
      },
    },
  },
} as const;

export const boardsRouter = router({
  getDefault: protectedProcedure.query(async ({ ctx }) => {
    return prisma.board.findFirst({
      where: {
        workspace: {
          members: { some: { userId: ctx.session.user.id } },
        },
      },
      orderBy: { createdAt: 'asc' },
      include: boardSelect.include,
    });
  }),
  listByWorkspace: protectedProcedure
    .input(z.object({ workspaceId: z.string().cuid() }))
    .query(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      return prisma.board.findMany({
        where: { workspaceId: input.workspaceId },
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
        },
      });
    }),
  getById: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .query(({ ctx, input }) => {
      return prisma.board.findFirst({
        where: {
          id: input.id,
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
        include: boardSelect.include,
      });
    }),
  create: protectedProcedure
    .input(
      z.object({
        workspaceId: z.string().cuid(),
        title: z.string().min(1),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = await prisma.workspaceMember.findFirst({
        where: { workspaceId: input.workspaceId, userId: ctx.session.user.id },
      });

      if (!membership) {
        throw new TRPCError({ code: 'FORBIDDEN' });
      }

      const board = await prisma.board.create({
        data: {
          workspaceId: input.workspaceId,
          ownerId: ctx.session.user.id,
          title: input.title,
          description: input.description,
          groups: {
            create: {
              title: 'New Group',
              color: '#3B82F6',
              position: 0,
            },
          },
          columns: {
            create: [
              { title: 'Item', type: ColumnType.TEXT, position: 1 },
              {
                title: 'Status',
                type: ColumnType.STATUS,
                position: 2,
                settings: {
                  options: {
                    'In Progress': '#f97316',
                    Review: '#eab308',
                    Done: '#22c55e',
                    Blocked: '#ef4444',
                  },
                },
              },
              { title: 'Person', type: ColumnType.PERSON, position: 3 },
              { title: 'Date', type: ColumnType.DATE, position: 4 },
            ],
          },
        },
      });

      await logActivity({
        workspaceId: input.workspaceId,
        boardId: board.id,
        userId: ctx.session.user.id,
        type: 'BOARD_CREATED',
        entityType: 'BOARD',
        entityId: board.id,
        metadata: { title: input.title },
      });

      return board;
    }),
  update: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        description: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.id,
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
      });

      if (!board) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      const updated = await prisma.board.update({
        where: { id: input.id },
        data: {
          title: input.title,
          description: input.description,
        },
      });

      await logActivity({
        workspaceId: board.workspaceId,
        boardId: board.id,
        userId: ctx.session.user.id,
        type: 'BOARD_UPDATED',
        entityType: 'BOARD',
        entityId: board.id,
        oldValue: { title: board.title, description: board.description },
        newValue: { title: input.title, description: input.description },
      });

      return updated;
    }),
  dashboardStats: protectedProcedure.query(async ({ ctx }) => {
      // Fetch workspace info with member count
      const workspace = await prisma.workspace.findFirst({
        where: { members: { some: { userId: ctx.session.user.id } } },
        select: {
          id: true,
          name: true,
          _count: { select: { members: true } },
        },
      });

      const boards = await prisma.board.findMany({
        where: {
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          description: true,
          createdAt: true,
          updatedAt: true,
          workspaceId: true,
          workspace: { select: { id: true, name: true } },
          _count: { select: { groups: true } },
          groups: {
            select: {
              items: {
                select: {
                  id: true,
                  updatedAt: true,
                  cellValues: {
                    where: { column: { type: { in: ['STATUS', 'DATE'] } } },
                    select: { value: true, column: { select: { type: true } } },
                  },
                },
              },
            },
          },
        },
      });

      const DONE_LABELS = ['done', 'completed', 'complete', 'finished'];
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      weekStart.setHours(0, 0, 0, 0);

      let totalItems = 0;
      let completedThisWeek = 0;
      let overdueCount = 0;
      const statusCounts: Record<string, number> = {};

      function getStatusLabel(item: { cellValues: { value: unknown; column: { type: string } }[] }): string {
        const statusCell = item.cellValues.find((c) => c.column.type === 'STATUS');
        if (!statusCell) return 'No Status';
        const raw = statusCell.value;
        return (
          (typeof raw === 'object' && raw !== null && 'label' in raw
            ? (raw as Record<string, unknown>).label
            : typeof raw === 'string'
              ? raw
              : null) ?? 'No Status'
        ) as string;
      }

      function getDateValue(item: { cellValues: { value: unknown; column: { type: string } }[] }): Date | null {
        const dateCell = item.cellValues.find((c) => c.column.type === 'DATE');
        if (!dateCell) return null;
        const raw = dateCell.value;
        const str = typeof raw === 'string' ? raw : typeof raw === 'object' && raw !== null && 'date' in raw ? (raw as Record<string, unknown>).date as string : null;
        if (!str) return null;
        const d = new Date(str);
        return isNaN(d.getTime()) ? null : d;
      }

      // Per-board stats
      const boardSummaries = boards.map((board) => {
        let boardItemCount = 0;
        let boardDoneCount = 0;
        let lastItemUpdate: Date | null = null;

        for (const group of board.groups) {
          for (const item of group.items) {
            totalItems++;
            boardItemCount++;
            const statusLabel = getStatusLabel(item);
            statusCounts[statusLabel] = (statusCounts[statusLabel] ?? 0) + 1;

            const isDone = DONE_LABELS.includes(statusLabel.toLowerCase());
            if (isDone) {
              boardDoneCount++;
              // Check if completed this week (use item updatedAt as proxy)
              if (item.updatedAt >= weekStart) {
                completedThisWeek++;
              }
            }

            // Overdue: has a date in the past and is not done
            if (!isDone) {
              const dueDate = getDateValue(item);
              if (dueDate && dueDate < now) {
                overdueCount++;
              }
            }

            if (!lastItemUpdate || item.updatedAt > lastItemUpdate) {
              lastItemUpdate = item.updatedAt;
            }
          }
        }

        return {
          id: board.id,
          title: board.title,
          description: board.description,
          createdAt: board.createdAt,
          updatedAt: lastItemUpdate ?? board.updatedAt,
          workspaceId: board.workspaceId,
          workspaceName: board.workspace.name,
          itemCount: boardItemCount,
          completionPercent: boardItemCount > 0 ? Math.round((boardDoneCount / boardItemCount) * 100) : 0,
        };
      });

      // Recent activity (last 20, deduplicated by type+item within 5s window)
      const rawActivity = workspace
        ? await prisma.activityLog.findMany({
            where: { workspaceId: workspace.id },
            orderBy: { createdAt: 'desc' },
            take: 40, // fetch extra to account for dedup
            include: {
              user: { select: { id: true, name: true, image: true } },
              board: { select: { id: true, title: true } },
              item: { select: { id: true, name: true } },
            },
          })
        : [];
      const recentActivity: typeof rawActivity = [];
      const seen = new Set<string>();
      for (const entry of rawActivity) {
        // Deduplicate same type + item within 5-second window
        const timeKey = Math.floor(new Date(entry.createdAt).getTime() / 5000);
        const key = `${entry.type}:${entry.itemId ?? ''}:${entry.userId}:${timeKey}`;
        if (seen.has(key)) continue;
        seen.add(key);
        recentActivity.push(entry);
        if (recentActivity.length >= 20) break;
      }

      return {
        workspace: workspace
          ? { id: workspace.id, name: workspace.name, memberCount: workspace._count.members }
          : null,
        totalBoards: boards.length,
        totalItems,
        statusCounts,
        completedThisWeek,
        overdueCount,
        recentBoards: boardSummaries.slice(0, 5),
        boardSummaries,
        recentActivity,
      };
    }),
  duplicate: protectedProcedure
    .input(
      z.object({
        id: z.string().cuid(),
        title: z.string().min(1).optional(),
        includeItems: z.boolean().default(false),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const source = await prisma.board.findFirst({
        where: {
          id: input.id,
          workspace: { members: { some: { userId: ctx.session.user.id } } },
        },
        include: {
          columns: { orderBy: { position: 'asc' } },
          groups: {
            orderBy: { position: 'asc' },
            include: {
              items: input.includeItems
                ? {
                    orderBy: { position: 'asc' },
                    include: { cellValues: true },
                  }
                : false,
            },
          },
        },
      });

      if (!source) throw new TRPCError({ code: 'NOT_FOUND' });

      const newBoard = await prisma.board.create({
        data: {
          workspaceId: source.workspaceId,
          ownerId: ctx.session.user.id,
          title: input.title ?? `${source.title} (copy)`,
          description: source.description,
        },
      });

      // Map old column IDs to new column IDs
      const columnIdMap = new Map<string, string>();
      for (const col of source.columns) {
        const newCol = await prisma.column.create({
          data: {
            boardId: newBoard.id,
            title: col.title,
            type: col.type,
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            settings: col.settings as any,
            position: col.position,
          },
        });
        columnIdMap.set(col.id, newCol.id);
      }

      // Create groups (and optionally items)
      for (const grp of source.groups) {
        const newGroup = await prisma.group.create({
          data: {
            boardId: newBoard.id,
            title: grp.title,
            color: grp.color,
            position: grp.position,
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        if (input.includeItems && 'items' in grp && Array.isArray((grp as any).items)) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const item of (grp as any).items as Array<{ name: string; position: number; cellValues: Array<{ columnId: string; value: unknown }> }>) {
            const newItem = await prisma.item.create({
              data: {
                groupId: newGroup.id,
                name: item.name,
                position: item.position,
              },
            });
            for (const cv of item.cellValues) {
              const newColId = columnIdMap.get(cv.columnId);
              if (newColId) {
                await prisma.cellValue.create({
                  data: {
                    itemId: newItem.id,
                    columnId: newColId,
                    value: cv.value ?? undefined,
                  },
                });
              }
            }
          }
        }
      }

      await logActivity({
        workspaceId: source.workspaceId,
        boardId: newBoard.id,
        userId: ctx.session.user.id,
        type: 'BOARD_DUPLICATED',
        entityType: 'BOARD',
        entityId: newBoard.id,
        metadata: { sourceBoardId: source.id, sourceTitle: source.title, newTitle: newBoard.title },
      });

      return newBoard;
    }),
  delete: protectedProcedure
    .input(z.object({ id: z.string().cuid() }))
    .mutation(async ({ ctx, input }) => {
      const board = await prisma.board.findFirst({
        where: {
          id: input.id,
          workspace: {
            members: { some: { userId: ctx.session.user.id } },
          },
        },
      });

      if (!board) {
        throw new TRPCError({ code: 'NOT_FOUND' });
      }

      await logActivity({
        workspaceId: board.workspaceId,
        boardId: board.id,
        userId: ctx.session.user.id,
        type: 'BOARD_DELETED',
        entityType: 'BOARD',
        entityId: board.id,
        metadata: { title: board.title },
      });

      await prisma.board.delete({
        where: { id: input.id },
      });

      return { ok: true };
    }),
});
