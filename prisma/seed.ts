import {
  PrismaClient,
  ColumnType,
  UserRole,
  WorkspaceRole,
} from '@prisma/client';
import { hash } from 'bcryptjs';

const prisma = new PrismaClient();

const seed = async () => {
  const adminEmail = 'admin@houseworks.local';

  const seedPassword = process.env.SEED_ADMIN_PASSWORD ?? 'password123';
  const passwordHash = await hash(seedPassword, 10);

  // ID must match DEV_USER in src/server/auth.ts so JWT sessions survive DB resets
  const adminId = 'cmlqnrgse0000qllgyecbq645';

  const user = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: 'Houseworks Admin',
      role: UserRole.ADMIN,
      passwordHash,
    },
    create: {
      id: adminId,
      email: adminEmail,
      name: 'Houseworks Admin',
      role: UserRole.ADMIN,
      passwordHash,
    },
  });

  let workspace = await prisma.workspace.findFirst({
    where: { name: 'Post-Production' },
  });

  if (!workspace) {
    workspace = await prisma.workspace.create({
      data: {
        name: 'Post-Production',
        ownerId: user.id,
      },
    });
  }

  await prisma.workspaceMember.upsert({
    where: {
      workspaceId_userId: {
        workspaceId: workspace.id,
        userId: user.id,
      },
    },
    update: {
      role: WorkspaceRole.OWNER,
    },
    create: {
      workspaceId: workspace.id,
      userId: user.id,
      role: WorkspaceRole.OWNER,
    },
  });

  let board = await prisma.board.findFirst({
    where: { workspaceId: workspace.id, title: 'Show Tracking' },
    include: {
      groups: {
        include: { items: true },
      },
      columns: true,
    },
  });

  if (!board) {
    board = await prisma.board.create({
      data: {
        workspaceId: workspace.id,
        ownerId: user.id,
        title: 'Show Tracking',
        description: 'Post-production workflow overview',
        groups: {
          create: [
            {
              title: 'In Edit',
              color: '#22c55e',
              position: 1,
              items: {
                create: [
                  {
                    name: 'Episode 04 – Color pass',
                    position: 1,
                  },
                  {
                    name: 'Teaser cutdown',
                    position: 2,
                  },
                ],
              },
            },
            {
              title: 'Ready for Delivery',
              color: '#38bdf8',
              position: 2,
              items: {
                create: [
                  {
                    name: 'Trailer v2',
                    position: 1,
                  },
                ],
              },
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
                  done: 'green',
                  review: 'yellow',
                  blocked: 'red',
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
      include: {
        groups: {
          include: { items: true },
        },
        columns: true,
      },
    });
  }

  const statusColumn = board.columns.find(
    (column) => column.type === ColumnType.STATUS,
  );
  const personColumn = board.columns.find(
    (column) => column.type === ColumnType.PERSON,
  );
  const dateColumn = board.columns.find(
    (column) => column.type === ColumnType.DATE,
  );

  const initials = user.name
    ? user.name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase()
    : 'TA';

  if (statusColumn) {
    await prisma.column.update({
      where: { id: statusColumn.id },
      data: {
        settings: {
          options: {
            'In Progress': '#f97316',
            Review: '#eab308',
            Done: '#22c55e',
            Blocked: '#ef4444',
          },
        },
      },
    });
  }

  const itemValues = new Map([
    [
      'Episode 04 – Color pass',
      {
        status: { label: 'In Progress', color: '#f97316' },
        date: '2026-02-03',
      },
    ],
    [
      'Teaser cutdown',
      {
        status: { label: 'Review', color: '#eab308' },
        date: '2026-02-05',
      },
    ],
    [
      'Trailer v2',
      {
        status: { label: 'Done', color: '#22c55e' },
        date: '2026-01-28',
      },
    ],
  ]);

  for (const group of board.groups) {
    for (const item of group.items) {
      const values = itemValues.get(item.name);
      if (!values) {
        continue;
      }

      if (statusColumn) {
        await prisma.cellValue.upsert({
          where: {
            itemId_columnId: {
              itemId: item.id,
              columnId: statusColumn.id,
            },
          },
          update: {
            value: values.status,
          },
          create: {
            itemId: item.id,
            columnId: statusColumn.id,
            value: values.status,
          },
        });
      }

      if (personColumn) {
        await prisma.cellValue.upsert({
          where: {
            itemId_columnId: {
              itemId: item.id,
              columnId: personColumn.id,
            },
          },
          update: {
            value: {
              userId: user.id,
              name: user.name,
              initials,
            },
          },
          create: {
            itemId: item.id,
            columnId: personColumn.id,
            value: {
              userId: user.id,
              name: user.name,
              initials,
            },
          },
        });
      }

      if (dateColumn) {
        await prisma.cellValue.upsert({
          where: {
            itemId_columnId: {
              itemId: item.id,
              columnId: dateColumn.id,
            },
          },
          update: {
            value: values.date,
          },
          create: {
            itemId: item.id,
            columnId: dateColumn.id,
            value: values.date,
          },
        });
      }
    }
  }

  if (statusColumn) {
    const existingAutomation = await prisma.automation.findFirst({
      where: {
        workspaceId: workspace.id,
        name: 'Notify when Done',
      },
    });

    if (!existingAutomation) {
      await prisma.automation.create({
        data: {
          workspaceId: workspace.id,
          boardId: board.id,
          name: 'Notify when Done',
          trigger: {
            type: 'STATUS_CHANGED',
            columnId: statusColumn.id,
            to: 'Done',
          },
          actions: [
            {
              type: 'LOG',
              message: 'Status moved to Done',
            },
          ],
        },
      });
    }
  }

  console.log('Seed complete.');
};

seed()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
