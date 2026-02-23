#!/usr/bin/env bash
set -euo pipefail

board_data="src/app/_components/board_data.tsx"
workspace_board="src/app/workspace/[id]/board/page.tsx"

if ! rg -n "ColumnManager" "$board_data" "$workspace_board" >/dev/null; then
  echo "Expected ColumnManager to be exposed in board views."
  exit 1
fi

echo "Column manager exposure check: PASS"
