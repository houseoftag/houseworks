#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/sidebar.tsx"

if rg -n "Select workspace" "$file" >/dev/null; then
  echo "Sidebar workspace dropdown still has a blank/placeholder option."
  exit 1
fi

if ! rg -n "useEffect" "$file" >/dev/null; then
  echo "Expected useEffect to set default workspace selection."
  exit 1
fi

echo "Sidebar workspace default selection check: PASS"
