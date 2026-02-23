#!/usr/bin/env bash
set -euo pipefail

files=(
  "src/app/_components/board_data.tsx"
  "src/app/workspace/[id]/board/page.tsx"
  "src/app/_components/board_filters.tsx"
)

missing=0

for file in "${files[@]}"; do
  if ! rg -n "manual" "$file" >/dev/null; then
    echo "Expected manual sort handling in $file."
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Manual sort default check: FAIL"
  exit 1
fi

echo "Manual sort default check: PASS"
