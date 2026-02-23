#!/usr/bin/env bash
set -euo pipefail

file="src/server/api/routers/boards.ts"

create_block="$(
  awk '
    BEGIN { p = 0 }
    /^[[:space:]]*create:[[:space:]]*protectedProcedure/ { p = 1 }
    p { print }
    p && /^[[:space:]]*update:[[:space:]]*protectedProcedure/ { exit }
  ' "$file"
)"

if [ -z "$create_block" ]; then
  echo "Board default columns check: FAIL"
  echo "Expected a create procedure in $file."
  exit 1
fi

if echo "$create_block" | rg -n "columns:" >/dev/null \
  && echo "$create_block" | rg -n "ColumnType\\.TEXT" >/dev/null; then
  echo "Board default columns check: PASS"
  exit 0
fi

echo "Board default columns check: FAIL"
echo "Expected boards.create to create default columns in $file (columns: { create: [...] })."
exit 1
