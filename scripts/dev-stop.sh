#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

web_pid_file="${WEB_PID_FILE:-.next-dev.pid}"
worker_pid_file="${WORKER_PID_FILE:-.worker.pid}"

stop_pid_file() {
  local label="$1"
  local pid_file="$2"

  if [[ ! -f "$pid_file" ]]; then
    echo "$label: no pid file ($pid_file)"
    return 0
  fi

  local pid
  pid="$(cat "$pid_file" 2>/dev/null || true)"
  if [[ -z "$pid" ]]; then
    echo "$label: empty pid file ($pid_file)"
    return 0
  fi

  if ! ps -p "$pid" >/dev/null 2>&1; then
    echo "$label: not running (pid=$pid)"
    return 0
  fi

  echo "Stopping $label (pid=$pid)..."
  kill "$pid" >/dev/null 2>&1 || true
}

stop_pid_file "web" "$web_pid_file"
stop_pid_file "worker" "$worker_pid_file"

echo "OK: stop signals sent."

