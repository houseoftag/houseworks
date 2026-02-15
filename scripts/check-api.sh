#!/usr/bin/env bash
set -euo pipefail

base_url="${1:-http://localhost:3002}"
health_url="${base_url%/}/api/health"

echo "Checking API health endpoint: $health_url"

tmp_headers="$(mktemp)"
tmp_body="$(mktemp)"
cleanup() {
  rm -f "$tmp_headers" "$tmp_body"
}
trap cleanup EXIT

set +e
curl_exit=0
curl -sS --max-time 8 -D "$tmp_headers" -o "$tmp_body" "$health_url"
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

if ! command -v node >/dev/null 2>&1; then
  echo "OK: /api/health returned 200 (node not found; skipping JSON check)"
  exit 0
fi

node -e "const fs=require('fs');const body=fs.readFileSync(process.argv[1],'utf8');let json;try{json=JSON.parse(body)}catch(e){console.error('FAIL: /api/health did not return JSON');process.exit(1)};if(!json||json.ok!==true){console.error('FAIL: expected {ok:true}');console.error(json);process.exit(1)};console.log('OK: api health ok');" "$tmp_body"

