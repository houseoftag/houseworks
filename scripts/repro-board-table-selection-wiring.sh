#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/board_table.tsx"

group_block="$(
  awk '
    BEGIN { p = 0 }
    /^function SortableGroup\(/ { p = 1 }
    p { print }
    p && /^export function BoardTable\(/ { exit }
  ' "$file"
)"

if [ -z "$group_block" ]; then
  echo "Board table selection wiring: FAIL"
  echo "Unable to locate SortableGroup block in $file."
  exit 1
fi

if echo "$group_block" | rg -n "handleSelectChange" >/dev/null; then
  echo "Board table selection wiring: FAIL"
  echo "SortableGroup must not reference handleSelectChange directly (it is out of scope)."
  exit 1
fi

if ! rg -n -U "<SortableGroup[\\s\\S]*onSelectChange=\\{handleSelectChange\\}" "$file" >/dev/null; then
  echo "Board table selection wiring: FAIL"
  echo "Expected BoardTable to pass onSelectChange={handleSelectChange} into SortableGroup in $file."
  exit 1
fi

echo "Board table selection wiring: PASS"
