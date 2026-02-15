import { prisma } from '../src/server/db';
import { z } from 'zod';

async function main() {
    const schema = z.object({ workspaceId: z.string().cuid() });

    const testIds = [
        'cmla2njo5000poqvvfyt53q1c', // The one from the log
        '',
        null,
        undefined,
    ];

    for (const id of testIds) {
        const parsed = schema.safeParse({ workspaceId: id });
        console.log(`Testing ID: [${id}] - Success: ${parsed.success}`);
        if (!parsed.success) {
            console.log('Errors:', parsed.error.format());
        }
    }

    await prisma.$disconnect();
}

main();
