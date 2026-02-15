import { prisma } from '../src/server/db';
import { ColumnType, WorkspaceRole } from '@prisma/client';

async function main() {
    const admin = await prisma.user.findFirst({
        where: { email: 'admin@houseworks.local' },
    });

    if (!admin) {
        console.error('Admin user not found');
        return;
    }

    const workspaceName = 'Script Test Workspace';

    try {
        const created = await prisma.workspace.create({
            data: {
                name: workspaceName,
                ownerId: admin.id,
                members: {
                    create: {
                        userId: admin.id,
                        role: WorkspaceRole.OWNER,
                    },
                },
                boards: {
                    create: {
                        ownerId: admin.id,
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
        });
        console.log('Successfully created workspace:', created.id);
    } catch (error) {
        console.error('Failed to create workspace:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
