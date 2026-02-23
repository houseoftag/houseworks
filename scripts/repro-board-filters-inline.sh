#!/usr/bin/env bash
set -euo pipefail

board_data="src/app/_components/board_data.tsx"
workspace_board="src/app/workspace/[id]/board/page.tsx"
board_table="src/app/_components/board_table.tsx"

if rg -n "BoardFiltersBar" "$board_data" "$workspace_board" >/dev/null; then
  echo "Found BoardFiltersBar usage in board views (should be removed)."
  exit 1
fi

if ! rg -n "data-filter-control" "$board_table" >/dev/null; then
  echo "Missing inline filter controls in $board_table."
  exit 1
fi

echo "Board inline filters check: PASS"
