import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ColumnType, WorkspaceRole } from '@prisma/client';
import { prisma } from '@/server/db';
import { auth } from '@/server/auth';

export const runtime = 'nodejs';

const bodySchema = z.object({
  name: z.string().trim().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json({ error: 'UNAUTHORIZED' }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid input.' },
      { status: 400 },
    );
  }

  const name =
    parsed.data.name && parsed.data.name.length > 0
      ? parsed.data.name
      : 'Untitled Workspace';

  const created = await prisma.workspace.create({
    data: {
      name,
      ownerId: userId,
      members: {
        create: {
          userId,
          role: WorkspaceRole.OWNER,
        },
      },
      boards: {
        create: {
          ownerId: userId,
          title: 'Show Tracking',
          description: 'Post-production workflow overview',
          groups: {
            create: [
              {
                title: 'In Edit',
                color: '#22c55e',
                position: 1,
              },
              {
                title: 'Ready for Delivery',
                color: '#38bdf8',
                position: 2,
              },
            ],
          },
          columns: {
            create: [
              {
                title: 'Item',
                type: ColumnType.TEXT,
                position: 1,
              },
              {
                title: 'Status',
                type: ColumnType.STATUS,
                position: 2,
                settings: {
                  options: {
                    'In progress': '#f97316',
                    Review: '#eab308',
                    Done: '#22c55e',
                    Blocked: '#ef4444',
                  },
                },
              },
              {
                title: 'Person',
                type: ColumnType.PERSON,
                position: 3,
              },
              {
                title: 'Date',
                type: ColumnType.DATE,
                position: 4,
              },
            ],
          },
        },
      },
    },
    select: { id: true, name: true },
  });

  return NextResponse.json(created);
}

