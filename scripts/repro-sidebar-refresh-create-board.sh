#!/usr/bin/env bash
set -euo pipefail

file="src/app/page.tsx"

if rg -n "boards\\.listByWorkspace\\.invalidate" "$file" >/dev/null; then
  echo "Sidebar refresh check: PASS"
  exit 0
fi

echo "Sidebar refresh check: FAIL"
echo "Expected boards.listByWorkspace.invalidate() after create board success in $file."
exit 1
