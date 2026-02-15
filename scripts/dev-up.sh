#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

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

if ! command -v docker >/dev/null 2>&1; then
  echo "docker is not installed or not on PATH" >&2
  exit 1
fi

if ! docker info >/dev/null 2>&1; then
  echo "Docker daemon is not running. Start Docker Desktop, then re-run: scripts/dev-up.sh" >&2
  exit 1
fi

if [ ! -f docker-compose.yml ]; then
  echo "Missing docker-compose.yml in repo root" >&2
  exit 1
fi

echo "Starting postgres..."
if docker ps -a --format '{{.Names}}' | grep -qx 'houseworks-postgres'; then
  docker start houseworks-postgres >/dev/null
else
  docker compose up -d postgres
fi

redis_started="false"
if port_in_use 6379; then
  echo "Redis already listening on :6379; skipping container start."
else
  echo "Starting redis..."
  if docker ps -a --format '{{.Names}}' | grep -qx 'houseworks-redis'; then
    docker start houseworks-redis >/dev/null
  else
    docker compose up -d redis
  fi
  redis_started="true"
fi

echo "Waiting for postgres..."
for _ in {1..60}; do
  if docker exec houseworks-postgres pg_isready -U postgres -d houseworks >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
docker exec houseworks-postgres pg_isready -U postgres -d houseworks >/dev/null

if [ "$redis_started" = "true" ]; then
  echo "Waiting for redis..."
  for _ in {1..60}; do
    if docker exec houseworks-redis redis-cli ping >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  docker exec houseworks-redis redis-cli ping >/dev/null
fi

if [ ! -d node_modules ]; then
  echo "Installing npm deps..."
  npm install
fi

echo "Applying DB migrations..."
npm run -s db:deploy

echo "Seeding DB (idempotent)..."
npm run -s db:seed

echo "OK: deps are up. Start the app with: npm run dev"
echo "Then (in another terminal) start worker with: npm run worker"
