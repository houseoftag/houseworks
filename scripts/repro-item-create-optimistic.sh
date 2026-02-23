#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/board_table.tsx"

if ! rg -n "createItem\\s*=\\s*trpc\\.items\\.create\\.useMutation" "$file" >/dev/null; then
  echo "Missing createItem mutation in $file."
  exit 1
fi

if ! rg -n "onMutate" "$file" >/dev/null; then
  echo "Expected optimistic createItem onMutate in $file."
  exit 1
fi

echo "Create item optimistic check: PASS"
