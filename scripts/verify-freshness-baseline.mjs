import { PrismaClient } from '@prisma/client';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { isDeepStrictEqual } from 'node:util';

let prisma = null;

function getPrisma() {
  if (!prisma) prisma = new PrismaClient();
  return prisma;
}

const CLIENT_FILE = path.join(process.cwd(), 'src/app/_components/board_data.tsx');
const MAX_PROPAGATION_MS = 10_000;
const POLL_EVERY_MS = 1_000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function assertClientPollingConfigured() {
  const source = await readFile(CLIENT_FILE, 'utf8');

  const checks = [
    {
      label: 'BOARD_FRESHNESS_POLL_MS constant exists',
      pass: source.includes('BOARD_FRESHNESS_POLL_MS'),
    },
    {
      label: 'freshness query options include refetchInterval',
      pass: /const\s+freshnessQueryOptions\s*=\s*\{[\s\S]*refetchInterval:\s*BOARD_FRESHNESS_POLL_MS/.test(source),
    },
    {
      label: 'default board query uses freshness options',
      pass: /trpc\.boards\.getDefault\.useQuery\([\s\S]*\.\.\.freshnessQueryOptions/.test(source),
    },
    {
      label: 'specific board query uses freshness options',
      pass: /trpc\.boards\.getById\.useQuery\([\s\S]*freshnessQueryOptions/.test(source),
    },
    {
      label: 'background polling enabled',
      pass: /refetchIntervalInBackground:\s*true/.test(source),
    },
    {
      label: 'freshness status affordance rendered in board view',
      pass: source.includes('data-testid="board-freshness-status"') && /type\s+FreshnessState\s*=\s*'fresh'\s*\|\s*'refreshing'\s*\|\s*'stale'/.test(source),
    },
    {
      label: 'manual refresh control rendered in board view',
      pass: source.includes('data-testid="board-refresh-button"') && source.includes('Refresh now'),
    },
    {
      label: 'manual refresh wired to invalidate + refetch path',
      pass:
        /utils\.boards\.getDefault\.invalidate\(\)/.test(source) &&
        /utils\.boards\.getById\.invalidate\(\{\s*id:\s*boardId\s*\}\)/.test(source) &&
        /await\s+refetchDefault\(\)/.test(source) &&
        /await\s+refetchSpecific\(\)/.test(source),
    },
    {
      label: 'refreshing state has minimum visible dwell contract',
      pass:
        /const\s+REFRESHING_MIN_VISIBLE_MS\s*=\s*\d+/.test(source) &&
        /refreshingHoldUntilRef\.current\s*=\s*Date\.now\(\)\s*\+\s*REFRESHING_MIN_VISIBLE_MS/.test(source) &&
        /remainingRefreshingMs\s*=\s*Math\.max\(0,\s*\(refreshingHoldUntilRef\.current/.test(source),
    },
    {
      label: 'fresh confirmation window contract exists after refresh completion',
      pass:
        /const\s+FRESH_CONFIRMATION_VISIBLE_MS\s*=\s*\d+/.test(source) &&
        /setFreshnessPhase\('fresh'\)/.test(source) &&
        /setTimeout\(\(\)\s*=>\s*\{\s*setFreshnessPhase\('idle'\)/s.test(source),
    },
    {
      label: 'freshness badge readability polish present',
      pass:
        /data-testid="board-freshness-status"/.test(source) &&
        /text-sm\s+font-bold/.test(source) &&
        /bg-slate-950\/45/.test(source) &&
        /px-3\.5\s+py-1\.5/.test(source),
    },
    {
      label: 'freshness badge accessibility live-region semantics present',
      pass:
        /const\s+liveMode\s*=\s*state\s*===\s*'stale'\s*\?\s*'off'\s*:\s*'polite'/.test(source) &&
        /aria-live=\{liveMode\}/.test(source) &&
        /aria-atomic="true"/.test(source) &&
        /Board data status:/.test(source),
    },
    {
      label: 'manual refresh failure state is visible and transient',
      pass:
        /const\s+REFRESH_FAILURE_VISIBLE_MS\s*=\s*\d+/.test(source) &&
        /setRefreshError\('Refresh failed\. Please retry\.'\)/.test(source) &&
        /setTimeout\(\(\)\s*=>\s*\{\s*setRefreshError\(null\)/s.test(source) &&
        /data-testid="board-refresh-error"/.test(source),
    },
    {
      label: 'last successful refresh cue is rendered after refresh',
      pass:
        /data-testid="board-last-successful-refresh"/.test(source) &&
        /setLastSuccessfulRefreshAt\(new Date\(\)\)/.test(source) &&
        /Last successful refresh:/.test(source),
    },
  ];

  const failed = checks.filter((check) => !check.pass);

  for (const check of checks) {
    console.log(`${check.pass ? 'PASS' : 'FAIL'}: ${check.label}`);
  }

  if (failed.length > 0) {
    throw new Error('Client polling baseline is not fully configured.');
  }
}

async function loadBoardSnapshot(boardId) {
  return getPrisma().board.findUnique({
    where: { id: boardId },
    include: {
      columns: {
        orderBy: { position: 'asc' },
      },
      groups: {
        orderBy: { position: 'asc' },
        include: {
          items: {
            orderBy: { position: 'asc' },
            include: {
              cellValues: true,
            },
          },
        },
      },
    },
  });
}

async function waitFor(label, predicate) {
  const start = Date.now();

  while (Date.now() - start <= MAX_PROPAGATION_MS) {
    if (await predicate()) {
      return Date.now() - start;
    }
    await sleep(POLL_EVERY_MS);
  }

  throw new Error(`${label} was not observed within ${MAX_PROPAGATION_MS / 1000}s SLA`);
}

function hasItem(snapshot, itemId) {
  if (!snapshot) return false;
  return snapshot.groups.some((group) => group.items.some((item) => item.id === itemId));
}

function hasCellValue(snapshot, itemId, columnId, expectedValue) {
  if (!snapshot) return false;

  for (const group of snapshot.groups) {
    const item = group.items.find((candidate) => candidate.id === itemId);
    if (!item) continue;

    const cell = item.cellValues.find((candidate) => candidate.columnId === columnId);
    if (!cell) return false;

    return isDeepStrictEqual(cell.value, expectedValue);
  }

  return false;
}

async function runDataPropagationCheck() {
  const seedBoard = await getPrisma().board.findFirst({
    orderBy: { createdAt: 'asc' },
    include: {
      columns: { orderBy: { position: 'asc' } },
      groups: {
        orderBy: { position: 'asc' },
        include: {
          items: {
            orderBy: { position: 'asc' },
          },
        },
      },
    },
  });

  if (!seedBoard) {
    throw new Error('No board found. Run `npm run db:seed` first.');
  }

  const firstGroup = seedBoard.groups[0];
  if (!firstGroup) {
    throw new Error('Board has no groups. Run `npm run db:seed` first.');
  }

  const targetItem = firstGroup.items[0];
  if (!targetItem) {
    throw new Error('Board group has no items. Run `npm run db:seed` first.');
  }

  const targetColumn =
    seedBoard.columns.find((column) => column.type === 'STATUS') ??
    seedBoard.columns[1] ??
    seedBoard.columns[0];

  if (!targetColumn) {
    throw new Error('Board has no columns.');
  }

  const cellToken = Date.now().toString(36);
  const nextCellValue = {
    label: `CP1-${cellToken}`,
    color: '#0ea5e9',
  };

  const previousCell = await getPrisma().cellValue.findUnique({
    where: {
      itemId_columnId: {
        itemId: targetItem.id,
        columnId: targetColumn.id,
      },
    },
  });

  const createdItemName = `CP1 propagation ${cellToken}`;
  let createdItemId = null;

  const results = [];

  try {
    const cellStartedAt = new Date().toISOString();
    await getPrisma().cellValue.upsert({
      where: {
        itemId_columnId: {
          itemId: targetItem.id,
          columnId: targetColumn.id,
        },
      },
      update: {
        value: nextCellValue,
      },
      create: {
        itemId: targetItem.id,
        columnId: targetColumn.id,
        value: nextCellValue,
      },
    });

    try {
      const cellLatencyMs = await waitFor('Cell edit propagation', async () => {
        const snapshot = await loadBoardSnapshot(seedBoard.id);
        return hasCellValue(snapshot, targetItem.id, targetColumn.id, nextCellValue);
      });
      const observedAt = new Date().toISOString();
      results.push({ scenario: 'cell_edit', pass: true, latencyMs: cellLatencyMs, startedAt: cellStartedAt, observedAt });
    } catch (error) {
      results.push({ scenario: 'cell_edit', pass: false, latencyMs: null, startedAt: cellStartedAt, observedAt: null, error: error instanceof Error ? error.message : String(error) });
    }

    const latestItem = await getPrisma().item.findFirst({
      where: { groupId: firstGroup.id },
      orderBy: { position: 'desc' },
      select: { position: true },
    });

    const itemStartedAt = new Date().toISOString();
    const created = await getPrisma().item.create({
      data: {
        groupId: firstGroup.id,
        name: createdItemName,
        position: (latestItem?.position ?? 0) + 1,
      },
      select: { id: true },
    });

    createdItemId = created.id;

    try {
      const itemLatencyMs = await waitFor('Item create propagation', async () => {
        const snapshot = await loadBoardSnapshot(seedBoard.id);
        return hasItem(snapshot, created.id);
      });
      const observedAt = new Date().toISOString();
      results.push({ scenario: 'item_create', pass: true, latencyMs: itemLatencyMs, startedAt: itemStartedAt, observedAt });
    } catch (error) {
      results.push({ scenario: 'item_create', pass: false, latencyMs: null, startedAt: itemStartedAt, observedAt: null, error: error instanceof Error ? error.message : String(error) });
    }

    for (const result of results) {
      if (result.pass) {
        console.log(`PASS: ${result.scenario} latency=${result.latencyMs}ms started=${result.startedAt} observed=${result.observedAt} SLA<=${MAX_PROPAGATION_MS}ms`);
      } else {
        console.log(`FAIL: ${result.scenario} latency=timeout started=${result.startedAt} observed=n/a SLA<=${MAX_PROPAGATION_MS}ms reason=${result.error}`);
      }
    }

    const failed = results.filter((result) => !result.pass);
    if (failed.length > 0) {
      throw new Error(`Propagation SLA failed for: ${failed.map((result) => result.scenario).join(', ')}`);
    }
  } finally {
    if (previousCell) {
      await getPrisma().cellValue.update({
        where: {
          itemId_columnId: {
            itemId: targetItem.id,
            columnId: targetColumn.id,
          },
        },
        data: {
          value: previousCell.value,
        },
      });
    } else {
      await getPrisma().cellValue.deleteMany({
        where: {
          itemId: targetItem.id,
          columnId: targetColumn.id,
        },
      });
    }

    if (createdItemId) {
      await getPrisma().item.delete({ where: { id: createdItemId } });
    }
  }
}

async function main() {
  const skipDb = process.argv.includes('--skip-db');

  console.log('TUE-CP1 freshness verification start');
  await assertClientPollingConfigured();

  if (skipDb) {
    console.log('SKIP: DB-backed propagation check skipped (--skip-db supplied).');
    console.log('PASS: Static freshness baseline verification complete');
    return;
  }

  try {
    await getPrisma().$queryRaw`SELECT 1`;
  } catch (error) {
    throw new Error(`DB_UNAVAILABLE: ${error instanceof Error ? error.message : error}`);
  }

  await runDataPropagationCheck();
  console.log('PASS: TUE-CP1 reproducible verification complete');
}

main()
  .catch((error) => {
    console.error('FAIL:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (prisma) {
      await prisma.$disconnect();
    }
  });
