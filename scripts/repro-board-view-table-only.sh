#!/usr/bin/env bash
set -euo pipefail

files=(
  "src/app/_components/board_header.tsx"
  "src/app/_components/board_data.tsx"
  "src/app/workspace/[id]/board/page.tsx"
)

missing=0

for file in "${files[@]}"; do
  if rg -n "BoardKanban|BoardKanbanFull|BoardTimeline|Timeline View|Board View" "$file" >/dev/null; then
    echo "Found board/timeline view remnants in $file (should be table-only)."
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Board view table-only check: FAIL"
  exit 1
fi

echo "Board view table-only check: PASS"
