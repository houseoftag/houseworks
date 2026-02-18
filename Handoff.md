# HANDOFF.md - Houseworks Development Handoff

## Current State: M15 Complete (Dashboard Analytics & Reporting)

### Recent Changes (M15)
- **API (`boards.dashboardStats`)**:
  - Added `completedThisWeek`: counts items with Done/Completed status updated this week
  - Added `overdueCount`: items with a DATE column value in the past that aren't done
  - Added `boardSummaries[]`: all boards with `itemCount`, `completionPercent`, `updatedAt`
  - Added `recentActivity[]`: last 20 activity log entries with user/board/item joins
  - Boards now sorted by `updatedAt` desc
- **UI (`dashboard.tsx`)**:
  - **5 stats cards**: Total Boards, Total Items, Completed This Week, Overdue, Items by Status
  - **Board Summary Cards**: grid layout with completion progress bar, item count, last updated
  - **Recent Activity Timeline**: inline on overview tab (last 20), links to full Activity tab
  - **Quick Actions** in workspace header: + New Board, + New Item (board selector dialog → creates in first group), 👤 Invite Member (email dialog)
  - **CreateItemDialog**: picks board, fetches first group via `boards.getById`, creates item
  - **InviteMemberDialog**: email input, calls `invites.create`
  - Responsive: 2→3→5 column grid for stats, 2→3 column grid for board cards

### Key Files
- `src/server/api/routers/boards.ts`: `dashboardStats` procedure (enhanced)
- `src/app/_components/dashboard.tsx`: Main dashboard component (rewritten)
- `src/app/_components/activity_feed.tsx`: Full paginated activity feed (unchanged)

### Architecture Notes
- "Completed" detection: status label case-insensitive match against `['done', 'completed', 'complete', 'finished']`
- "Overdue" detection: DATE column value < now AND item not in done status
- `completedThisWeek` uses `item.updatedAt >= weekStart` as proxy for completion date
- Board summaries include all boards (not just recent 5)

### Next Steps
- Consider caching dashboardStats (it does N+1-ish queries for large workspaces)
- Add skeleton loading for board summary cards
- Consider adding sparkline charts for weekly trends
