import { healthRouter } from './routers/health';
import { workspacesRouter } from './routers/workspaces';
import { boardsRouter } from './routers/boards';
import { groupsRouter } from './routers/groups';
import { itemsRouter } from './routers/items';
import { invitesRouter } from './routers/invites';
import { cellsRouter } from './routers/cells';
import { columnsRouter } from './routers/columns';
import { automationsRouter } from './routers/automations';
import { notificationsRouter } from './routers/notifications';
import { router } from './trpc';

export const appRouter = router({
  health: healthRouter,
  workspaces: workspacesRouter,
  boards: boardsRouter,
  groups: groupsRouter,
  items: itemsRouter,
  invites: invitesRouter,
  cells: cellsRouter,
  columns: columnsRouter,
  automations: automationsRouter,
  notifications: notificationsRouter,
});

export type AppRouter = typeof appRouter;
