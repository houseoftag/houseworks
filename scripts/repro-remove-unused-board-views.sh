#!/usr/bin/env bash
set -euo pipefail

files=(
  "src/app/_components/board_kanban.tsx"
  "src/app/_components/board_kanban_full.tsx"
  "src/app/_components/board_timeline.tsx"
)

missing=0
for file in "${files[@]}"; do
  if [[ -f "$file" ]]; then
    echo "Unused board view file still present: $file"
    missing=1
  fi
done

if rg -n "BoardFiltersBar" "src/app/_components/board_filters.tsx" >/dev/null; then
  echo "BoardFiltersBar still present in src/app/_components/board_filters.tsx"
  missing=1
fi

if [[ "$missing" -ne 0 ]]; then
  echo "Unused board views cleanup check: FAIL"
  exit 1
fi

echo "Unused board views cleanup check: PASS"
