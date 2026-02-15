#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

base_url="${BASE_URL:-http://localhost:3002}"
web_log="${WEB_LOG:-next-dev-3002.log}"
worker_out_log="${WORKER_OUT_LOG:-worker_out.log}"
worker_err_log="${WORKER_ERR_LOG:-worker_err.log}"
web_pid_file="${WEB_PID_FILE:-.next-dev.pid}"
worker_pid_file="${WORKER_PID_FILE:-.worker.pid}"

is_pid_running() {
  local pid="$1"
  if [[ -z "${pid}" ]]; then
    return 1
  fi
  ps -p "${pid}" >/dev/null 2>&1
}

port_in_use() {
  local port="$1"
  if command -v lsof >/dev/null 2>&1; then
    lsof -nP -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
    return $?
  fi
  if command -v nc >/dev/null 2>&1; then
    nc -z 127.0.0.1 "$port" >/dev/null 2>&1
    return $?
  fi
  return 1
}

start_web() {
  if [[ -f "$web_pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$web_pid_file" 2>/dev/null || true)"
    if is_pid_running "$existing_pid"; then
      echo "Web already running (pid=$existing_pid)."
      return 0
    fi
  fi

  if port_in_use 3002; then
    echo "Port 3002 already in use; not starting web."
    return 0
  fi

  echo "Starting web (npm run dev) on :3002..."
  : >"$web_log"
  nohup npm run dev >"$web_log" 2>&1 &
  echo $! >"$web_pid_file"
}

start_worker() {
  if [[ -f "$worker_pid_file" ]]; then
    local existing_pid
    existing_pid="$(cat "$worker_pid_file" 2>/dev/null || true)"
    if is_pid_running "$existing_pid"; then
      echo "Worker already running (pid=$existing_pid)."
      return 0
    fi
  fi

  echo "Starting worker (npm run worker)..."
  : >"$worker_out_log"
  : >"$worker_err_log"
  nohup npm run worker >"$worker_out_log" 2>"$worker_err_log" &
  echo $! >"$worker_pid_file"
}

wait_for_web() {
  if [[ ! -f scripts/check-auth.sh ]]; then
    echo "WARN: scripts/check-auth.sh missing; skipping web check."
    return 0
  fi

  echo "Waiting for web health check..."
  for _ in {1..60}; do
    if bash scripts/check-auth.sh "$base_url" >/dev/null 2>&1; then
      echo "OK: web is responding at $base_url"
      return 0
    fi
    sleep 1
  done

  echo "FAIL: web did not become healthy within 60s." >&2
  echo "Tail of $web_log:" >&2
  tail -n 80 "$web_log" >&2 || true
  return 1
}

start_web
start_worker
wait_for_web

echo "OK: started."
echo "Web:    $base_url"
echo "PIDs:   web=$(cat "$web_pid_file" 2>/dev/null || echo '?') worker=$(cat "$worker_pid_file" 2>/dev/null || echo '?')"

