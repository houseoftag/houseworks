import { prisma } from '@/server/db';
import { ColumnType } from '@prisma/client';

const boardInclude = {
  workspace: {
    select: {
      id: true,
      name: true,
    },
  },
  columns: {
    orderBy: { position: 'asc' as const },
  },
  groups: {
    orderBy: { position: 'asc' as const },
    include: {
      items: {
        orderBy: { position: 'asc' as const },
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
} as const;

const CRM_GROUPS = [
  { title: 'Lead', color: '#94a3b8', position: 1 },
  { title: 'Contacted', color: '#3b82f6', position: 2 },
  { title: 'Proposal', color: '#8b5cf6', position: 3 },
  { title: 'Negotiation', color: '#f59e0b', position: 4 },
  { title: 'Won', color: '#22c55e', position: 5 },
  { title: 'Lost', color: '#ef4444', position: 6 },
];

const CRM_COLUMNS: { title: string; type: ColumnType; position: number }[] = [
  { title: 'Deal', type: ColumnType.TEXT, position: 1 },
  { title: 'Client', type: ColumnType.CLIENT, position: 2 },
  { title: 'Value', type: ColumnType.NUMBER, position: 3 },
  { title: 'Probability', type: ColumnType.NUMBER, position: 4 },
];

export async function ensureCrmBoard(workspaceId: string, ownerId: string) {
  // Check for existing CRM board
  const existing = await prisma.board.findFirst({
    where: { workspaceId, boardType: 'CRM' },
    include: boardInclude,
  });

  if (existing) return existing;

  // Create new CRM board with default groups and columns
  const board = await prisma.board.create({
    data: {
      workspaceId,
      ownerId,
      title: 'Pipeline',
      boardType: 'CRM',
      groups: {
        create: CRM_GROUPS,
      },
      columns: {
        create: CRM_COLUMNS,
      },
    },
  });

  // Re-query with full includes
  return prisma.board.findUniqueOrThrow({
    where: { id: board.id },
    include: boardInclude,
  });
}
