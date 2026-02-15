import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const board = await prisma.board.findFirst({
        include: {
            columns: true,
            groups: {
                include: {
                    items: true
                }
            }
        }
    });

    console.log('Board:', JSON.stringify(board, null, 2));
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
