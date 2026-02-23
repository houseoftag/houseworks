#!/usr/bin/env bash
set -euo pipefail

files=(
  "src/app/_components/board_data.tsx"
  "src/app/workspace/[id]/board/page.tsx"
  "src/app/_components/board_header.tsx"
)

missing=0

for file in "${files[@]}"; do
  if ! rg -n "AutomationPanel|onManageAutomations|Automations" "$file" >/dev/null; then
    echo "Missing automation controls in $file."
    missing=1
  fi
done

if [[ "$missing" -ne 0 ]]; then
  echo "Automation panel exposure check: FAIL"
  exit 1
fi

echo "Automation panel exposure check: PASS"
