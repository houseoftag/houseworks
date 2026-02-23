#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/board_table.tsx"

if ! rg -n "New Group" "$file" >/dev/null; then
  echo "Missing New Group control in $file."
  exit 1
fi

echo "Board create group button check: PASS"
