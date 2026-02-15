#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://localhost:3002}"

echo "Checking NextAuth session endpoint: $base_url/api/auth/session"

tmp_headers="$(mktemp)"
tmp_body="$(mktemp)"
cleanup() {
  rm -f "$tmp_headers" "$tmp_body"
}
trap cleanup EXIT

set +e
curl_exit=0
curl -sS --max-time 8 -D "$tmp_headers" -o "$tmp_body" "$base_url/api/auth/session"
curl_exit=$?
set -e

if [ "$curl_exit" -ne 0 ]; then
  echo "FAIL: curl exited with $curl_exit (endpoint likely hanging or unreachable)" >&2
  exit 1
fi

status="$(head -n 1 "$tmp_headers" | awk '{print $2}')"
if [ "$status" != "200" ]; then
  echo "FAIL: expected 200, got $status" >&2
  sed -n '1,20p' "$tmp_headers" >&2 || true
  sed -n '1,80p' "$tmp_body" >&2 || true
  exit 1
fi

echo "OK: session endpoint returned 200"
