#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/board_table.tsx"

must_have=(
  "data-select-all"
  "data-row-select"
  "sticky"
  "Filters"
  "showFilters"
)

for needle in "${must_have[@]}"; do
  if ! rg -n "$needle" "$file" >/dev/null; then
    echo "Monday table basics: FAIL"
    echo "Missing \"$needle\" in $file."
    exit 1
  fi
done

echo "Monday table basics: PASS"

