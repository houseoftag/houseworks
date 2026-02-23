#!/usr/bin/env bash
set -euo pipefail

file="src/app/_components/dashboard.tsx"

if rg -n "TemplateGallery" "$file" >/dev/null; then
  echo "Found TemplateGallery in $file (should be removed)."
  exit 1
fi

echo "Dashboard template gallery removal check: PASS"
