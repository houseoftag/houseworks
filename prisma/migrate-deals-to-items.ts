/**
 * One-time migration: Convert Deal records to Board Items on the CRM board.
 *
 * Run: npx tsx prisma/migrate-deals-to-items.ts
 *
 * This script:
 * 1. For each workspace, ensures a CRM board exists (via ensureCrmBoard)
 * 2. Maps each DealStage to the corresponding CRM board group
 * 3. Creates Items from Deals with proper cell values
 * 4. Deletes the original Deal records after successful migration
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STAGE_TO_GROUP_INDEX: Record<string, number> = {
  LEAD: 0,
  CONTACTED: 1,
  PROPOSAL: 2,
  NEGOTIATION: 3,
  WON: 4,
  LOST: 5,
};

async function main() {
  // Get all workspaces that have deals
  const workspacesWithDeals = await prisma.workspace.findMany({
    where: {
      clients: {
        some: {
          deals: { some: {} },
        },
      },
    },
    include: {
      members: { take: 1, orderBy: { createdAt: 'asc' } },
    },
  });

  if (workspacesWithDeals.length === 0) {
    console.log('No workspaces with deals found. Nothing to migrate.');
    return;
  }

  for (const workspace of workspacesWithDeals) {
    const ownerId = workspace.members[0]?.userId ?? workspace.ownerId;
    console.log(`\nMigrating workspace: ${workspace.name} (${workspace.id})`);

    // Ensure CRM board exists
    let crmBoard = await prisma.board.findFirst({
      where: { workspaceId: workspace.id, boardType: 'CRM' },
      include: {
        groups: { orderBy: { position: 'asc' } },
        columns: { orderBy: { position: 'asc' } },
      },
    });

    if (!crmBoard) {
      // Import and use ensureCrmBoard
      const { ensureCrmBoard } = await import('../src/server/crm/ensure_crm_board');
      const board = await ensureCrmBoard(workspace.id, ownerId);
      crmBoard = await prisma.board.findUniqueOrThrow({
        where: { id: board.id },
        include: {
          groups: { orderBy: { position: 'asc' } },
          columns: { orderBy: { position: 'asc' } },
        },
      });
    }

    // Find column IDs
    const clientCol = crmBoard.columns.find((c) => c.type === 'CLIENT');
    const valueCol = crmBoard.columns.find((c) => c.title.toLowerCase().includes('value'));
    const probCol = crmBoard.columns.find((c) => c.title.toLowerCase().includes('probability'));

    // Get all deals for this workspace
    const deals = await prisma.deal.findMany({
      where: { client: { workspaceId: workspace.id } },
      include: { client: { select: { id: true, displayName: true } } },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`  Found ${deals.length} deals to migrate`);

    for (const [idx, deal] of deals.entries()) {
      const groupIndex = STAGE_TO_GROUP_INDEX[deal.stage] ?? 0;
      const group = crmBoard.groups[groupIndex];

      if (!group) {
        console.warn(`  Skipping deal "${deal.title}" — no group for stage ${deal.stage}`);
        continue;
      }

      // Create item
      const item = await prisma.item.create({
        data: {
          groupId: group.id,
          name: deal.title,
          clientId: deal.clientId,
          position: idx + 1,
        },
      });

      // Create cell values
      const cellData: { itemId: string; columnId: string; value: any }[] = [];

      if (clientCol) {
        cellData.push({ itemId: item.id, columnId: clientCol.id, value: deal.clientId });
      }
      if (valueCol && deal.value != null) {
        cellData.push({ itemId: item.id, columnId: valueCol.id, value: deal.value });
      }
      if (probCol && deal.probability != null) {
        cellData.push({ itemId: item.id, columnId: probCol.id, value: deal.probability });
      }

      if (cellData.length > 0) {
        await prisma.$transaction(
          cellData.map((cv) =>
            prisma.cellValue.create({ data: cv })
          )
        );
      }

      console.log(`  Migrated deal "${deal.title}" → item ${item.id} (stage: ${deal.stage} → group: ${group.title})`);
    }

    // Delete migrated deals
    const deleted = await prisma.deal.deleteMany({
      where: { client: { workspaceId: workspace.id } },
    });
    console.log(`  Deleted ${deleted.count} deal records`);
  }

  console.log('\nMigration complete!');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
