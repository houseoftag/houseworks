import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const workspaces = await prisma.workspace.findMany({
        include: {
            members: {
                include: {
                    user: true
                }
            },
            boards: true
        }
    });

    console.log('Workspaces:', JSON.stringify(workspaces, null, 2));

    const users = await prisma.user.findMany();
    console.log('Users:', JSON.stringify(users, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
