#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  set -a
  # shellcheck disable=SC1091
  source .env
  set +a
fi

if ! command -v psql >/dev/null 2>&1; then
  echo "psql is not installed."
  echo ""
  echo "Install Postgres locally (non-Docker) using ONE of these:"
  echo "  - Postgres.app (recommended on macOS)"
  echo "  - Homebrew: brew install postgresql@16 && brew services start postgresql@16"
  exit 1
fi

DEFAULT_DB="oyrenoyret"
DEFAULT_PORT="5432"
DEFAULT_USER="${USER}"

DB_NAME="${DEV_DB_NAME:-$DEFAULT_DB}"
DB_PORT="${DEV_DB_PORT:-$DEFAULT_PORT}"
DB_USER="${DEV_DB_USER:-$DEFAULT_USER}"

LOCAL_DB_URL="${DATABASE_URL:-postgresql://${DB_USER}@localhost:${DB_PORT}/${DB_NAME}?schema=public}"

echo "Using DATABASE_URL: ${LOCAL_DB_URL}"

echo "Ensuring database exists..."
if command -v createdb >/dev/null 2>&1; then
  createdb "${DB_NAME}" >/dev/null 2>&1 || true
else
  echo "createdb not found; skipping DB creation. Create '${DB_NAME}' manually if needed."
fi

echo "Applying Prisma migrations..."
DATABASE_URL="$LOCAL_DB_URL" npx prisma migrate deploy
DATABASE_URL="$LOCAL_DB_URL" npx prisma generate

echo ""
echo "Local DB is ready."
echo "Make sure your app uses this DATABASE_URL (in .env or your shell), then restart dev server."

