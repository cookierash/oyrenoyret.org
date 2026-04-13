#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  set -a
  source .env
  set +a
fi

DB_URL="${DATABASE_URL:-}"
DEFAULT_USER="postgres"
DEFAULT_PASS="Rashgres"
DEFAULT_DB="oyrenoyret"
DEFAULT_PORT="5432"

if [[ -z "$DB_URL" ]]; then
  DB_URL="postgresql://${DEFAULT_USER}:${DEFAULT_PASS}@localhost:${DEFAULT_PORT}/${DEFAULT_DB}?schema=public"
fi

echo "Using DATABASE_URL: ${DB_URL}"

if ! command -v docker >/dev/null 2>&1; then
  echo ""
  echo "Docker is not installed."
  echo "Install Docker Desktop (recommended) or install Postgres locally, then run:"
  echo "  npx prisma migrate deploy"
  echo "  npx prisma generate"
  exit 1
fi

CONTAINER_NAME="${DEV_DB_CONTAINER_NAME:-oyrenoyret-postgres}"
POSTGRES_PASSWORD="${DEV_DB_PASSWORD:-$DEFAULT_PASS}"
POSTGRES_DB="${DEV_DB_NAME:-$DEFAULT_DB}"
HOST_PORT="${DEV_DB_PORT:-$DEFAULT_PORT}"

existing="$(docker ps -a --filter "name=^/${CONTAINER_NAME}$" --format '{{.ID}}')"
if [[ -z "$existing" ]]; then
  echo "Creating Postgres container: ${CONTAINER_NAME} on port ${HOST_PORT}..."
  docker run \
    --name "${CONTAINER_NAME}" \
    -e POSTGRES_PASSWORD="${POSTGRES_PASSWORD}" \
    -e POSTGRES_DB="${POSTGRES_DB}" \
    -p "${HOST_PORT}:5432" \
    -d postgres:16
else
  echo "Starting Postgres container: ${CONTAINER_NAME}..."
  docker start "${CONTAINER_NAME}" >/dev/null
fi

echo "Waiting for Postgres to be ready..."
for i in {1..60}; do
  if docker exec "${CONTAINER_NAME}" pg_isready -U "${DEFAULT_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    break
  fi
  sleep 1
  if [[ "$i" == "60" ]]; then
    echo "Postgres did not become ready in time."
    exit 1
  fi
done

LOCAL_DB_URL="postgresql://${DEFAULT_USER}:${POSTGRES_PASSWORD}@localhost:${HOST_PORT}/${POSTGRES_DB}?schema=public"
echo ""
echo "Applying Prisma migrations to local DB..."
DATABASE_URL="$LOCAL_DB_URL" npx prisma migrate deploy
DATABASE_URL="$LOCAL_DB_URL" npx prisma generate

echo ""
echo "Local DB is ready."
echo "If you want the app to use it, set:"
echo "  DATABASE_URL=\"$LOCAL_DB_URL\""
