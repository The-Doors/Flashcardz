#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec docker compose --project-name flashcardz-supabase \
    --env-file .env \
    -f upstream/docker/docker-compose.yml \
    -f compose.override.yml "$@"
