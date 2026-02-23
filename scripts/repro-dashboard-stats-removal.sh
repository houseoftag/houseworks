#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/dashboard.tsx"
missing=0

declare -a labels=(
  "Total Boards"
  "Total Items"
  "Completed This Week"
  "Overdue"
  "Items by Status"
)

for label in "${labels[@]}"; do
  if rg -n --fixed-strings "$label" "$file" >/dev/null; then
    echo "Found '$label' in $file (should be removed)."
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Dashboard stats removal check: FAIL"
  exit 1
fi

echo "Dashboard stats removal check: PASS"
