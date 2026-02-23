#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/board_table.tsx"

if ! rg -n "data-sort-header" "$file" >/dev/null; then
  echo "Missing sortable column headers in $file."
  exit 1
fi

echo "Board header sort check: PASS"
