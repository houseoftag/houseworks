#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/board_table.tsx"

needles=(
  "columns\\.update"
  "renamingColumnId"
  "data-column-title-input"
  "onDoubleClick"
)

for needle in "${needles[@]}"; do
  if ! rg -n "$needle" "$file" >/dev/null; then
    echo "Inline column edit: FAIL"
    echo "Missing \"$needle\" in $file."
    exit 1
  fi
done

echo "Inline column edit: PASS"

