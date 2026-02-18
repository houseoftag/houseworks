import { dependenciesRouter } from './routers/dependencies';
import { attachmentsRouter } from './routers/attachments';
import { activityRouter } from './routers/activity';
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
import { searchRouter } from './routers/search';
import { templatesRouter } from './routers/templates';
import { router } from './trpc';

export const appRouter = router({
  dependencies: dependenciesRouter,
  attachments: attachmentsRouter,
  activity: activityRouter,
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
  search: searchRouter,
  templates: templatesRouter,
});

export type AppRouter = typeof appRouter;
