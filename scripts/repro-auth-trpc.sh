#!/usr/bin/env bash
set -euo pipefail

# Repro script: sign in via credentials, then verify /api/auth/session contains user.id
# and protected tRPC calls do not return 401.

base_url="${1:-http://localhost:3002}"
email="${EMAIL:-admin@houseworks.local}"
password="${PASSWORD:-password123}"

jar="$(mktemp)"
cleanup() {
  rm -f "$jar"
}
trap cleanup EXIT

curl_retry() {
  # Retry a few times to survive Next.js dev-server rebuilds.
  # Usage: curl_retry [curl args...]
  curl --retry 6 --retry-delay 1 --retry-connrefused "$@"
}

echo "Base URL: $base_url"
echo "Signing in as: $email"

csrf_json="$(curl_retry -sS -c "$jar" "$base_url/api/auth/csrf")"
csrf="$(node -e 'const j=JSON.parse(process.argv[1]);process.stdout.write(j.csrfToken||"")' "$csrf_json")"
if [[ -z "$csrf" ]]; then
  echo "FAIL: could not obtain csrf token" >&2
  echo "$csrf_json" >&2
  exit 1
fi

post_data="$(node -e 'const qs=new URLSearchParams({csrfToken:process.argv[1],email:process.argv[2],password:process.argv[3],callbackUrl:process.argv[4]+"/",json:"true"});process.stdout.write(qs.toString());' "$csrf" "$email" "$password" "$base_url")"

curl_retry -sS -b "$jar" -c "$jar" \
  -H 'content-type: application/x-www-form-urlencoded' \
  -X POST "$base_url/api/auth/callback/credentials" \
  --data "$post_data" >/dev/null

session_json="$(curl_retry -sS -b "$jar" "$base_url/api/auth/session")"
node -e 'const s=JSON.parse(process.argv[1]); if(!s?.user?.id){ console.error("FAIL: session missing user.id"); console.error(s); process.exit(1)}; console.log("OK: session user.id="+s.user.id);' "$session_json"

# Protected tRPC call should not be 401 if session is valid.
status="$(curl_retry -sS -o /dev/null -w '%{http_code}' -b "$jar" "$base_url/api/trpc/workspaces.listMine?batch=1&input=%7B%7D")"
if [[ "$status" == "401" ]]; then
  echo "FAIL: tRPC workspaces.listMine returned 401 after sign-in" >&2
  exit 1
fi

echo "OK: tRPC workspaces.listMine http=$status"

boards_json="$(curl_retry -sS -b "$jar" "$base_url/api/trpc/boards.getDefault?batch=1&input=%7B%7D")"
printf '%s' "$boards_json" | node - <<'NODE' || true
const fs = require('fs');

const body = fs.readFileSync(0, 'utf8').trim();
if (!body) {
  console.error('WARN: empty boards.getDefault response');
  process.exit(0);
}

let parsed;
try {
  parsed = JSON.parse(body);
} catch {
  console.error('FAIL: invalid JSON from boards.getDefault');
  console.error(body.slice(0, 500));
  process.exit(1);
}

const json = parsed?.[0]?.result?.data?.json;
if (!json) {
  console.error('WARN: boards.getDefault returned null/empty (no boards?)');
  process.exit(0);
}

if (!Array.isArray(json.groups) || !Array.isArray(json.columns)) {
  console.error('WARN: boards.getDefault missing groups/columns arrays');
  console.error('keys:', Object.keys(json));
  console.error('groups type:', typeof json.groups, 'columns type:', typeof json.columns);
  process.exit(0);
}

console.log(`OK: boards.getDefault groups=${json.groups.length} columns=${json.columns.length}`);
NODE

ws_name="WS $(date +%s)"
payload="$(node -e 'process.stdout.write(JSON.stringify({0:{json:{name:process.argv[1]}}}))' "$ws_name")"
create_status="$(curl_retry -sS -o /tmp/ws_create.json -w '%{http_code}' -b "$jar" -H 'content-type: application/json' -X POST "$base_url/api/trpc/workspaces.create?batch=1" --data-binary "$payload")"
if [[ "$create_status" != "200" ]]; then
  echo "FAIL: workspaces.create http=$create_status"
  cat /tmp/ws_create.json
  exit 1
fi
echo "OK: workspaces.create http=200 name=$ws_name"
